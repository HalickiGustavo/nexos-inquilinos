import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, ClipboardCheck, Trash2, Download, FileText, Upload, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useContracts } from "@/lib/queries";
import { useConfirm } from "@/components/ui/confirm";
import { formatDate } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import {
  COND_LABEL,
  DEFAULT_ROOMS,
  KIND_LABEL,
  STATUS_LABEL,
  getSignedPdfUrl,
  parseRooms,
  useInspections,
  type InspectionCondition,
  type InspectionKind,
  type InspectionRoom,
  type InspectionStatus,
} from "@/lib/inspections";

const LANDLORD_KIND_LABEL: Record<string, string> = {
  ...KIND_LABEL,
  preventiva: "Vistoria Preventiva",
  extraordinaria: "Vistoria Extraordinária",
};

export const Route = createFileRoute("/_authenticated/vistorias")({
  head: () => ({ meta: [{ title: "Vistorias — NEXO" }] }),
  component: LandlordVistoriasPage,
});

function LandlordVistoriasPage() {
  const { data: inspections = [], isLoading } = useInspections();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Vistorias</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Registre e acompanhe vistorias dos seus imóveis com checklist por cômodo.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="size-4 mr-2" />
              Nova vistoria
            </Button>
          </DialogTrigger>
          <InspectionDialog
            key={editing?.id ?? "new"}
            existing={editing}
            onDone={() => { setOpen(false); setEditing(null); }}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : inspections.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardCheck className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma vistoria registrada ainda.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {inspections.map((i: any) => (
            <InspectionCard
              key={i.id}
              inspection={i}
              onEdit={() => { setEditing(i); setOpen(true); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InspectionCard({ inspection, onEdit }: { inspection: any; onEdit: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const rooms = parseRooms(inspection.rooms);
  const isOwn = inspection.user_id === user?.id;
  const isDraft = inspection.status === "rascunho";

  async function downloadPdf() {
    if (!inspection.pdf_path) return toast.error("Esta vistoria não possui PDF anexado.");
    try {
      const url = await getSignedPdfUrl(inspection.pdf_path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao baixar PDF");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Excluir esta vistoria?",
      description: "Somente vistorias em rascunho podem ser excluídas. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir vistoria",
      tone: "destructive",
    });
    if (!ok) return;
    if (inspection.pdf_path) {
      await supabase.storage.from("inspections").remove([inspection.pdf_path]);
    }
    const { error } = await supabase.from("inspections").delete().eq("id", inspection.id);
    if (error) return toast.error(error.message);
    toast.success("Vistoria excluída");
    qc.invalidateQueries({ queryKey: ["inspections"] });
  }

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">
              {LANDLORD_KIND_LABEL[inspection.kind] ?? inspection.kind}
            </h3>
            {inspection.contract?.property?.nickname && (
              <Badge variant="secondary">{inspection.contract.property.nickname}</Badge>
            )}
            {inspection.contract?.tenant?.full_name && (
              <Badge variant="outline">{inspection.contract.tenant.full_name}</Badge>
            )}
            <Badge
              className={
                inspection.status === "assinada"
                  ? "bg-primary text-primary-foreground"
                  : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
              }
            >
              {STATUS_LABEL[inspection.status as InspectionStatus]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Data: {formatDate(inspection.inspection_date)} • Responsável:{" "}
            {inspection.inspector_name || "—"} • Estado geral:{" "}
            {COND_LABEL[inspection.general_condition as InspectionCondition]}
          </p>
          {rooms.length > 0 && (
            <p className="text-xs text-muted-foreground">{rooms.length} cômodo(s) avaliados</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {inspection.pdf_path && (
            <Button size="sm" variant="outline" onClick={downloadPdf}>
              <Download className="size-3.5 mr-1.5" />
              PDF
            </Button>
          )}
          {isOwn && isDraft && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="size-3.5 mr-1.5" />
              Editar
            </Button>
          )}
          {isOwn && isDraft && (
            <Button size="sm" variant="outline" onClick={remove}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function InspectionDialog({ existing, onDone }: { existing: any | null; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: contracts = [] } = useContracts();
  const contractOptions = useMemo(
    () => contracts.filter((c: any) => c.active || existing?.contract_id === c.id),
    [contracts, existing],
  );

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    contract_id: existing?.contract_id ?? "",
    kind: (existing?.kind ?? "entrada") as InspectionKind,
    inspection_date: existing?.inspection_date ?? today,
    inspector_name: existing?.inspector_name ?? "",
    general_condition: (existing?.general_condition ?? "bom") as InspectionCondition,
    observations: existing?.observations ?? "",
    status: (existing?.status ?? "rascunho") as InspectionStatus,
  });
  const [rooms, setRooms] = useState<InspectionRoom[]>(
    existing ? parseRooms(existing.rooms) : DEFAULT_ROOMS,
  );
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRoom(idx: number, patch: Partial<InspectionRoom>) {
    setRooms((r) => r.map((room, i) => (i === idx ? { ...room, ...patch } : room)));
  }
  function addRoom() {
    setRooms((r) => [...r, { name: "", condition: "bom", items: "" }]);
  }
  function removeRoom(idx: number) {
    setRooms((r) => r.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.contract_id) return toast.error("Selecione um contrato.");
    setSaving(true);
    try {
      let inspectionId = existing?.id as string | undefined;
      if (existing) {
        const { error } = await supabase
          .from("inspections")
          .update({
            contract_id: form.contract_id,
            kind: form.kind,
            inspection_date: form.inspection_date,
            inspector_name: form.inspector_name || null,
            general_condition: form.general_condition,
            observations: form.observations || null,
            status: form.status,
            rooms: rooms as any,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("inspections")
          .insert({
            user_id: user.id,
            contract_id: form.contract_id,
            kind: form.kind,
            inspection_date: form.inspection_date,
            inspector_name: form.inspector_name || null,
            general_condition: form.general_condition,
            observations: form.observations || null,
            status: form.status,
            rooms: rooms as any,
          })
          .select("id")
          .single();
        if (error) throw error;
        inspectionId = inserted?.id;
      }

      if (pdfFile && inspectionId) {
        const path = `${user.id}/${inspectionId}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("inspections")
          .upload(path, pdfFile, { upsert: true, contentType: "application/pdf" });
        if (upErr) throw upErr;
        await supabase.from("inspections").update({ pdf_path: path }).eq("id", inspectionId);
      }

      toast.success(existing ? "Vistoria atualizada!" : "Vistoria registrada!");
      qc.invalidateQueries({ queryKey: ["inspections"] });
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar vistoria");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{existing ? "Editar vistoria" : "Nova vistoria"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Contrato *</Label>
            <Select
              value={form.contract_id}
              onValueChange={(v) => setForm({ ...form, contract_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um contrato" />
              </SelectTrigger>
              <SelectContent>
                {contractOptions.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.property?.nickname} — {c.tenant?.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select
              value={form.kind}
              onValueChange={(v) => setForm({ ...form, kind: v as InspectionKind })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Vistoria de Entrada</SelectItem>
                <SelectItem value="saida">Vistoria de Saída</SelectItem>
                <SelectItem value="preventiva">Vistoria Preventiva</SelectItem>
                <SelectItem value="extraordinaria">Vistoria Extraordinária</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data da vistoria *</Label>
            <Input
              type="date"
              required
              value={form.inspection_date}
              onChange={(e) => setForm({ ...form, inspection_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Responsável (vistoriador)</Label>
            <Input
              placeholder="Nome do vistoriador"
              value={form.inspector_name}
              onChange={(e) => setForm({ ...form, inspector_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Estado geral *</Label>
            <Select
              value={form.general_condition}
              onValueChange={(v) =>
                setForm({ ...form, general_condition: v as InspectionCondition })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COND_LABEL) as InspectionCondition[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {COND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">Checklist por cômodo</Label>
            <Button type="button" size="sm" variant="outline" onClick={addRoom}>
              <Plus className="size-3.5 mr-1.5" />
              Adicionar cômodo
            </Button>
          </div>
          <div className="space-y-3">
            {rooms.map((r, idx) => (
              <Card key={idx} className="p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
                  <Input
                    placeholder="Nome do cômodo (ex: Quarto 2)"
                    value={r.name}
                    onChange={(e) => updateRoom(idx, { name: e.target.value })}
                  />
                  <Select
                    value={r.condition}
                    onValueChange={(v) =>
                      updateRoom(idx, { condition: v as InspectionCondition })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(COND_LABEL) as InspectionCondition[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {COND_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeRoom(idx)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Itens / observações (ex: piso, pintura, rodapés, tomadas, iluminação)"
                  value={r.items}
                  onChange={(e) => updateRoom(idx, { items: e.target.value })}
                />
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observações gerais</Label>
          <Textarea
            rows={3}
            placeholder="Comentários adicionais sobre a vistoria"
            value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as InspectionStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="assinada">Assinada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Anexar PDF assinado (opcional)
            </Label>
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving || !form.contract_id}>
            <Upload className="size-4 mr-2" />
            {saving ? "Salvando..." : existing ? "Salvar alterações" : "Salvar vistoria"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
