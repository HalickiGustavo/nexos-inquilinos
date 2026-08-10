import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SplitResult = {
  total: number;
  nexo: { amount: number; pixKey: string | null };
  agency: { amount: number; pixKey: string | null };
  owner: { amount: number; pixKey: string | null };
};

export function computeSplit(args: {
  paidAmount: number;
  nexoFee: number;
  managementFeePercent: number;
  agencyPixKey: string | null;
  ownerPixKey: string | null;
  nexoPixKey: string | null;
}): SplitResult {
  const total = Number(args.paidAmount);
  const nexoFee = Number(args.nexoFee);
  const rentAmount = total - nexoFee;
  
  const agencyAmount = Number((rentAmount * (args.managementFeePercent / 100)).toFixed(2));
  const ownerAmount = Number((rentAmount - agencyAmount).toFixed(2));

  return {
    total,
    nexo: { amount: nexoFee, pixKey: args.nexoPixKey },
    agency: { amount: agencyAmount, pixKey: args.agencyPixKey },
    owner: { amount: ownerAmount, pixKey: args.ownerPixKey },
  };
}

export async function claimPendingBatch(limit = 20) {
  const { data, error } = await supabaseAdmin.rpc("claim_pending_transfers", {
    _limit: limit,
  });
  if (error) throw error;
  return (data || []) as any[];
}

export async function markProcessing(transferId: string) {
  await supabaseAdmin
    .from("payment_transfers")
    .update({ status: "PROCESSING", started_at: new Date().toISOString() } as any)
    .eq("id", transferId);
}

export async function markCompleted(transferId: string, providerId: string) {
  await supabaseAdmin
    .from("payment_transfers")
    .update({
      status: "COMPLETED",
      finished_at: new Date().toISOString(),
      provider_transfer_id: providerId,
    } as any)
    .eq("id", transferId);
}

export async function markFailed(transferId: string, error: string, attempts: number) {
  const nextRetry = new Date();
  nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, attempts) * 5);

  await supabaseAdmin
    .from("payment_transfers")
    .update({
      status: "PENDING",
      error_message: error,
      attempts,
      next_retry_at: nextRetry.toISOString(),
    } as any)
    .eq("id", transferId);
}

export async function enqueueTransfersForSplit(
  split: SplitResult,
  meta: {
    installmentId: string;
    contractId: string;
    managerUserId: string;
    agencyUserId: string;
    ownerUserId: string | null;
    description: string;
  }
) {
  const transfers: any[] = [
    {
      installment_id: meta.installmentId,
      contract_id: meta.contractId,
      manager_user_id: meta.managerUserId,
      recipient_type: "nexo",
      recipient_id: "PLATFORM",
      amount: split.nexo.amount,
      pix_key: split.nexo.pixKey,
      description: meta.description + " (Plataforma)",
      status: "PENDING",
      external_id: `nexo-${meta.installmentId}`,
    },
    {
      installment_id: meta.installmentId,
      contract_id: meta.contractId,
      manager_user_id: meta.managerUserId,
      recipient_type: "agency",
      recipient_id: meta.agencyUserId,
      amount: split.agency.amount,
      pix_key: split.agency.pixKey,
      description: meta.description + " (Imobiliária)",
      status: "PENDING",
      external_id: `agency-${meta.installmentId}`,
    },
  ];

  if (meta.ownerUserId && split.owner.amount > 0) {
    transfers.push({
      installment_id: meta.installmentId,
      contract_id: meta.contractId,
      manager_user_id: meta.managerUserId,
      recipient_type: "landlord",
      recipient_id: meta.ownerUserId,
      amount: split.owner.amount,
      pix_key: split.owner.pixKey,
      description: meta.description + " (Proprietário)",
      status: "PENDING",
      external_id: `landlord-${meta.installmentId}`,
    });
  }

  for (const t of transfers) {
    await supabaseAdmin.from("payment_transfers").upsert(t, { onConflict: "external_id" });
  }
}
