/**
 * Repasse Pix automatizado para cobranças Efí pagas (Pix e Boleto).
 *
 * Dois modos:
 *  - INSTANTÂNEO: `runInstantPayoutForSplit(splitId)` — disparado pelo
 *    webhook e pelo polling assim que a cobrança é marcada como paga.
 *    Usa claim atômico (`scheduled` → `processing`) para idempotência:
 *    se webhook e polling rodarem em paralelo, só um vence o UPDATE e
 *    executa as transferências; o outro vira no-op.
 *  - FALLBACK D+1: `runProcessEfiBoletoPayouts()` — cron diário que
 *    reprocessa qualquer split que ainda esteja `scheduled` (ex.: o instant
 *    falhou ou o webhook nunca chegou).
 */

type PayoutAttempt = { recipient: "agency" | "owner"; ok: boolean; error?: string };

async function dispatchSplitPayout(split: any): Promise<{ ok: boolean; error?: string; attempts: PayoutAttempt[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPix } = await import("./efi.server");

  const targets: Array<{ recipient: "agency" | "owner"; pixKey: string | null; amount: number }> = [
    { recipient: "agency", pixKey: split.agency_pix_key, amount: Number(split.agency_amount) },
    { recipient: "owner", pixKey: split.owner_pix_key, amount: Number(split.owner_amount) },
  ];

  const attempts: PayoutAttempt[] = [];
  let allOk = true;
  let lastErr: string | null = null;

  for (const t of targets) {
    if (!t.pixKey || t.amount <= 0) continue;

    // Idempotência por destinatário: se já registramos esse repasse, pula.
    const { data: existing } = await supabaseAdmin
      .from("efi_payouts")
      .select("id, status")
      .eq("pix_split_id", split.id)
      .eq("recipient", t.recipient)
      .in("status", ["processing", "mock_sent", "paid", "completed"])
      .maybeSingle();
    if (existing) {
      attempts.push({ recipient: t.recipient, ok: true });
      continue;
    }

    const idEnvio = `nx${String(split.id).replace(/-/g, "").slice(0, 20)}${t.recipient.slice(0, 2)}`;
    try {
      const res = await sendPix({
        idEnvio,
        amount: t.amount,
        pixKey: t.pixKey,
        description: `Repasse Nexo - ${t.recipient === "agency" ? "Administracao" : "Proprietario"}`,
      });
      await supabaseAdmin.from("efi_payouts").insert({
        pix_split_id: split.id,
        user_id: split.user_id,
        recipient: t.recipient,
        pix_key: t.pixKey,
        amount: t.amount,
        e2e_id: res.e2eId,
        status: res.status === "MOCK" ? "mock_sent" : "processing",
        paid_at: res.status === "MOCK" ? new Date().toISOString() : null,
      });
      attempts.push({ recipient: t.recipient, ok: true });
    } catch (innerErr: any) {
      allOk = false;
      lastErr = innerErr?.message ?? String(innerErr);
      await supabaseAdmin.from("efi_payouts").insert({
        pix_split_id: split.id,
        user_id: split.user_id,
        recipient: t.recipient,
        pix_key: t.pixKey,
        amount: t.amount,
        status: "failed",
        error: lastErr,
      });
      attempts.push({ recipient: t.recipient, ok: false, error: lastErr ?? undefined });
    }
  }

  const out: { ok: boolean; error?: string; attempts: PayoutAttempt[] } = { ok: allOk, attempts };
  if (lastErr) out.error = lastErr;
  return out;
}

/**
 * Tenta executar o repasse imediatamente. Claim atômico evita corrida
 * entre webhook + polling — só um caller vence e processa.
 * Em falha, reagenda para o cron D+1 reprocessar.
 */
export async function runInstantPayoutForSplit(
  splitId: string,
): Promise<{ ok: boolean; claimed: boolean; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Claim: scheduled → processing (apenas um caller vence)
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("pix_splits")
    .update({ payout_status: "processing" })
    .eq("id", splitId)
    .eq("payout_status", "scheduled")
    .select("*")
    .maybeSingle();

  if (claimErr) return { ok: false, claimed: false, error: claimErr.message };
  if (!claimed) return { ok: true, claimed: false }; // outro processo cuidou

  const result = await dispatchSplitPayout(claimed);

  if (result.ok) {
    await supabaseAdmin
      .from("pix_splits")
      .update({ payout_status: "paid", payout_error: null })
      .eq("id", splitId);
    return { ok: true, claimed: true };
  }

  // Falha — reagenda para o cron D+1 reprocessar
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await supabaseAdmin
    .from("pix_splits")
    .update({
      payout_status: "scheduled",
      payout_error: result.error ?? "Instant payout failed",
      payout_scheduled_for: tomorrow.toISOString().slice(0, 10),
    })
    .eq("id", splitId);
  return { ok: false, claimed: true, error: result.error };
}

/**
 * Cron D+1: reprocessa qualquer split que ainda esteja agendado
 * (instant falhou, webhook não chegou, etc.).
 */
export async function runProcessEfiBoletoPayouts(): Promise<{
  processed: number;
  errors: number;
  details: Array<{ pix_split_id: string; ok: boolean; error?: string }>;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const today = new Date().toISOString().slice(0, 10);
  const { data: pending, error } = await supabaseAdmin
    .from("pix_splits")
    .select("id")
    .in("charge_type", ["pix", "boleto"])
    .eq("status", "paid")
    .eq("payout_status", "scheduled")
    .lte("payout_scheduled_for", today)
    .limit(50);

  if (error) throw new Error(error.message);

  const details: Array<{ pix_split_id: string; ok: boolean; error?: string }> = [];
  let processed = 0;
  let errors = 0;

  for (const row of pending ?? []) {
    const res = await runInstantPayoutForSplit(row.id);
    processed++;
    details.push({ pix_split_id: row.id, ok: res.ok, error: res.error });
    if (!res.ok) errors++;
  }

  return { processed, errors, details };
}
