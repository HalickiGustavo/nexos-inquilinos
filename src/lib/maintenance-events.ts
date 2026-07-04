import { supabase } from "@/integrations/supabase/client";

export type MaintenanceEventAction =
  | "created"
  | "status_changed"
  | "responsible_set"
  | "execution_responsible_set"
  | "budget_submitted"
  | "budget_approved"
  | "budget_rejected"
  | "rent_deduction_applied"
  | "evidence_added"
  | "note";

export type MaintenanceEventRow = {
  id: string;
  maintenance_id: string;
  user_id: string | null;
  user_email: string | null;
  actor_role: string | null;
  action: MaintenanceEventAction | string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Fire-and-forget logger. Errors are swallowed to never break the primary write. */
export async function logMaintenanceEvent(input: {
  maintenanceId: string;
  action: MaintenanceEventAction;
  description?: string | null;
  metadata?: Record<string, unknown>;
  actorRole?: "owner" | "tenant" | "landlord" | "manager" | "system";
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    await (supabase.from("maintenance_events" as any) as any).insert({
      maintenance_id: input.maintenanceId,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      actor_role: input.actorRole ?? null,
      action: input.action,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.warn("[maintenance-events] failed to log", err);
  }
}

export async function fetchMaintenanceEvents(maintenanceId: string): Promise<MaintenanceEventRow[]> {
  const { data, error } = await (supabase
    .from("maintenance_events" as any) as any)
    .select("*")
    .eq("maintenance_id", maintenanceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MaintenanceEventRow[];
}
