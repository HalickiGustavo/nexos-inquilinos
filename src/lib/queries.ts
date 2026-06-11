import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Property = Tables["properties"]["Row"];
export type Tenant = Tables["tenants"]["Row"];
export type Contract = Tables["contracts"]["Row"];
export type Installment = Tables["installments"]["Row"];
export type Maintenance = Tables["maintenances"]["Row"];

// Column selections — explicit, narrow, server-side. Avoids transferring blob/notes payloads.
const PROPERTY_COLS =
  "id,code,nickname,address,city,state,zip,status,owner_name,owner_doc,owner_commission_percent,created_at";
const TENANT_COLS = "id,full_name,document,email,phone,user_id_link,created_at";
const CONTRACT_COLS =
  "id,property_id,tenant_id,start_date,end_date,rent_amount,due_day,active,management_fee_percent,created_at";
const INSTALLMENT_COLS =
  "id,contract_id,due_date,amount,paid_amount,payment_date,status,payout_status,payout_date,management_fee_percent,variable_expenses";
const MAINTENANCE_COLS = "id,property_id,tenant_id,title,description,status,priority,created_at";

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(PROPERTY_COLS)
        .order("created_at", { ascending: false })
        .limit(500);
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
        .select(TENANT_COLS)
        .order("created_at", { ascending: false })
        .limit(500);
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
        .select(
          `${CONTRACT_COLS},property:properties(${PROPERTY_COLS}),tenant:tenants(${TENANT_COLS})`,
        )
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
          `${INSTALLMENT_COLS},contract:contracts(${CONTRACT_COLS},property:properties(${PROPERTY_COLS}),tenant:tenants(${TENANT_COLS}))`,
        )
        .order("due_date", { ascending: true })
        .limit(1000);
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
        .select(`${MAINTENANCE_COLS},property:properties(${PROPERTY_COLS})`)
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
