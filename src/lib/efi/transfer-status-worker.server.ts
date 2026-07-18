// Worker de acompanhamento de PIX enviados (Efí Bank).
//
// Baseado no endpoint oficial "Consultar Pix Enviado":
//   GET /v3/gn/pix/enviados/{idEnvio}
//   Docs: https://dev.efipay.com.br/docs/api-pix/pix-envio
//
// Fluxo:
//   1. Após efiPixSend, a linha em payment_transfers fica com status=PROCESSING
//      e recebe: efi_id_envio, efi_e2e_id, efi_status='EM_PROCESSAMENTO',
//      efi_response (payload bruto), efi_status_updated_at, next_retry_at.
//   2. Este worker roda periodicamente e consulta a Efí novamente para cada
//      transferência PROCESSING cujo `next_retry_at` já passou (backoff
//      exponencial: 30s → 1m → 2m → 5m → 10m → 30m → 1h).
//   3. Estados terminais:
//        REALIZADO      → COMPLETED, finished_at, provider_transfer_id=e2eId
//        NAO_REALIZADO  → FAILED,    finished_at, error_message=Efí motivo
//   4. Idempotente: consultas repetidas não alteram registros já finalizados
//      (checa status != PROCESSING antes de gravar), não duplicam eventos e
//      NUNCA enviam um novo PIX.
//   5. Recuperação: como o próprio banco é a fonte para eleger candidatos,
//      após reinício/downtime o worker retoma tudo que estava PROCESSING.
//
// SERVER-ONLY.

import { efiPixSendGet, idEnvioFromTransferId } from "./payouts.server";

const BACKOFF_SECONDS = [30, 60, 120, 300, 600, 1800, 3600];
const BATCH = 40;

function nextRetryDate(attempts: number): string {
  const idx = Math.min(attempts, BACKOFF_SECONDS.length - 1);
  return new Date(Date.now() + BACKOFF_SECONDS[idx] * 1000).toISOString();
}

export type EfiTransferReconcileResult = {
  scanned: number;
  completed: number;
  failed: number;
  stillProcessing: number;
  errors: string[];
};

export async function reconcileEfiTransfers(): Promise<EfiTransferReconcileResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Candidatos: PROCESSING cujo next_retry_at já venceu (ou nunca foi setado).
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("payment_transfers")
    .select("id, attempts, efi_id_envio, efi_status, next_retry_at, provider_transfer_id")
    .eq("status", "PROCESSING")
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("next_retry_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  if (error) {
    console.error("[efi-transfer-status] db list failed", error);
    return { scanned: 0, completed: 0, failed: 0, stillProcessing: 0, errors: [error.message] };
  }

  const rows = (data as any[]) ?? [];
  console.log("[efi-transfer-status] worker start", { candidates: rows.length });

  const result: EfiTransferReconcileResult = {
    scanned: rows.length,
    completed: 0,
    failed: 0,
    stillProcessing: 0,
    errors: [],
  };

  for (const row of rows) {
    const idEnvio: string = row.efi_id_envio || idEnvioFromTransferId(row.id);
    const attempts = Number(row.attempts ?? 0);
    try {
      console.log("[efi-transfer-status] consulting", { id: row.id, idEnvio, attempts });
      const res = await efiPixSendGet(idEnvio);

      const consultedAt = new Date().toISOString();
      if (!res) {
        // 404 na Efí: PIX ainda não indexado (raro logo após envio); reagenda.
        console.warn("[efi-transfer-status] not found on efi", { id: row.id, idEnvio });
        await supabaseAdmin
          .from("payment_transfers")
          .update({
            efi_last_consult_at: consultedAt,
            attempts: attempts + 1,
            next_retry_at: nextRetryDate(attempts),
          } as any)
          .eq("id", row.id)
          .eq("status", "PROCESSING");
        result.stillProcessing += 1;
        continue;
      }

      const prevStatus: string | null = row.efi_status ?? null;
      const statusChanged = prevStatus !== res.status;
      const base: any = {
        efi_status: res.status,
        efi_e2e_id: res.e2eId ?? row.provider_transfer_id ?? null,
        efi_response: res as any,
        efi_last_consult_at: consultedAt,
        ...(statusChanged ? { efi_status_updated_at: consultedAt } : {}),
      };

      console.log("[efi-transfer-status] efi response", {
        id: row.id,
        idEnvio,
        status: res.status,
        e2eId: res.e2eId,
        changed: statusChanged,
      });

      if (res.status === "REALIZADO") {
        await supabaseAdmin
          .from("payment_transfers")
          .update({
            ...base,
            status: "COMPLETED",
            provider_transfer_id: res.e2eId ?? idEnvio,
            paid_at: consultedAt,
            finished_at: consultedAt,
            error_message: null,
            next_retry_at: null,
          } as any)
          .eq("id", row.id)
          .eq("status", "PROCESSING"); // idempotência: só sobrescreve se ainda PROCESSING
        result.completed += 1;
        console.log("[efi-transfer-status] COMPLETED", { id: row.id, e2eId: res.e2eId });
      } else if (res.status === "NAO_REALIZADO") {
        const reason =
          (res as any)?.motivo ??
          (res as any)?.descricao ??
          (res as any)?.reason ??
          "Efí retornou NAO_REALIZADO";
        await supabaseAdmin
          .from("payment_transfers")
          .update({
            ...base,
            status: "FAILED",
            finished_at: consultedAt,
            error_message: String(reason).slice(0, 500),
            next_retry_at: null,
          } as any)
          .eq("id", row.id)
          .eq("status", "PROCESSING");
        result.failed += 1;
        console.warn("[efi-transfer-status] FAILED", { id: row.id, reason });
      } else {
        // EM_PROCESSAMENTO (ou outro estado transitório documentado) — reagenda.
        await supabaseAdmin
          .from("payment_transfers")
          .update({
            ...base,
            attempts: attempts + 1,
            next_retry_at: nextRetryDate(attempts),
          } as any)
          .eq("id", row.id)
          .eq("status", "PROCESSING");
        result.stillProcessing += 1;
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error("[efi-transfer-status] consult failed", row.id, msg);
      result.errors.push(`${row.id}: ${msg}`);
      // Falha de rede/API: não muda status, apenas reagenda com backoff.
      await supabaseAdmin
        .from("payment_transfers")
        .update({
          efi_last_consult_at: new Date().toISOString(),
          attempts: attempts + 1,
          next_retry_at: nextRetryDate(attempts),
          error_message: msg.slice(0, 500),
        } as any)
        .eq("id", row.id)
        .eq("status", "PROCESSING");
    }
  }

  console.log("[efi-transfer-status] worker done", result);
  return result;
}
