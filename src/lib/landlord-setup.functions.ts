import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const activateLandlordRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    const { data: existing, error: exErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (exErr) throw new Error(exErr.message);

    const roles = new Set((existing ?? []).map((r: any) => r.role));
    if (roles.has("landlord")) {
      return { ok: true, alreadyLandlord: true };
    }
    
    // Check for conflicts. A landlord can potentially also be a tenant or owner (standard), 
    // but usually not a manager in this business logic.
    if (roles.has("manager")) {
      throw new Error(
        "Esta conta já possui perfil de imobiliária e não pode ser convertida em proprietário autônomo.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "landlord" as const });
      
    if (error && (error as any).code !== "23505") {
      throw new Error(error.message);
    }
    return { ok: true, alreadyLandlord: false };
  });
