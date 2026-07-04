import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const DOCUMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "contrato", label: "Contrato" },
  { value: "escritura", label: "Escritura" },
  { value: "matricula", label: "Matrícula" },
  { value: "iptu", label: "IPTU" },
  { value: "condominio", label: "Condomínio" },
  { value: "seguro", label: "Seguro" },
  { value: "fotos", label: "Fotos" },
  { value: "laudos", label: "Laudos" },
  { value: "habite_se", label: "Habite-se" },
  { value: "comprovantes", label: "Comprovantes" },
  { value: "boletos", label: "Boletos" },
  { value: "notas_fiscais", label: "Notas fiscais" },
  { value: "outros", label: "Outros" },
  { value: "personalizada", label: "Personalizada" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((c) => [c.value, c.label]),
);

export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
];

export const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "docx", "xlsx", "doc", "xls"];

export function extOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function useDocuments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["documents", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents" as any)
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useDocumentEvents(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-events", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_events" as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export async function logDocumentEvent(
  documentId: string,
  userId: string,
  action: "upload" | "edit" | "download" | "delete" | "rename" | "move",
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("document_events" as any).insert({
    document_id: documentId,
    user_id: userId,
    action,
    metadata,
  });
}

export async function getSignedDocumentUrl(path: string, download = false) {
  const opts = download ? { download: true } : undefined;
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 60 * 10, opts as any);
  if (error) throw error;
  return data.signedUrl;
}

export function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
