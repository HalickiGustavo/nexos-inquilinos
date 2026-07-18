// Worker que drena payment_transfers PENDING e envia PIX via Efí Bank.
// Reutiliza claim/mark helpers de `stark/transfers.repo.server.ts` (idempotência
// atômica via `claim_pending_transfers` + FOR UPDATE SKIP LOCKED).

import {
  claimPendingBatch,
  markProcessing,
  markCompleted,
  markFailed,
} from "@/lib/stark/transfers.repo.server";
import { efiPixSend, efiPixSendGet, idEnvioFromTransferId } from "./payouts.server";

const NEXO_PIX_KEY = () =>
  process.env.EFI_PIX_KEY ?? process.env.NEXO_MASTER_WALLET_ID ?? "";

export async function runEfiPayoutWorker(opts?: { limit?: number }) {
  const batch = await claimPendingBatch(opts?.limit ?? 20);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  const payerKey = NEXO_PIX_KEY();
  if (!payerKey) {
    console.error("[efi-payout] EFI_PIX_KEY não configurada — abortando");
    return { processed: 0, results: [], error: "EFI_PIX_KEY missing" };
  }
  console.log("[efi-payout] worker start", { claimed: batch.length });

  for (const row of batch as any[]) {
    const attempts = Number(row.attempts ?? 0) + 1;
    try {
      await markProcessing(row.id);

      if (!row.pix_key) throw new Error("beneficiário sem chave PIX");
      if (Number(row.amount) <= 0) {
        await markCompleted(row.id, "SKIPPED_ZERO");
        results.push({ id: row.id, ok: true });
        continue;
      }
      // NEXO fica na conta principal — não deve gerar transferência de saída
      if (row.recipient_type === "nexo") {
        await markCompleted(row.id, `nexo-${row.installment_id}`);
        results.push({ id: row.id, ok: true });
        continue;
      }

      const idEnvio = idEnvioFromTransferId(row.id);
      console.log("[efi-payout] sending", {
        transferId: row.id,
        recipient: row.recipient_type,
        amount: row.amount,
        idEnvio,
      });
      let sent = await efiPixSend({
        idEnvio,
        amount: Number(row.amount),
        payerPixKey: payerKey,
        receiverPixKey: row.pix_key,
        description: row.description ?? "Repasse Nexo",
      }).catch(async (err: any) => {
        // Se a Efí retorna "envio duplicado" (idempotência), tenta consultar
        if (err?.status === 409 || err?.body?.nome === "envio_duplicado") {
          console.warn("[efi-payout] duplicate send, consulting", { transferId: row.id });
          return efiPixSendGet(idEnvio);
        }
        throw err;
      });

      if (!sent) throw new Error("Envio PIX Efí sem retorno");
      console.log("[efi-payout] efi response", {
        transferId: row.id,
        status: sent.status,
        e2eId: sent.e2eId,
      });

      if (sent.status === "REALIZADO") {
        await markCompleted(row.id, sent.e2eId ?? idEnvio);
      } else if (sent.status === "NAO_REALIZADO") {
        await markFailed(row.id, "efi pix NAO_REALIZADO", attempts);
      } else {
        // EM_PROCESSAMENTO — mantém PROCESSING, grava e2eId para reconciliar
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("payment_transfers")
          .update({
            status: "PROCESSING",
            provider_transfer_id: sent.e2eId ?? idEnvio,
            attempts,
            error_message: null,
          } as any)
          .eq("id", row.id);
      }
      results.push({ id: row.id, ok: true });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error("[efi-payout] transfer failed", row.id, msg);
      await markFailed(row.id, msg, attempts);
      results.push({ id: row.id, ok: false, error: msg });
    }
  }
  console.log("[efi-payout] worker done", { processed: batch.length });
  return { processed: batch.length, results };
}

/** Reconcilia repasses PROCESSING consultando o status na Efí. */
export async function reconcileEfiPayouts() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("payment_transfers")
    .select("id, provider_transfer_id, attempts")
    .eq("status", "PROCESSING")
    .not("provider_transfer_id", "is", null)
    .limit(50);

  const rows = ((data as any[]) ?? []);
  console.log("[efi-reconcile] start", { processing: rows.length });
  for (const row of rows) {
    try {
      const idEnvio = idEnvioFromTransferId(row.id);
      const res = await efiPixSendGet(idEnvio);
      if (!res) {
        console.warn("[efi-reconcile] no efi record", { transferId: row.id, idEnvio });
        continue;
      }
      console.log("[efi-reconcile] efi status", {
        transferId: row.id,
        idEnvio,
        status: res.status,
        e2eId: res.e2eId,
      });
      if (res.status === "REALIZADO") {
        await markCompleted(row.id, res.e2eId ?? idEnvio);
      } else if (res.status === "NAO_REALIZADO") {
        await markFailed(row.id, "efi pix NAO_REALIZADO (reconcile)", Number(row.attempts ?? 0) + 1);
      }
    } catch (e: any) {
      console.warn("[efi-reconcile] fetch failed", row.id, e?.message);
    }
  }
}
