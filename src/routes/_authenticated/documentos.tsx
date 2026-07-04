import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  FileText, Upload, Star, StarOff, Download, Trash2, Pencil, Search, Filter,
  AlertTriangle, History, FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProperties, useContracts } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/ui/confirm";
import { formatDate } from "@/lib/format";
import {
  ALLOWED_EXT, ALLOWED_MIME, CATEGORY_LABEL, DOCUMENT_CATEGORIES,
  daysUntil, extOf, getSignedDocumentUrl, logDocumentEvent,
  useDocumentEvents, useDocuments,
} from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Documentos — NEXO" }] }),
  component: LandlordDocumentosPage,
});

function LandlordDocumentosPage() {
  const { data: documents = [], isLoading } = useDocuments();
  const { data: properties = [] } = useProperties();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [historyDoc, setHistoryDoc] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState<string>("all");
  const [fProperty, setFProperty] = useState<string>("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (onlyFavorites && !d.is_favorite) return false;
      if (fCategory !== "all" && d.category !== fCategory) return false;
      if (fProperty !== "all" && d.property_id !== fProperty) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${d.name} ${d.description ?? ""} ${d.custom_category ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [documents, search, fCategory, fProperty, onlyFavorites]);

  const expiringSoon = useMemo(
    () => documents.filter((d) => {
      const days = daysUntil(d.expires_at);
      return days !== null && days <= 30;
    }),
    [documents],
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Documentos</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Repositório central de contratos, escrituras, seguros, laudos e mais.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Upload className="size-4 mr-2" />
              Novo documento
            </Button>
          </DialogTrigger>
          <DocumentDialog
            key={editing?.id ?? "new"}
            existing={editing}
            onDone={() => { setOpen(false); setEditing(null); }}
          />
        </Dialog>
      </div>

      {expiringSoon.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-medium">
              {expiringSoon.length} documento(s) vencem em até 30 dias
            </p>
          </div>
        </Card>
      )}

      <Card className="p-3 md:p-4">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, descrição ou categoria"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 md:flex gap-2">
            <Select value={fCategory} onValueChange={setFCategory}>
              <SelectTrigger className="md:w-44">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fProperty} onValueChange={setFProperty}>
              <SelectTrigger className="md:w-52">
                <SelectValue placeholder="Imóvel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos imóveis</SelectItem>
                {properties.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={onlyFavorites ? "default" : "outline"}
              onClick={() => setOnlyFavorites((v) => !v)}
              className="col-span-2 md:col-span-1"
            >
              <Star className="size-4 mr-1.5" />
              Favoritos
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {documents.length === 0 ? "Nenhum documento ainda." : "Nenhum documento com esses filtros."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <DocumentCard
              key={d.id}
              doc={d}
              onEdit={() => { setEditing(d); setOpen(true); }}
              onHistory={() => setHistoryDoc(d)}
            />
          ))}
        </div>
      )}

      <Sheet open={!!historyDoc} onOpenChange={(v) => !v && setHistoryDoc(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Histórico — {historyDoc?.name}</SheetTitle>
          </SheetHeader>
          {historyDoc && <DocumentHistoryList documentId={historyDoc.id} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  upload: "Enviado",
  edit: "Editado",
  rename: "Renomeado",
  move: "Movido",
  download: "Baixado",
  delete: "Excluído",
};

function DocumentHistoryList({ documentId }: { documentId: string }) {
  const { data: events = [], isLoading } = useDocumentEvents(documentId);
  if (isLoading) return <p className="text-sm text-muted-foreground mt-4">Carregando histórico...</p>;
  if (events.length === 0) return <p className="text-sm text-muted-foreground mt-4">Sem eventos ainda.</p>;
  return (
    <div className="space-y-2 mt-4">
      {events.map((e: any) => (
        <div key={e.id} className="flex items-start gap-3 p-3 rounded-md border">
          <History className="size-4 mt-0.5 text-muted-foreground" />
          <div className="text-sm">
            <div className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(e.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentCard({
  doc, onEdit, onHistory,
}: { doc: any; onEdit: () => void; onHistory: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const confirm = useConfirm();
  const days = daysUntil(doc.expires_at);
  const expiring = days !== null && days <= 30;
  const expired = days !== null && days < 0;

  async function download() {
    try {
      const url = await getSignedDocumentUrl(doc.storage_path, true);
      window.open(url, "_blank");
      if (user) await logDocumentEvent(doc.id, user.id, "download");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao baixar");
    }
  }

  async function toggleFavorite() {
    const { error } = await supabase
      .from("documents" as any)
      .update({ is_favorite: !doc.is_favorite })
      .eq("id", doc.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["documents"] });
  }

  async function remove() {
    const ok = await confirm({
      title: "Excluir este documento?",
      description: "O arquivo também será removido. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      tone: "destructive",
    });
    if (!ok) return;
    await supabase.storage.from("documents").remove([doc.storage_path]);
    if (user) await logDocumentEvent(doc.id, user.id, "delete", { name: doc.name });
    const { error } = await supabase.from("documents" as any).delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Documento excluído");
    qc.invalidateQueries({ queryKey: ["documents"] });
  }

  const categoryLabel =
    doc.category === "personalizada" && doc.custom_category
      ? doc.custom_category
      : CATEGORY_LABEL[doc.category] ?? doc.category;

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <FileText className="size-5 mt-0.5 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate" title={doc.name}>{doc.name}</div>
            <div className="text-xs text-muted-foreground uppercase">{doc.file_ext}</div>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={toggleFavorite} title="Favorito">
          {doc.is_favorite ? (
            <Star className="size-4 fill-amber-400 text-amber-400" />
          ) : (
            <StarOff className="size-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{categoryLabel}</Badge>
        {expired && <Badge className="bg-destructive text-destructive-foreground">Vencido</Badge>}
        {!expired && expiring && (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300">
            Vence em {days}d
          </Badge>
        )}
      </div>

      {doc.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
      )}

      <div className="text-xs text-muted-foreground">
        {doc.document_date && <>Data: {formatDate(doc.document_date)} • </>}
        Enviado {formatDate(doc.created_at)}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t">
        <Button size="sm" variant="outline" onClick={download} className="flex-1">
          <Download className="size-3.5 mr-1.5" /> Baixar
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={onHistory} title="Histórico">
          <History className="size-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={remove}>
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </Card>
  );
}

function DocumentDialog({ existing, onDone }: { existing: any | null; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: properties = [] } = useProperties();
  const { data: contracts = [] } = useContracts();

  const [form, setForm] = useState({
    name: existing?.name ?? "",
    description: existing?.description ?? "",
    category: existing?.category ?? "outros",
    custom_category: existing?.custom_category ?? "",
    document_date: existing?.document_date ?? "",
    expires_at: existing?.expires_at ?? "",
    property_id: existing?.property_id ?? "none",
    contract_id: existing?.contract_id ?? "none",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const contractOptions = useMemo(() => {
    if (form.property_id === "none") return contracts;
    return contracts.filter((c: any) => c.property_id === form.property_id);
  }, [contracts, form.property_id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) return toast.error("Informe um nome.");
    if (!existing && !file) return toast.error("Selecione um arquivo.");
    if (file) {
      const ext = extOf(file.name);
      if (!ALLOWED_EXT.includes(ext)) {
        return toast.error(`Extensão não permitida: ${ext}. Use ${ALLOWED_EXT.join(", ")}`);
      }
      if (file.size > 25 * 1024 * 1024) {
        return toast.error("Arquivo maior que 25MB.");
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        custom_category:
          form.category === "personalizada" ? form.custom_category.trim() || null : null,
        document_date: form.document_date || null,
        expires_at: form.expires_at || null,
        property_id: form.property_id === "none" ? null : form.property_id,
        contract_id: form.contract_id === "none" ? null : form.contract_id,
      };

      let docId = existing?.id as string | undefined;
      let storagePath = existing?.storage_path as string | undefined;

      if (existing) {
        const { error } = await supabase
          .from("documents" as any)
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const id = crypto.randomUUID();
        const ext = extOf(file!.name);
        storagePath = `${user.id}/${id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, file!, {
            contentType: file!.type || undefined,
            upsert: false,
          });
        if (upErr) throw upErr;
        const { data: inserted, error } = await supabase
          .from("documents" as any)
          .insert({
            ...payload,
            id,
            user_id: user.id,
            storage_path: storagePath,
            mime_type: file!.type || null,
            size_bytes: file!.size,
            file_ext: ext,
          })
          .select("id")
          .single();
        if (error) throw error;
        docId = (inserted as any).id;
      }

      // Optional replacement upload on edit
      if (existing && file) {
        const ext = extOf(file.name);
        const newPath = `${user.id}/${existing.id}.${ext}`;
        if (existing.storage_path && existing.storage_path !== newPath) {
          await supabase.storage.from("documents").remove([existing.storage_path]);
        }
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(newPath, file, { contentType: file.type || undefined, upsert: true });
        if (upErr) throw upErr;
        await supabase
          .from("documents" as any)
          .update({
            storage_path: newPath,
            mime_type: file.type || null,
            size_bytes: file.size,
            file_ext: ext,
          })
          .eq("id", existing.id);
      }

      if (docId) {
        await logDocumentEvent(
          docId,
          user.id,
          existing ? "edit" : "upload",
          { name: payload.name, category: payload.category },
        );
      }

      toast.success(existing ? "Documento atualizado!" : "Documento enviado!");
      qc.invalidateQueries({ queryKey: ["documents"] });
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar documento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{existing ? "Editar documento" : "Novo documento"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Escritura casa Vila Mariana"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.category === "personalizada" && (
            <div className="space-y-2">
              <Label>Nome da categoria</Label>
              <Input
                value={form.custom_category}
                onChange={(e) => setForm({ ...form, custom_category: e.target.value })}
                placeholder="Ex: Reforma 2025"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Imóvel (opcional)</Label>
            <Select
              value={form.property_id}
              onValueChange={(v) => setForm({ ...form, property_id: v, contract_id: "none" })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {properties.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Contrato (opcional)</Label>
            <Select
              value={form.contract_id}
              onValueChange={(v) => setForm({ ...form, contract_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {contractOptions.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.property?.nickname} — {c.tenant?.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data do documento</Label>
            <Input
              type="date"
              value={form.document_date}
              onChange={(e) => setForm({ ...form, document_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Data de validade (opcional)</Label>
            <Input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Anotações sobre o documento"
          />
        </div>

        <div className="space-y-2">
          <Label>Arquivo {existing ? "(opcional — substituir)" : "*"}</Label>
          <Input
            type="file"
            accept={ALLOWED_MIME.join(",")}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            Formatos: {ALLOWED_EXT.join(", ")} — até 25MB.
          </p>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving}>
            <Upload className="size-4 mr-2" />
            {saving ? "Salvando..." : existing ? "Salvar alterações" : "Enviar documento"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
