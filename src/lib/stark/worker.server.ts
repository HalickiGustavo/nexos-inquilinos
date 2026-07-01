// Worker que drena a fila payment_transfers e envia PIX via Stark.

import { sendPix, getPixRequest } from "./payouts.server";
import {
  claimPendingBatch,
  markProcessing,
  markCompleted,
  markFailed,
} from "./transfers.repo.server";

export async function runPayoutWorker(opts?: { limit?: number }) {
  const batch = await claimPendingBatch(opts?.limit ?? 20);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const row of batch) {
    const attempts = Number(row.attempts ?? 0) + 1;
    try {
      await markProcessing(row.id);

      if (!row.pix_key) {
        throw new Error("beneficiário sem chave PIX");
      }
      if (Number(row.amount) <= 0) {
        await markCompleted(row.id, "SKIPPED_ZERO");
        results.push({ id: row.id, ok: true });
        continue;
      }

      const pix = await sendPix({
        externalId: row.external_id,
        amount: Number(row.amount),
        pixKey: row.pix_key,
        description: row.description ?? "Repasse Nexo",
      });

      // Se já retornar success confirma; senão fica processing → webhook atualiza
      if (pix.status === "success") {
        await markCompleted(row.id, pix.id);
      } else if (pix.status === "failed") {
        await markFailed(row.id, "stark pix-request failed", attempts);
      } else {
        // processing/created — grava id e mantém como PROCESSING p/ webhook fechar
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("payment_transfers")
          .update({
            status: "PROCESSING",
            stark_transfer_id: pix.id,
            attempts,
            error_message: null,
          } as any)
          .eq("id", row.id);
      }
      results.push({ id: row.id, ok: true });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await markFailed(row.id, msg, attempts);
      results.push({ id: row.id, ok: false, error: msg });
    }
  }
  return { processed: batch.length, results };
}

// Reconciliação — verifica PROCESSING que já podem ter fechado
export async function reconcileProcessing() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("payment_transfers")
    .select("id, stark_transfer_id, attempts")
    .eq("status", "PROCESSING")
    .not("stark_transfer_id", "is", null)
    .limit(50);

  for (const row of ((data as any[]) ?? [])) {
    try {
      const res = await getPixRequest(row.stark_transfer_id);
      const st = res.pixRequest?.status;
      if (st === "success") await markCompleted(row.id, row.stark_transfer_id);
      else if (st === "failed")
        await markFailed(row.id, "pix-request failed (reconcile)", Number(row.attempts ?? 0) + 1);
    } catch (e: any) {
      console.warn("[reconcile] failed to fetch", row.id, e?.message);
    }
  }
}
