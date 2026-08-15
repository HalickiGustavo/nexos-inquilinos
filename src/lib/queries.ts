import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Property = Tables["properties"]["Row"];
export type Tenant = Tables["tenants"]["Row"];
export type Contract = Tables["contracts"]["Row"];
export type Installment = Tables["installments"]["Row"];
export type Maintenance = Tables["maintenances"]["Row"];

// NOTE: select('*') intencional para preservar tipos gerados; ganhos de perf vêm de
// staleTime (60s default), gcTime e limites server-side abaixo.

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

export function useTenants() {
  return useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, property:properties(*), tenant:tenants(*)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
}

export function useInstallments() {
  return useQuery({
    queryKey: ["installments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select(
          "*, contract:contracts(id, property_id, late_fee_percent, daily_interest_percent, property:properties(id, nickname, address), tenant:tenants(id, full_name))",
        )
        .order("due_date", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });
}

export function useMaintenances() {
  return useQuery({
    queryKey: ["maintenances"],
    queryFn: async () => {
      // property:properties(*) reduzido para os campos exibidos na listagem.
      const { data, error } = await supabase
        .from("maintenances")
        .select(
          "*, property:properties(id, nickname, address), contract:contracts(id, start_date, end_date, rent_amount, active, tenant:tenants(id, full_name))",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
}



export function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[] = ["properties", "tenants", "contracts", "installments", "maintenances"]) => {
    keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
}

export { useMutation };
