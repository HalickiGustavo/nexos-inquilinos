import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Resolves the tenants.id row linked to the current logged-in user. */
export function useCurrentTenant() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tenant-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("user_id_link", user!.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useTenantActiveContract() {
  const { data: tenant } = useCurrentTenant();
  return useQuery({
    queryKey: ["tenant-contract", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, property:properties(*)")
        .eq("tenant_id", tenant!.id)
        .eq("active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useTenantInstallments() {
  const { data: contract } = useTenantActiveContract();
  return useQuery({
    queryKey: ["tenant-installments", contract?.id],
    enabled: !!contract?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*")
        .eq("contract_id", contract!.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTenantMaintenances() {
  const { data: tenant } = useCurrentTenant();
  return useQuery({
    queryKey: ["tenant-maintenances", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenances")
        .select("*, property:properties(nickname)")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
