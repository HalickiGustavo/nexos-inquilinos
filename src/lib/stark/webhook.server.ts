// WebhookService — valida assinatura, persiste evento cru, orquestra ações.

import { verifyStarkSignature } from "./stark.server";
import { getDynamicBrcode, getBoleto } from "./charges.server";
import { computeSplit } from "./split-engine";
import { enqueueTransfersForSplit } from "./transfers.repo.server";

type EventEnvelope = {
  event?: {
    id?: string;
    subscription?: string;
    logType?: string;
    log?: any;
    created?: string;
  };
};

export async function handleStarkWebhook(rawBody: string, digitalSignature: string | null) {
  const ok = await verifyStarkSignature(rawBody, digitalSignature);
  if (!ok) {
    return { ok: false, status: 401, error: "invalid signature" };
  }

  let payload: EventEnvelope;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: "invalid json" };
  }

  const event = payload.event;
  if (!event?.id || !event?.subscription) {
    return { ok: false, status: 400, error: "missing event" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Idempotência: event_id UNIQUE
  const { error: insErr } = await supabaseAdmin
    .from("stark_events")
    .insert({
      event_id: event.id,
      subscription: event.subscription,
      log_type: event.logType ?? null,
      raw: payload as any,
    } as any);
  if (insErr && !insErr.message.includes("duplicate")) {
    console.error("[stark-webhook] insert event", insErr);
    return { ok: false, status: 500, error: insErr.message };
  }
  if (insErr) {
    // já processado
    return { ok: true, duplicated: true };
  }

  try {
    if (event.subscription === "dynamic-brcode" || event.subscription === "brcode-payment") {
      await onBrcodePaid(event);
    } else if (event.subscription === "boleto") {
      await onBoletoPaid(event);
    } else if (event.subscription === "pix-request") {
      await onPixRequestUpdated(event);
    }
    await supabaseAdmin
      .from("stark_events")
      .update({ processed_at: new Date().toISOString() } as any)
      .eq("event_id", event.id);
  } catch (e: any) {
    console.error("[stark-webhook] processing error", e);
    await supabaseAdmin
      .from("stark_events")
      .update({ error: (e?.message ?? String(e)).slice(0, 500) } as any)
      .eq("event_id", event.id);
  }
  return { ok: true };
}

async function onBrcodePaid(event: any) {
  const log = event.log ?? {};
  const brcodeId = log?.brcode?.id ?? log?.payment?.brcode?.id ?? log?.brcodeId;
  if (!brcodeId) return;
  await confirmChargePaid({ starkId: brcodeId, kind: "pix" });
}

async function onBoletoPaid(event: any) {
  const log = event.log ?? {};
  const boletoId = log?.boleto?.id ?? log?.payment?.boleto?.id;
  if (!boletoId) return;
  await confirmChargePaid({ starkId: boletoId, kind: "boleto" });
}

async function onPixRequestUpdated(event: any) {
  const log = event.log ?? {};
  const req = log?.request ?? log?.pixRequest;
  const id = req?.id;
  if (!id) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (req.status === "success") {
    await supabaseAdmin
      .from("payment_transfers")
      .update({ status: "COMPLETED", paid_at: new Date().toISOString() } as any)
      .eq("stark_transfer_id", id);
  } else if (req.status === "failed") {
    await supabaseAdmin
      .from("payment_transfers")
      .update({ status: "FAILED", error_message: (req.reason ?? "failed").slice(0, 500) } as any)
      .eq("stark_transfer_id", id);
  }
}

export async function confirmChargePaid(args: { starkId: string; kind: "pix" | "boleto" }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Confirma via API (nunca confie apenas no webhook)
  let paidConfirmed = false;
  let paidAmount = 0;
  if (args.kind === "pix") {
    const res = await getDynamicBrcode(args.starkId).catch(() => null);
    const st = res?.dynamicBrcode?.status;
    paidConfirmed = st === "paid";
    paidAmount = (res?.dynamicBrcode?.amount ?? 0) / 100;
  } else {
    const res = await getBoleto(args.starkId).catch(() => null);
    const st = res?.boleto?.status;
    paidConfirmed = st === "paid";
    paidAmount = (res?.boleto?.amount ?? 0) / 100;
  }
  if (!paidConfirmed) return;

  // Localiza a cobrança
  const { data: charge } = await supabaseAdmin
    .from("stark_charges")
    .select("*")
    .eq("stark_id", args.starkId)
    .maybeSingle();

  if (!charge) return;

  await supabaseAdmin
    .from("stark_charges")
    .update({ status: "paid", paid_at: new Date().toISOString() } as any)
    .eq("id", (charge as any).id);

  await supabaseAdmin
    .from("installments")
    .update({
      status: "pago",
      paid_amount: paidAmount || (charge as any).amount,
      payment_date: new Date().toISOString().slice(0, 10),
    } as any)
    .eq("id", (charge as any).installment_id);

  // Recalcula split e enfileira repasses
  await enqueueSplitForInstallment((charge as any).installment_id, paidAmount || Number((charge as any).amount));
}

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
    supabaseAdmin.from("agency_settings").select("pix_key").eq("manager_user_id", managerUserId).maybeSingle(),
    landlordId
      ? supabaseAdmin.from("profiles").select("pix_key").eq("id", landlordId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const nexoPixKey = (platform as any)?.nexo_platform_pix_key ?? "66524872000167";
  const nexoFeeRaw = (platform as any)?.nexo_flat_fee;
  const nexoFee = Number(nexoFeeRaw ?? process.env.NEXO_FLAT_FEE ?? 24.99);

  const split = computeSplit({
    paidAmount,
    nexoFee,
    managementFeePercent: pct,
    agencyPixKey: (agency as any)?.pix_key ?? null,
    ownerPixKey: (ownerProfile as any)?.pix_key ?? null,
    nexoPixKey,
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
