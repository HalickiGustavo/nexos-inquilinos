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

type PayoutAttempt = { recipient: "agency" | "owner"; ok: boolean; pending?: boolean; error?: string };

function buildIdEnvio(splitId: string, recipient: "agency" | "owner") {
  return `nx${String(splitId).replace(/-/g, "").slice(0, 20)}${recipient.slice(0, 2)}`;
}

async function dispatchSplitPayout(split: any): Promise<{ ok: boolean; pending: boolean; error?: string; attempts: PayoutAttempt[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchSentPixByIdEnvio, sendPix } = await import("./efi.server");

  const targets: Array<{ recipient: "agency" | "owner"; pixKey: string | null; amount: number }> = [
    { recipient: "agency", pixKey: split.agency_pix_key, amount: Number(split.agency_amount) },
    { recipient: "owner", pixKey: split.owner_pix_key, amount: Number(split.owner_amount) },
  ];

  const attempts: PayoutAttempt[] = [];
  let allOk = true;
  let hasPending = false;
  let lastErr: string | null = null;

  for (const t of targets) {
    if (!t.pixKey || t.amount <= 0) continue;

    const idEnvio = buildIdEnvio(split.id, t.recipient);

    // Idempotência por destinatário: se já existe repasse concluído, pula; se
    // ainda está processando, consulta a Efí antes de considerar concluído.
    const { data: existing } = await supabaseAdmin
      .from("efi_payouts")
      .select("id, status")
      .eq("pix_split_id", split.id)
      .eq("recipient", t.recipient)
      .in("status", ["pending", "processing", "mock_sent", "paid", "completed"])
      .maybeSingle();
    if (existing) {
      if (["mock_sent", "paid", "completed"].includes(existing.status)) {
        attempts.push({ recipient: t.recipient, ok: true });
        continue;
      }

      try {
        const status = await fetchSentPixByIdEnvio(idEnvio);
        if (status.status === "COMPLETED") {
          await supabaseAdmin
            .from("efi_payouts")
            .update({
              e2e_id: status.e2eId,
              status: "completed",
              paid_at: status.paidAt ?? new Date().toISOString(),
              error: null,
            })
            .eq("id", existing.id);
          attempts.push({ recipient: t.recipient, ok: true });
          continue;
        }
        if (status.status === "FAILED") {
          await supabaseAdmin
            .from("efi_payouts")
            .update({ status: "failed", error: `Efí confirmou falha no envio Pix (${status.rawStatus})` })
            .eq("id", existing.id);
        } else {
          allOk = false;
          hasPending = true;
          lastErr = `Repasse Pix ainda em processamento na Efí (${status.rawStatus || "sem status"})`;
          attempts.push({ recipient: t.recipient, ok: false, pending: true, error: lastErr });
          continue;
        }
      } catch (innerErr: any) {
        allOk = false;
        hasPending = true;
        lastErr = `Aguardando confirmação real do repasse Pix na Efí: ${innerErr?.message ?? String(innerErr)}`;
        attempts.push({ recipient: t.recipient, ok: false, pending: true, error: lastErr });
        continue;
      }
    }

    // 1) Cria registro PENDING antes de chamar a API (auditoria + retry).
    const { data: pendingRow, error: insertErr } = await supabaseAdmin
      .from("efi_payouts")
      .insert({
        pix_split_id: split.id,
        user_id: split.user_id,
        recipient: t.recipient,
        pix_key: t.pixKey,
        amount: t.amount,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !pendingRow) {
      allOk = false;
      lastErr = insertErr?.message ?? "Falha ao registrar repasse pendente";
      attempts.push({ recipient: t.recipient, ok: false, error: lastErr });
      continue;
    }

    try {
      const res = await sendPix({
        idEnvio,
        amount: t.amount,
        pixKey: t.pixKey,
        description: `Repasse Nexo - ${t.recipient === "agency" ? "Administracao" : "Proprietario"}`,
      });
      // 2) A Efí pode retornar apenas EM_PROCESSAMENTO. Só marcamos como
      // completed quando houver liquidação real/REALIZADO; caso contrário fica
      // processing até webhook/consulta confirmar.
      const completed = res.status === "COMPLETED" || res.status === "MOCK";
      await supabaseAdmin
        .from("efi_payouts")
        .update({
          e2e_id: res.e2eId,
          status: res.status === "MOCK" ? "mock_sent" : completed ? "completed" : "processing",
          paid_at: completed ? new Date().toISOString() : null,
          error: null,
        })
        .eq("id", pendingRow.id);
      if (completed) {
        attempts.push({ recipient: t.recipient, ok: true });
      } else {
        allOk = false;
        hasPending = true;
        lastErr = "Repasse Pix enviado para a Efí e aguardando confirmação de liquidação.";
        attempts.push({ recipient: t.recipient, ok: false, pending: true, error: lastErr });
      }
    } catch (innerErr: any) {
      // 3) Falha: FAILED + mensagem completa; permanece elegível p/ retry.
      allOk = false;
      const efiDebug = innerErr?.efiDebug
        ? ` | debug=${JSON.stringify(innerErr.efiDebug).slice(0, 800)}`
        : "";
      lastErr = `${innerErr?.message ?? String(innerErr)}${efiDebug}`;
      await supabaseAdmin
        .from("efi_payouts")
        .update({ status: "failed", error: lastErr })
        .eq("id", pendingRow.id);
      attempts.push({ recipient: t.recipient, ok: false, error: lastErr ?? undefined });
    }
  }

  const out: { ok: boolean; pending: boolean; error?: string; attempts: PayoutAttempt[] } = { ok: allOk, pending: hasPending, attempts };
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

  if (result.pending) {
    await supabaseAdmin
      .from("pix_splits")
      .update({
        payout_status: "processing",
        payout_error: result.error ?? "Repasse Pix aguardando confirmação real da Efí",
      })
      .eq("id", splitId);
    return { ok: false, claimed: true, error: result.error };
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
    .in("payout_status", ["scheduled", "processing"])
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
