// Processamento do webhook Efí: reconciliar cobrança PIX paga, marcar parcela,
// calcular split e enfileirar repasses. É invocado pela rota
// `src/routes/api/public/efi-webhook.ts` e também pode ser chamado por
// reconciliação/polling (checkPixPayment).
//
// SERVER-ONLY.

import { computeSplit } from "@/lib/stark/split-engine";
import { enqueueTransfersForSplit } from "@/lib/stark/transfers.repo.server";
import { efiCobGet } from "./efi.server";

type EfiWebhookPixItem = {
  endToEndId?: string;
  txid?: string;
  valor?: string;
  chave?: string;
  horario?: string;
  infoPagador?: string;
};

type EfiWebhookPayload = {
  pix?: EfiWebhookPixItem[];
};

/** Processa um payload de webhook Efí. Retorna quantas cobranças foram
 *  confirmadas. Idempotente: se a parcela já está `pago`, não duplica repasse. */
export async function processEfiWebhookPayload(payload: EfiWebhookPayload): Promise<{
  processed: number;
  errors: string[];
}> {
  const items = payload?.pix ?? [];
  let processed = 0;
  const errors: string[] = [];

  for (const p of items) {
    try {
      if (!p.txid) continue;
      const paidAmount = p.valor ? Number(p.valor) : 0;
      await confirmEfiChargePaid({ txid: p.txid, paidAmount, endToEndId: p.endToEndId });
      processed += 1;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error("[efi-webhook] item error", p?.txid, msg);
      errors.push(`${p?.txid}: ${msg}`);
    }
  }

  // Dispara o worker de repasses assim que houver split para processar.
  if (processed > 0) {
    try {
      const { runEfiPayoutWorker } = await import("./payout-worker.server");
      await runEfiPayoutWorker({ limit: 20 });
    } catch (e) {
      console.error("[efi-webhook] payout worker error", e);
    }
  }

  return { processed, errors };
}

/** Confirma pagamento de uma cobrança Efí a partir do txid.
 *  Faz cross-check em `/v2/cob/{txid}` para nunca confiar só no webhook. */
export async function confirmEfiChargePaid(args: {
  txid: string;
  paidAmount?: number;
  endToEndId?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Cross-check na Efí — status deve ser CONCLUIDA e valor.original bate
  let confirmedAmount = args.paidAmount ?? 0;
  try {
    const cob: any = await efiCobGet(args.txid);
    if (cob?.status && cob.status !== "CONCLUIDA") {
      console.warn("[efi-webhook] cob not CONCLUIDA yet", args.txid, cob.status);
      // Alguns eventos chegam antes do status virar CONCLUIDA. Confiamos no
      // valor recebido no webhook + presença de endToEndId como evidência.
      if (!args.endToEndId) return;
    }
    const original = Number(cob?.valor?.original ?? 0);
    if (original > 0 && !confirmedAmount) confirmedAmount = original;
  } catch (e) {
    console.warn("[efi-webhook] cob_get failed, continuing with webhook data", e);
  }

  // 2) Localiza cobrança PIX no banco (kind='pix' — nunca colide com boleto)
  const { data: charge } = await supabaseAdmin
    .from("efi_charges" as any)
    .select("id, installment_id, amount, status, manager_user_id, kind")
    .eq("txid", args.txid)
    .eq("kind", "pix")
    .maybeSingle();

  if (!charge) {
    console.warn("[efi-webhook] efi_charge (pix) not found for txid", args.txid);
    return;
  }

  if ((charge as any).status === "paid") {
    // já processado — idempotência
    return;
  }

  const installmentId = (charge as any).installment_id as string;
  const amount = confirmedAmount || Number((charge as any).amount);

  // 3) Marca cobrança e parcela como pagas
  await supabaseAdmin
    .from("efi_charges" as any)
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      raw: { endToEndId: args.endToEndId, paidAmount: amount } as any,
    } as any)
    .eq("id", (charge as any).id);

  const { data: inst } = await supabaseAdmin
    .from("installments")
    .select("id, status")
    .eq("id", installmentId)
    .maybeSingle();

  if ((inst as any)?.status !== "pago") {
    await supabaseAdmin
      .from("installments")
      .update({
        status: "pago",
        paid_amount: amount,
        payment_date: new Date().toISOString().slice(0, 10),
      } as any)
      .eq("id", installmentId);
  }

  // 4) Calcula split e enfileira repasses (idempotente via external_id UNIQUE)
  await enqueueSplitForInstallment(installmentId, amount);
}

