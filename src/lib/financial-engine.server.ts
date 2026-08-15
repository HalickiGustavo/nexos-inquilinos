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
  const totalCents = Math.round(Number(args.paidAmount) * 100);
  const nexoFeeCents = Math.round(Number(args.nexoFee) * 100);
  
  // Total usable for split is paid amount minus platform fee
  const splitableCents = totalCents - nexoFeeCents;
  
  if (splitableCents < 0) {
    throw new Error("Valor pago insuficiente para cobrir as taxas da plataforma.");
  }

  const agencyCents = Math.round(splitableCents * (args.managementFeePercent / 100));
  const ownerCents = splitableCents - agencyCents;

  // Final validation: sum must match exactly
  if ((nexoFeeCents + agencyCents + ownerCents) !== totalCents) {
     console.error("[computeSplit] Arithmetic mismatch detected", { 
       totalCents, nexoFeeCents, agencyCents, ownerCents, 
       sum: nexoFeeCents + agencyCents + ownerCents 
     });
     // Fallback/safety: adjust owner cents by the discrepancy (usually rounding)
     // but we use Math.round and subtraction so it should be exact.
  }

  return {
    total: totalCents / 100,
    nexo: { amount: nexoFeeCents / 100, pixKey: args.nexoPixKey },
    agency: { amount: agencyCents / 100, pixKey: args.agencyPixKey },
    owner: { amount: ownerCents / 100, pixKey: args.ownerPixKey },
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
