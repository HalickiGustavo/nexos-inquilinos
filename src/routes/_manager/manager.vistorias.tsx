import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Plus, ClipboardCheck, Trash2, Download, FileText, Upload } from "lucide-react";
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
import { useContracts, useInvalidate } from "@/lib/queries";
import { formatDate } from "@/lib/format";
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

export const Route = createFileRoute("/_manager/manager/vistorias")({
  head: () => ({ meta: [{ title: "Vistorias — NEXO Manager" }] }),
  component: VistoriasPage,
});

function VistoriasPage() {
  const { data: inspections = [], isLoading } = useInspections();
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vistorias</h1>
          <p className="text-muted-foreground mt-1">
            Registre vistorias de entrada e saída por contrato, com checklist por cômodo e PDF.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Nova vistoria
            </Button>
          </DialogTrigger>
          <InspectionDialog onDone={() => setOpen(false)} />
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
            <InspectionCard key={i.id} inspection={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function InspectionCard({ inspection }: { inspection: any }) {
  const invalidate = useInvalidate();
  const rooms = parseRooms(inspection.rooms);

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
    if (!confirm("Excluir esta vistoria? O arquivo PDF também será removido.")) return;
    if (inspection.pdf_path) {
      await supabase.storage.from("inspections").remove([inspection.pdf_path]);
    }
    const { error } = await supabase.from("inspections").delete().eq("id", inspection.id);
    if (error) return toast.error(error.message);
    toast.success("Vistoria excluída");
    invalidate(["inspections"]);
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{KIND_LABEL[inspection.kind as InspectionKind]}</h3>
            <Badge variant="secondary">{inspection.contract?.property?.nickname}</Badge>
            <Badge variant="outline">{inspection.contract?.tenant?.full_name}</Badge>
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
            <p className="text-xs text-muted-foreground">
              {rooms.length} cômodo(s) avaliados
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {inspection.pdf_path && (
            <Button size="sm" variant="outline" onClick={downloadPdf}>
              <Download className="size-3.5 mr-1.5" />
              PDF
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={remove}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function InspectionDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const { data: contracts = [] } = useContracts();
  const activeContracts = useMemo(() => contracts.filter((c: any) => c.active), [contracts]);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    contract_id: "",
    kind: "entrada" as InspectionKind,
    inspection_date: today,
    inspector_name: "",
    general_condition: "bom" as InspectionCondition,
    observations: "",
    status: "rascunho" as InspectionStatus,
  });
  const [rooms, setRooms] = useState<InspectionRoom[]>(DEFAULT_ROOMS);
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

      if (pdfFile && inserted) {
        const path = `${user.id}/${inserted.id}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("inspections")
          .upload(path, pdfFile, { upsert: true, contentType: "application/pdf" });
        if (upErr) throw upErr;
        await supabase.from("inspections").update({ pdf_path: path }).eq("id", inserted.id);
      }

      toast.success("Vistoria registrada!");
      invalidate(["inspections"]);
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
        <DialogTitle>Nova vistoria</DialogTitle>
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
                <SelectValue placeholder="Selecione um contrato ativo" />
              </SelectTrigger>
              <SelectContent>
                {activeContracts.map((c: any) => (
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
                  placeholder="Itens / observações (ex: paredes pintadas, piso intacto, 2 lâmpadas queimadas)"
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
            {saving ? "Salvando..." : "Salvar vistoria"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
