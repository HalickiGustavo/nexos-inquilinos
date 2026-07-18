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

      // Persistimos TODOS os identificadores retornados pela Efí para que o
      // worker de acompanhamento (`reconcileEfiTransfers`) reuse o mesmo
      // idEnvio/e2eId como fonte de verdade nas próximas consultas.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const nowIso = new Date().toISOString();
      const baseFields: any = {
        efi_id_envio: idEnvio,
        efi_e2e_id: sent.e2eId ?? null,
        efi_status: sent.status,
        efi_status_updated_at: nowIso,
        efi_last_consult_at: nowIso,
        efi_response: sent as any,
        provider_transfer_id: sent.e2eId ?? idEnvio,
      };

      if (sent.status === "REALIZADO") {
        await supabaseAdmin
          .from("payment_transfers")
          .update({
            ...baseFields,
            status: "COMPLETED",
            paid_at: nowIso,
            finished_at: nowIso,
            error_message: null,
            next_retry_at: null,
          } as any)
          .eq("id", row.id);
      } else if (sent.status === "NAO_REALIZADO") {
        const reason =
          (sent as any)?.motivo ??
          (sent as any)?.descricao ??
          "efi pix NAO_REALIZADO";
        await supabaseAdmin
          .from("payment_transfers")
          .update({
            ...baseFields,
            status: "FAILED",
            finished_at: nowIso,
            error_message: String(reason).slice(0, 500),
            next_retry_at: null,
          } as any)
          .eq("id", row.id);
      } else {
        // EM_PROCESSAMENTO — mantém PROCESSING; primeira consulta em 30s.
        await supabaseAdmin
          .from("payment_transfers")
          .update({
            ...baseFields,
            status: "PROCESSING",
            attempts,
            error_message: null,
            next_retry_at: new Date(Date.now() + 30_000).toISOString(),
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

/** Reconcilia repasses PROCESSING consultando o status na Efí.
 *  Delega para `reconcileEfiTransfers` (worker dedicado com backoff). */
export async function reconcileEfiPayouts() {
  const { reconcileEfiTransfers } = await import("./transfer-status-worker.server");
  return reconcileEfiTransfers();
}
