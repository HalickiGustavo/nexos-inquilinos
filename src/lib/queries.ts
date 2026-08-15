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

export function useProperties(page = 0, pageSize = 20, search = "", status = "") {
  return useQuery({
    queryKey: ["properties", page, pageSize, search, status],
    queryFn: async () => {
      let query = supabase
        .from("properties")
        .select("*", { count: "exact" });
      
      if (search) {
        query = query.or(`nickname.ilike.%${search}%,address.ilike.%${search}%`);
      }
      
      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
        
      if (error) throw error;
      return { data, count };
    },
  });
}

export function useTenants(page = 0, pageSize = 20, search = "") {
  return useQuery({
    queryKey: ["tenants", page, pageSize, search],
    queryFn: async () => {
      let query = supabase
        .from("tenants")
        .select("*", { count: "exact" })
        .is("deleted_at", null);
      
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,document.ilike.%${search}%`);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
        
      if (error) throw error;
      return { data, count };
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

export function useInstallments(page = 0, pageSize = 20, status = "", fromDate = "", toDate = "") {
  return useQuery({
    queryKey: ["installments", page, pageSize, status, fromDate, toDate],
    queryFn: async () => {
      let query = supabase
        .from("installments")
        .select(
          "*, contract:contracts(id, property_id, late_fee_percent, daily_interest_percent, property:properties(id, nickname, address), tenant:tenants(id, full_name))",
          { count: "exact" }
        );
      
      if (status && status !== "todos") {
        query = query.eq("status", status);
      }
      
      if (fromDate) query = query.gte("due_date", fromDate);
      if (toDate) query = query.lte("due_date", toDate);

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("due_date", { ascending: true })
        .range(from, to);
        
      if (error) throw error;
      return { data, count };
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
