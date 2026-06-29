/**
 * Repasse Pix automatizado D+1 para boletos Efí pagos.
 * Cria registros em `efi_payouts` e dispara `sendPix` para imobiliária e proprietário.
 * Server-only — chamada exclusivamente pelo cron `process-efi-payouts`.
 */
export async function runProcessEfiBoletoPayouts(): Promise<{
  processed: number;
  errors: number;
  details: Array<{ pix_split_id: string; ok: boolean; error?: string }>;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPix } = await import("./efi.server");

  const today = new Date().toISOString().slice(0, 10);
  const { data: pending, error } = await supabaseAdmin
    .from("pix_splits")
    .select("*")
    .in("charge_type", ["pix", "boleto"])
    .eq("status", "paid")
    .eq("payout_status", "scheduled")
    .lte("payout_scheduled_for", today)
    .limit(50);

  if (error) throw new Error(error.message);

  const details: Array<{ pix_split_id: string; ok: boolean; error?: string }> = [];
  let processed = 0;
  let errors = 0;

  for (const split of pending ?? []) {
    try {
      const targets: Array<{ recipient: "agency" | "owner"; pixKey: string | null; amount: number }> = [
        { recipient: "agency", pixKey: split.agency_pix_key, amount: Number(split.agency_amount) },
        { recipient: "owner", pixKey: split.owner_pix_key, amount: Number(split.owner_amount) },
      ];

      let allOk = true;
      let lastErr: string | null = null;

      for (const t of targets) {
        if (!t.pixKey || t.amount <= 0) continue;
        const idEnvio = `nx${split.id.replace(/-/g, "").slice(0, 20)}${t.recipient.slice(0, 2)}`;
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
        }
      }

      await supabaseAdmin
        .from("pix_splits")
        .update({
          payout_status: allOk ? "paid" : "failed",
          payout_error: allOk ? null : lastErr,
        })
        .eq("id", split.id);

      processed++;
      details.push({ pix_split_id: split.id, ok: allOk, error: lastErr ?? undefined });
      if (!allOk) errors++;
    } catch (e: any) {
      errors++;
      details.push({ pix_split_id: split.id, ok: false, error: e?.message ?? String(e) });
    }
  }

  return { processed, errors, details };
}
