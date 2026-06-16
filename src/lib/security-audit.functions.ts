import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Runs the database security invariants check.
 * Only manager or owner roles may invoke. Uses service_role under the hood
 * because verify_security_invariants() is locked to service_role.
 */
export const runSecurityInvariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    // Role gate
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) throw rolesErr;
    const allowed = (roles ?? []).some(
      (r: { role: string }) => r.role === "manager" || r.role === "owner",
    );
    if (!allowed) throw new Error("Forbidden");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin.rpc(
      "verify_security_invariants" as never,
    );
    if (error) throw error;
    return { ok: true, checks: data };
  });

/**
 * Probe used by tests / admin UI to confirm that the calling user CANNOT
 * read audit_logs unless they are manager/owner, and cannot see another
 * tenant's data. Returns counts as observed under RLS for the caller.
 */
export const probeRlsForCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const results: Record<
      string,
      { rows: number | null; error: string | null }
    > = {};

    async function probe(table: string) {
      const { count, error } = await supabase
        .from(table as never)
        .select("*", { count: "exact", head: true });
      results[table] = {
        rows: count ?? null,
        error: error ? error.message : null,
      };
    }

    await probe("audit_logs");
    await probe("maintenances");
    await probe("properties");
    await probe("contracts");
    await probe("installments");
    await probe("tenants");

    return { userId, observed: results };
  });
