// Daily landlord payout (D+1) — transfere via PIX o valor líquido das
// parcelas pagas para o proprietário do imóvel, descontadas:
//   1. Taxa fixa NEXO (já capturada via split na emissão da cobrança)
//   2. Repasse % da imobiliária (default_management_fee_percent)
// O restante é enviado para a chave PIX do proprietário cadastrada em profiles.

export async function runProcessLandlordPayouts(opts?: { limit?: number }) {
  const { asaasFetch, getNexoFee } = await import("./asaas.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limit = opts?.limit ?? 200;

  const { data: rows, error } = await supabaseAdmin
    .from("installments")
    .select(
      "id, user_id, contract_id, amount, paid_amount, payment_date, " +
      "contract:contracts(id, user_id, property:properties(id, landlord_id, default_management_fee_percent, nickname))",
    )
    .eq("status", "pago")
    .eq("landlord_payout_status", "pendente")
    .limit(limit);

  if (error) throw new Error(error.message);

  const nexoFee = getNexoFee();
  const results: Array<{ installmentId: string; ok: boolean; error?: string; amount?: number }> = [];

  for (const inst of ((rows as any[]) ?? [])) {
    try {
      const contract = (inst as any).contract;
      const property = contract?.property;
      const landlordId: string | null = property?.landlord_id ?? null;
      const managerId: string = contract?.user_id ?? inst.user_id;

      if (!landlordId) {
        await supabaseAdmin.from("installments").update({
          landlord_payout_status: "n/a",
          landlord_payout_error: "Imóvel sem proprietário vinculado",
        } as any).eq("id", inst.id);
        results.push({ installmentId: inst.id, ok: false, error: "sem landlord" });
        continue;
      }

      const profile = await supabaseAdmin
        .from("profiles")
        .select("pix_key, pix_key_type, document, full_name")
        .eq("id", landlordId)
        .maybeSingle();
      const pixKey = profile.data?.pix_key as string | null;
      const pixKeyType = profile.data?.pix_key_type as string | null;
      if (!pixKey) {
        await supabaseAdmin.from("installments").update({
          landlord_payout_error: "Proprietário sem chave PIX cadastrada",
        } as any).eq("id", inst.id);
        results.push({ installmentId: inst.id, ok: false, error: "sem pix" });
        continue;
      }

      // Credenciais da subconta da imobiliária (manager)
      const acc = await supabaseAdmin
        .from("asaas_accounts")
        .select("api_key")
        .eq("user_id", managerId)
        .maybeSingle();
      const apiKey = acc.data?.api_key as string | null;
      if (!apiKey) {
        await supabaseAdmin.from("installments").update({
          landlord_payout_error: "Imobiliária sem subconta Asaas",
        } as any).eq("id", inst.id);
        results.push({ installmentId: inst.id, ok: false, error: "manager sem asaas" });
        continue;
      }

      const paid = Number(inst.paid_amount || inst.amount || 0);
      const feePct = Number(property?.default_management_fee_percent ?? 10);
      const managerCut = +((paid * feePct) / 100).toFixed(2);
      // taxa NEXO já saiu via split na cobrança; aqui apenas calculamos o líquido
      // que sobrou na subconta da imobiliária (paid - nexoFee) e descontamos o repasse.
      const netToLandlord = +(paid - nexoFee - managerCut).toFixed(2);

      if (netToLandlord <= 0) {
        await supabaseAdmin.from("installments").update({
          landlord_payout_status: "pago",
          landlord_payout_amount: 0,
          landlord_payout_date: new Date().toISOString(),
          landlord_payout_error: "Líquido zero ou negativo após taxas",
        } as any).eq("id", inst.id);
        results.push({ installmentId: inst.id, ok: true, amount: 0 });
        continue;
      }

      const transfer = await asaasFetch<any>("/transfers", {
        method: "POST",
        apiKey,
        body: JSON.stringify({
          value: netToLandlord,
          pixAddressKey: pixKey,
          pixAddressKeyType: pixKeyType ?? "CPF",
          description: `Repasse aluguel — ${property?.nickname ?? ""} (parcela ${inst.id.slice(0, 8)})`,
          externalReference: inst.id,
        }),
      });

      await supabaseAdmin.from("installments").update({
        landlord_payout_status: "pago",
        landlord_payout_amount: netToLandlord,
        landlord_payout_date: new Date().toISOString(),
        landlord_payout_asaas_id: transfer.id ?? null,
        landlord_payout_error: null,
      } as any).eq("id", inst.id);

      results.push({ installmentId: inst.id, ok: true, amount: netToLandlord });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error("[landlord-payouts] falha em", inst.id, msg);
      await supabaseAdmin.from("installments").update({
        landlord_payout_status: "erro",
        landlord_payout_error: msg.slice(0, 500),
      } as any).eq("id", inst.id);
      results.push({ installmentId: inst.id, ok: false, error: msg });
    }
  }

  return { processed: results.length, results };
}