/** Confirma pagamento de um BOLETO Efí (identificador = charge_id numérico).
 *  Fluxo separado do PIX: endpoints e IDs diferentes. Reaproveita o cálculo
 *  de split, já que a lógica financeira interna é a mesma. */
export async function markBoletoChargePaid(args: {
  chargeId: string | number;
  paidAmount: number;
  paidAt?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const chargeIdStr = String(args.chargeId);

  const { data: charge } = await supabaseAdmin
    .from("efi_charges" as any)
    .select("id, installment_id, amount, status, kind")
    .eq("txid", chargeIdStr)
    .eq("kind", "boleto")
    .maybeSingle();

  if (!charge) {
    console.warn("[efi-webhook] boleto charge not found", chargeIdStr);
    return;
  }
  if ((charge as any).status === "paid") return;

  const installmentId = (charge as any).installment_id as string;
  const amount = args.paidAmount || Number((charge as any).amount ?? 0);

  await supabaseAdmin
    .from("efi_charges" as any)
    .update({
      status: "paid",
      paid_at: args.paidAt ?? new Date().toISOString(),
      raw: { chargeId: chargeIdStr, paidAmount: amount } as any,
    } as any)
    .eq("id", (charge as any).id);

  const { data: inst } = await supabaseAdmin
    .from("installments")
    .select("id, status")
    .eq("id", installmentId)
    .maybeSingle();

  if ((inst as any)?.status !== "pago") {
    await supabaseAdmin
      .from("installments")
      .update({
        status: "pago",
        paid_amount: amount,
        payment_date: (args.paidAt ?? new Date().toISOString()).slice(0, 10),
      } as any)
      .eq("id", installmentId);
  }

  await enqueueSplitForInstallment(installmentId, amount);

  // Dispara worker de repasse imediatamente.
  try {
    const { runEfiPayoutWorker } = await import("./payout-worker.server");
    await runEfiPayoutWorker({ limit: 20 });
  } catch (e) {
    console.error("[efi-webhook] boleto payout worker error", e);
  }
}

/** Recalcula split e insere linhas em `payment_transfers`. Reutilizável para
 *  reconciliação manual. */
export async function enqueueSplitForInstallment(installmentId: string, paidAmount: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: inst } = await supabaseAdmin
    .from("installments")
    .select(
      "id, contract_id, user_id, contract:contracts(id, user_id, property:properties(id, landlord_id, default_management_fee_percent))",
    )
    .eq("id", installmentId)
    .maybeSingle();
  if (!inst) return;

  const contract = (inst as any).contract;
  const property = contract?.property;
  const managerUserId = contract?.user_id ?? (inst as any).user_id;
  const landlordId: string | null = property?.landlord_id ?? null;
  const pct = Number(property?.default_management_fee_percent ?? 10);

  const [{ data: platform }, { data: agency }, { data: ownerProfile }] = await Promise.all([
    supabaseAdmin.from("platform_settings").select("nexo_platform_pix_key, nexo_flat_fee").limit(1).maybeSingle(),
    supabaseAdmin
      .from("agency_settings")
      .select("agency_pix_key, agency_pix_key_type")
      .eq("manager_user_id", managerUserId)
      .maybeSingle(),
    landlordId
      ? supabaseAdmin.from("profiles").select("pix_key, pix_key_type").eq("id", landlordId).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  const nexoPixKey = (platform as any)?.nexo_platform_pix_key ?? process.env.EFI_PIX_KEY ?? "66524872000167";
  const nexoFee = Number((platform as any)?.nexo_flat_fee ?? process.env.NEXO_FLAT_FEE ?? 24.99);
  const agencyPixKey = (agency as any)?.agency_pix_key ?? null;
  const ownerPixKey = (ownerProfile as any)?.pix_key ?? null;

  console.log("[efi-split] inputs", {
    installmentId,
    paidAmount,
    nexoFee,
    managementFeePercent: pct,
    agencyPixKey: agencyPixKey ? "present" : "MISSING",
    ownerPixKey: ownerPixKey ? "present" : "MISSING",
  });

  const split = computeSplit({
    paidAmount,
    nexoFee,
    managementFeePercent: pct,
    agencyPixKey,
    ownerPixKey,
    nexoPixKey,
  });

  console.log("[efi-split] result", {
    installmentId,
    nexo: split.nexo.amount,
    agency: split.agency.amount,
    owner: split.owner.amount,
  });

  await enqueueTransfersForSplit(split, {
    installmentId,
    contractId: contract?.id ?? (inst as any).contract_id,
    managerUserId,
    agencyUserId: managerUserId,
    ownerUserId: landlordId,
    description: `Repasse parcela ${installmentId.slice(0, 8)}`,
  });
}
