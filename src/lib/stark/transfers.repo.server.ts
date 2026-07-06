// TransferRepository — cria/atualiza linhas em payment_transfers.

import type { SplitResult } from "./split-engine";

type SplitContext = {
  installmentId: string;
  contractId: string;
  managerUserId: string;
  agencyUserId?: string | null;
  ownerUserId?: string | null;
  description?: string;
};

export async function enqueueTransfersForSplit(split: SplitResult, ctx: SplitContext) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rows: any[] = [];

  // nexo: fica na conta principal, sem transfer — registramos como COMPLETED só p/ auditoria
  if (split.nexo.amount > 0) {
    rows.push({
      installment_id: ctx.installmentId,
      contract_id: ctx.contractId,
      manager_user_id: ctx.managerUserId,
      recipient_type: "nexo",
      recipient_user_id: null,
      pix_key: split.nexo.pixKey,
      amount: split.nexo.amount,
      description: ctx.description ?? "Taxa Nexo",
      status: "COMPLETED",
      external_id: `nexo-${ctx.installmentId}`,
      paid_at: new Date().toISOString(),
    });
  }

  if (split.agency.amount > 0 && split.agency.pixKey) {
    rows.push({
      installment_id: ctx.installmentId,
      contract_id: ctx.contractId,
      manager_user_id: ctx.managerUserId,
      recipient_type: "agency",
      recipient_user_id: ctx.agencyUserId ?? null,
      pix_key: split.agency.pixKey,
      amount: split.agency.amount,
      description: ctx.description ?? "Comissão de administração",
      status: "PENDING",
      external_id: `agency-${ctx.installmentId}`,
    });
  }

  if (split.owner.amount > 0 && split.owner.pixKey) {
    rows.push({
      installment_id: ctx.installmentId,
      contract_id: ctx.contractId,
      manager_user_id: ctx.managerUserId,
      recipient_type: "owner",
      recipient_user_id: ctx.ownerUserId ?? null,
      pix_key: split.owner.pixKey,
      amount: split.owner.amount,
      description: ctx.description ?? "Repasse aluguel",
      status: "PENDING",
      external_id: `owner-${ctx.installmentId}`,
    });
  }

  if (!rows.length) return { inserted: 0 };
  // idempotência: external_id UNIQUE
  const { error } = await supabaseAdmin
    .from("payment_transfers")
    .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true } as any);
  if (error) throw new Error(error.message);
  return { inserted: rows.length };
}

export async function claimPendingBatch(limit = 20) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Atomic claim via SQL FOR UPDATE SKIP LOCKED — impede que dois workers
  // rodando em paralelo tentem processar a mesma linha (dupla transferência).
  const { data, error } = await supabaseAdmin.rpc("claim_pending_transfers", {
    _limit: limit,
  });
  if (error) throw new Error(error.message);
  return ((data as any[]) ?? []);
}

export async function markProcessing(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("payment_transfers")
    .update({ status: "PROCESSING", attempts: (undefined as any) } as any)
    .eq("id", id);
}

export async function markCompleted(id: string, starkTransferId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("payment_transfers")
    .update({
      status: "COMPLETED",
      stark_transfer_id: starkTransferId,
      paid_at: new Date().toISOString(),
      error_message: null,
    } as any)
    .eq("id", id);
}

export async function markFailed(id: string, err: string, attempts: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const maxAttempts = 5;
  const next = attempts >= maxAttempts ? null :
    new Date(Date.now() + Math.pow(2, attempts) * 60_000).toISOString(); // backoff min
  await supabaseAdmin
    .from("payment_transfers")
    .update({
      status: attempts >= maxAttempts ? "FAILED" : "PENDING",
      attempts,
      next_retry_at: next,
      error_message: err.slice(0, 500),
    } as any)
    .eq("id", id);
}
