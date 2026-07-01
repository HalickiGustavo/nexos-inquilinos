/**
 * Rotinas server-only de manutenção do ciclo Efí:
 *  - runSweepPaidEfiCharges: varre cobranças Pix `pending` e marca como pagas
 *    consultando /v2/cob/{txid}. Após marcar paga, dispara repasse instantâneo.
 *  - runAutoGenerateBoletos: para parcelas cujo vencimento está a <= 15 dias
 *    e que ainda não têm boleto, emite boleto Efí automaticamente.
 */

type SweepResult = {
  scanned: number;
  paid: number;
  errors: number;
  details: Array<{ split_id: string; installment_id: string; ok: boolean; paid?: boolean; status?: string; error?: string }>;
};

export async function runSweepPaidEfiCharges(): Promise<SweepResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchPixCob } = await import("./efi.server");
  const { runInstantPayoutForSplit } = await import("./efi-payouts.server");

  const { data: pending, error } = await supabaseAdmin
    .from("pix_splits")
    .select("id, installment_id, psp_txid, charge_type, status")
    .eq("status", "pending")
    .eq("charge_type", "pix")
    .not("psp_txid", "is", null)
    .limit(200);
  if (error) throw new Error(error.message);

  const details: SweepResult["details"] = [];
  let paidCount = 0;
  let errCount = 0;
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  for (const row of pending ?? []) {
    try {
      const cob = await fetchPixCob(row.psp_txid as string);
      const status = String(cob?.status ?? "").toUpperCase();
      if (status === "CONCLUIDA") {
        await supabaseAdmin
          .from("pix_splits")
          .update({ status: "paid", paid_at: nowIso, payout_status: "scheduled", payout_scheduled_for: today })
          .eq("id", row.id);
        await supabaseAdmin
          .from("installments")
          .update({ status: "pago", payment_date: nowIso })
          .eq("id", row.installment_id);
        try { await runInstantPayoutForSplit(row.id); } catch (e) { console.error("[sweep] payout fail", row.id, e); }
        paidCount++;
        details.push({ split_id: row.id, installment_id: row.installment_id, ok: true, paid: true, status });
      } else {
        details.push({ split_id: row.id, installment_id: row.installment_id, ok: true, paid: false, status });
      }
    } catch (e: any) {
      errCount++;
      details.push({ split_id: row.id, installment_id: row.installment_id, ok: false, error: e?.message ?? String(e) });
    }
  }

  return { scanned: (pending ?? []).length, paid: paidCount, errors: errCount, details };
}

type AutoBoletoResult = {
  scanned: number;
  generated: number;
  errors: number;
  details: Array<{ installment_id: string; ok: boolean; error?: string }>;
};

/**
 * Para cada parcela com vencimento dentro do horizonte (default 15 dias) que
 * ainda não tem boleto emitido, gera o boleto Efí automaticamente.
 */
