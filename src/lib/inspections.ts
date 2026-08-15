import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InspectionKind = "entrada" | "saida";
export type InspectionCondition = "otimo" | "bom" | "regular" | "ruim";
export type InspectionStatus = "rascunho" | "assinada";

export type InspectionRoom = {
  name: string;
  condition: InspectionCondition;
  items: string;
  notes?: string;
};

export const DEFAULT_ROOMS: InspectionRoom[] = [
  { name: "Sala", condition: "bom", items: "" },
  { name: "Cozinha", condition: "bom", items: "" },
  { name: "Quarto 1", condition: "bom", items: "" },
  { name: "Banheiro", condition: "bom", items: "" },
  { name: "Área de serviço", condition: "bom", items: "" },
];

export const KIND_LABEL: Record<InspectionKind, string> = {
  entrada: "Vistoria de Entrada",
  saida: "Vistoria de Saída",
};

export const COND_LABEL: Record<InspectionCondition, string> = {
  otimo: "Ótimo",
  bom: "Bom",
  regular: "Regular",
  ruim: "Ruim",
};

export const STATUS_LABEL: Record<InspectionStatus, string> = {
  rascunho: "Rascunho",
  assinada: "Assinada",
};

export function parseRooms(value: unknown): InspectionRoom[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is InspectionRoom => !!r && typeof r === "object" && "name" in r);
}

export function useInspections(options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["inspections", options],
    queryFn: async () => {
      let query = supabase
        .from("inspections")
        .select("*, contract:contracts(*, property:properties(nickname, address), tenant:tenants(full_name))")
        .order("created_at", { ascending: false });

      if (options?.limit) {
        const from = options.offset || 0;
        const to = from + options.limit - 1;
        query = query.range(from, to);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTenantInspections(contractId: string | undefined) {
  return useQuery({
    queryKey: ["tenant-inspections", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("*")
        .eq("contract_id", contractId!)
        .order("inspection_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function getSignedPdfUrl(path: string) {
  const { data, error } = await supabase.storage.from("inspections").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
