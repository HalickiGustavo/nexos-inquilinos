import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  FileType,
  Search,
  Download,
  Eye,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenantActiveContract } from "@/lib/tenant-queries";
import { CATEGORY_LABEL, getSignedDocumentUrl } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tenant/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos — Nexo Inquilino" },
      { name: "description", content: "Documentos disponibilizados pela imobiliária ou proprietário para o seu contrato." },
    ],
  }),
  component: TenantDocumentos,
});

type SortKey = "recent" | "oldest" | "name" | "category";

function iconOf(mime?: string | null, ext?: string | null) {
  const e = (ext ?? "").toLowerCase();
  if (mime?.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(e))
    return { Icon: FileImage, tint: "text-violet-500" };
  if (mime === "application/pdf" || e === "pdf") return { Icon: FileType, tint: "text-red-500" };
  if (["xlsx", "xls", "csv"].includes(e) || (mime ?? "").includes("sheet"))
    return { Icon: FileSpreadsheet, tint: "text-emerald-600" };
  if (["doc", "docx"].includes(e) || (mime ?? "").includes("word"))
    return { Icon: FileText, tint: "text-sky-600" };
  return { Icon: FileIcon, tint: "text-muted-foreground" };
}

function formatSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function useContractDocuments(contractId?: string) {
  return useQuery({
    queryKey: ["tenant-documents", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents" as any)
        .select("*, uploader:profiles!documents_user_id_fkey(full_name, email)")
        .eq("contract_id", contractId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) {
        // profiles join may fail; fallback without it
        const fallback = await supabase
          .from("documents" as any)
          .select("*")
          .eq("contract_id", contractId!)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (fallback.error) throw fallback.error;
        return (fallback.data ?? []) as any[];
      }
      return (data ?? []) as any[];
    },
  });
}

function TenantDocumentos() {
  const { data: contract, isLoading: loadingContract } = useTenantActiveContract();
  const { data: docs = [], isLoading } = useContractDocuments(contract?.id);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let arr = [...docs];
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((d) => (d.name ?? "").toLowerCase().includes(s));
    }
    if (cat !== "all") arr = arr.filter((d) => d.category === cat);
    arr.sort((a, b) => {
      if (sort === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sort === "category")
        return (CATEGORY_LABEL[a.category] ?? "").localeCompare(CATEGORY_LABEL[b.category] ?? "");
      const av = new Date(a.created_at).getTime();
      const bv = new Date(b.created_at).getTime();
      return sort === "oldest" ? av - bv : bv - av;
    });
    return arr;
  }, [docs, q, cat, sort]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach((d) => {
      const key = d.category ?? "outros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const categoriesInList = useMemo(() => {
    const set = new Set<string>(docs.map((d) => d.category ?? "outros"));
    return Array.from(set);
  }, [docs]);

  const openFile = async (d: any, download = false) => {
    setBusyId(d.id);
    try {
      const url = await getSignedDocumentUrl(d.storage_path, download);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Não foi possível abrir o arquivo. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderOpen className="size-6 text-primary" /> Documentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Arquivos disponibilizados pela imobiliária ou proprietário para o seu contrato.
        </p>
      </header>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <div className="relative min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome"
              className="pl-8"
            />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="sm:w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categoriesInList.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="sm:w-[160px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recente</SelectItem>
              <SelectItem value="oldest">Mais antigo</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="category">Categoria</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* States */}
      {(loadingContract || isLoading) && (
        <Card className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando documentos…
        </Card>
      )}

      {!isLoading && !loadingContract && !contract && (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum contrato ativo encontrado.
        </Card>
      )}

      {!isLoading && contract && filtered.length === 0 && (
        <Card className="p-10 text-center">
          <FolderOpen className="size-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">
            {docs.length === 0
              ? "Ainda não há documentos disponíveis para este contrato."
              : "Nenhum documento corresponde à busca."}
          </p>
          {docs.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Quando a imobiliária ou o proprietário disponibilizar arquivos, eles aparecerão aqui.
            </p>
          )}
        </Card>
      )}

      {/* Grouped list */}
      {!isLoading && grouped.length > 0 && (
        <div className="space-y-5">
          {grouped.map(([category, items]) => (
            <section key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{CATEGORY_LABEL[category] ?? category}</h2>
                <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((d) => {
                  const { Icon, tint } = iconOf(d.mime_type, d.file_ext);
                  const uploaderName =
                    d.uploader?.full_name ?? d.uploader?.email ?? "Imobiliária / Proprietário";
                  return (
                    <Card key={d.id} className="p-3 min-w-0">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn("shrink-0 rounded-md bg-muted p-2", tint)}>
                          <Icon className="size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={d.name}>{d.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            Enviado por {uploaderName}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                            <span>Enviado em {formatDate(d.created_at)}</span>
                            {d.updated_at && d.updated_at !== d.created_at && (
                              <span>Atualizado em {formatDate(d.updated_at)}</span>
                            )}
                            <span>{formatSize(d.size_bytes)}</span>
                            {d.file_ext && <span className="uppercase">{d.file_ext}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={busyId === d.id}
                          onClick={() => openFile(d, false)}
                        >
                          {busyId === d.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <><Eye className="size-4 mr-1.5" /> Visualizar</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={busyId === d.id}
                          onClick={() => openFile(d, true)}
                        >
                          <Download className="size-4 mr-1.5" /> Baixar
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
