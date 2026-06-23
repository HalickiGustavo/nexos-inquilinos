import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "owner" | "tenant" | "manager" | "landlord";

export function useUserRole() {
  const { user, loading } = useAuth();
  const q = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AppRole> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const roles = (data ?? []).map((r: any) => r.role);
      // Ordem de prioridade: manager > landlord > tenant > owner
      if (roles.includes("manager")) return "manager";
      if (roles.includes("landlord")) return "landlord";
      if (roles.includes("tenant")) return "tenant";
      return "owner";
    },
  });
  return { role: q.data, loading: loading || q.isLoading };
}

export function roleHomePath(role: AppRole | undefined): string {
  switch (role) {
    case "manager": return "/manager";
    case "landlord": return "/landlord";
    case "tenant": return "/tenant";
    default: return "/dashboard";
  }
}
