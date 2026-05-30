import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Property = Tables["properties"]["Row"];
export type Tenant = Tables["tenants"]["Row"];
export type Contract = Tables["contracts"]["Row"];
export type Installment = Tables["installments"]["Row"];
export type Maintenance = Tables["maintenances"]["Row"];

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTenants() {
  return useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
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
        .order("created_at", { ascending: false });
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
        .select("*, contract:contracts(*, property:properties(*), tenant:tenants(*))")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useMaintenances() {
  return useQuery({
    queryKey: ["maintenances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenances")
        .select("*, property:properties(*)")
        .order("created_at", { ascending: false });
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