export async function runAutoGenerateBoletos(opts?: { horizonDays?: number; limit?: number }): Promise<AutoBoletoResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createBoletoCharge, isEfiProductionMode } = await import("./efi.server");
  const horizon = opts?.horizonDays ?? 15;
  const limit = opts?.limit ?? 100;

  if (!isEfiProductionMode()) {
    return { scanned: 0, generated: 0, errors: 0, details: [] };
  }

  const horizonDate = new Date();
  horizonDate.setUTCDate(horizonDate.getUTCDate() + horizon);
  const horizonStr = horizonDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Busca parcelas elegíveis: pendentes/agendadas, dentro do horizonte, sem boleto Efí.
  const { data: rows, error } = await supabaseAdmin
    .from("installments")
    .select(
      "id, amount, due_date, contract_id, user_id, boleto_url, " +
        "contract:contracts(id, rent_amount, agency_admin_fee_percentage, property_id, user_id, tenant_id, late_fee_percent, daily_interest_percent)",
    )
    .in("status", ["pendente", "agendado"])
    .is("boleto_url", null)
    .gte("due_date", today)
    .lte("due_date", horizonStr)
    .limit(limit);

  if (error) throw new Error(error.message);

  const details: AutoBoletoResult["details"] = [];
  let generated = 0;
  let errors = 0;

  for (const inst of (rows as any[]) ?? []) {
    try {
      // Skip se já existe pix_split do tipo boleto.
      const { data: existing } = await supabaseAdmin
        .from("pix_splits")
        .select("id")
        .eq("installment_id", inst.id)
        .eq("charge_type", "boleto")
        .maybeSingle();
      if (existing) {
        details.push({ installment_id: inst.id, ok: true });
        continue;
      }

      const contract = inst.contract;
      if (!contract) throw new Error("Contrato não encontrado");
      const managerUserId: string = contract.user_id;

      const [{ data: prop }, { data: agency }, { data: settingsRows }, { data: tenant }] = await Promise.all([
        supabaseAdmin.from("properties").select("id, landlord_id, owner_pix_key, owner_pix_key_type").eq("id", contract.property_id).maybeSingle(),
        supabaseAdmin.from("agency_settings").select("agency_pix_key, agency_pix_key_type").eq("manager_user_id", managerUserId).maybeSingle(),
        supabaseAdmin.from("platform_settings").select("key, value").in("key", ["nexo_flat_fee"]),
        supabaseAdmin.from("tenants").select("full_name, document, email, phone").eq("id", contract.tenant_id).maybeSingle(),
      ]);

      if (!tenant?.document) {
        throw new Error("Inquilino sem CPF/CNPJ — boleto não pode ser emitido");
      }

      const settings: Record<string, string> = {};
      (settingsRows ?? []).forEach((r: any) => (settings[r.key] = r.value));
      const nexoFee = Number(settings.nexo_flat_fee ?? "24.99");

      let ownerPixKey: string | null = null;
      if ((prop as any)?.landlord_id) {
        const { data: lp } = await supabaseAdmin.from("profiles").select("pix_key").eq("id", (prop as any).landlord_id).maybeSingle();
        ownerPixKey = (lp as any)?.pix_key ?? null;
      }
      if (!ownerPixKey) ownerPixKey = (prop as any)?.owner_pix_key ?? null;

      const rent = Number(contract.rent_amount);
      const hasAgency = Boolean((agency as any)?.agency_pix_key);
      const feePct = hasAgency ? Number(contract.agency_admin_fee_percentage ?? 10) : 0;
      const agencyAmount = hasAgency ? +((rent * feePct) / 100).toFixed(2) : 0;
      const ownerAmount = +(rent - agencyAmount).toFixed(2);
      const total = +(rent + nexoFee).toFixed(2);

      const boleto = await createBoletoCharge({
        installmentId: inst.id,
        totalValue: total,
        dueDate: inst.due_date,
        customer: {
          name: tenant.full_name,
          document: tenant.document,
          email: tenant.email ?? undefined,
          phone: tenant.phone ?? undefined,
        },
        description: `Aluguel Nexo - parcela ${inst.due_date}`,
        finePercent: Number(contract.late_fee_percent ?? 0) || undefined,
        monthlyInterestPercent: Number(contract.daily_interest_percent ?? 0) || undefined,
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await supabaseAdmin.from("pix_splits").upsert(
        {
          installment_id: inst.id,
          user_id: managerUserId,
          provider: boleto.provider,
          charge_type: "boleto",
          nexo_amount: nexoFee,
          agency_amount: agencyAmount,
          owner_amount: ownerAmount,
          nexo_pix_key: "66524872000167",
          agency_pix_key: (agency as any)?.agency_pix_key ?? null,
          owner_pix_key: ownerPixKey,
          psp_txid: boleto.chargeId,
          boleto_url: boleto.url,
          boleto_barcode: boleto.barcode,
          status: "pending",
          payout_status: "pending",
          payout_scheduled_for: tomorrow.toISOString().slice(0, 10),
        },
        { onConflict: "installment_id" } as any,
      );

      await supabaseAdmin
        .from("installments")
        .update({
          boleto_url: boleto.url,
          boleto_barcode: boleto.barcode,
          barcode: boleto.barcode,
          charge_provider: "efi",
        })
        .eq("id", inst.id);

      generated++;
      details.push({ installment_id: inst.id, ok: true });
    } catch (e: any) {
      errors++;
      const msg = e?.message ?? String(e);
      console.error("[auto-boleto] falha em", inst.id, msg);
      details.push({ installment_id: inst.id, ok: false, error: msg });
    }
  }

  return { scanned: (rows ?? []).length, generated, errors, details };
}
