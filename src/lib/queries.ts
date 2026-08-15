import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Property = Tables["properties"]["Row"];
export type Tenant = Tables["tenants"]["Row"];
export type Contract = Tables["contracts"]["Row"];
export type Installment = Tables["installments"]["Row"];
export type Maintenance = Tables["maintenances"]["Row"];

export function useProperties(options?: { limit?: number; offset?: number; search?: string }) {
  return useQuery({
    queryKey: ["properties", options],
    queryFn: async () => {
      let query = supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (options?.search) {
        query = query.or(`nickname.ilike.%${options.search}%,address.ilike.%${options.search}%,code.ilike.%${options.search}%`);
      }
      
      if (options?.limit) {
        query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useTenants(options?: { search?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["tenants", options],
    queryFn: async () => {
      let query = supabase
        .from("tenants")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      
      if (options?.search) {
        query = query.or(`full_name.ilike.%${options.search}%,email.ilike.%${options.search}%,document.ilike.%${options.search}%`);
      }
      
      if (options?.limit) {
        query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useContracts(options?: { active?: boolean; search?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["contracts", options],
    queryFn: async () => {
      let query = supabase
        .from("contracts")
        .select("*, property:properties(id, nickname, address, code), tenant:tenants(id, full_name, email)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      
      if (options?.active !== undefined) {
        query = query.eq("active", options.active);
      }
      
      if (options?.search) {
        query = query.or(`notes.ilike.%${options.search}%`);
      }

      if (options?.limit) {
        query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useInstallments(options?: { status?: Database["public"]["Enums"]["installment_status"]; contractId?: string; from?: string; to?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["installments", options],
    queryFn: async () => {
      let query = supabase
        .from("installments")
        .select(
          "*, contract:contracts(id, property_id, late_fee_percent, daily_interest_percent, property:properties(id, nickname, address, code), tenant:tenants(id, full_name))",
        )
        .order("due_date", { ascending: true });
      
      if (options?.status) {
        query = query.eq("status", options.status);
      }
      if (options?.contractId) {
        query = query.eq("contract_id", options.contractId);
      }
      if (options?.from) {
        query = query.gte("due_date", options.from);
      }
      if (options?.to) {
        query = query.lte("due_date", options.to);
      }

      if (options?.limit) {
        query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
      } else {
        query = query.limit(200);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useMaintenances(options?: { status?: Database["public"]["Enums"]["maintenance_status"]; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["maintenances", options],
    queryFn: async () => {
      let query = supabase
        .from("maintenances")
        .select(
          "*, property:properties(id, nickname, address), contract:contracts(id, active, tenant:tenants(id, full_name))",
        )
        .order("created_at", { ascending: false });

      if (options?.status) {
        query = query.eq("status", options.status);
      }

      if (options?.limit) {
        query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
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
