import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Soft-delete a tenant. Blocked if any active, non-deleted contract is bound.
 * Also marks expired/terminated contracts of the tenant as deleted for tidy views.
 */
export const softDeleteTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tenantId: string }) => {
    if (!data?.tenantId || typeof data.tenantId !== "string") {
      throw new Error("tenantId obrigatório");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Step 1 — confirm tenant ownership and not already deleted
    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, full_name, deleted_at, user_id")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tenant) throw new Error("Inquilino não encontrado.");
    if (tenant.deleted_at) {
      return { ok: true, alreadyDeleted: true as const };
    }

    // Step 2 — abort if any active, non-deleted contract exists
    const { data: active, error: cErr } = await supabase
      .from("contracts")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .eq("active", true)
      .is("deleted_at", null)
      .limit(1);
    if (cErr) throw new Error(cErr.message);
    if (active && active.length > 0) {
      throw new Error(
        "ACTIVE_CONTRACT: Não é possível excluir: este inquilino possui um contrato ativo vinculado. Encerre o contrato antes de removê-lo.",
      );
    }

    const now = new Date().toISOString();

    // Step 3 — soft-delete tenant + any non-active legacy contracts
    const { error: updTenant } = await supabase
      .from("tenants")
      .update({ deleted_at: now })
      .eq("id", data.tenantId)
      .is("deleted_at", null);
    if (updTenant) throw new Error(updTenant.message);

    const { error: updContracts } = await supabase
      .from("contracts")
      .update({ deleted_at: now, active: false })
      .eq("tenant_id", data.tenantId)
      .is("deleted_at", null);
    if (updContracts) throw new Error(updContracts.message);

    return { ok: true as const, tenantId: data.tenantId, deletedAt: now, by: userId };
  });
