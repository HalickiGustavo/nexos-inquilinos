import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Phone, Wallet } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_manager/manager/crm")({
  component: CRM,
});

const STAGES = [
  { id: "novos", label: "Novos Leads", color: "bg-blue-500" },
  { id: "contato", label: "Contato Feito / Visita", color: "bg-amber-500" },
  { id: "proposta", label: "Proposta em Análise", color: "bg-purple-500" },
  { id: "fechado", label: "Fechado / Contrato Emitido", color: "bg-primary" },
];

function CRM() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const q = useQuery({
    queryKey: ["mgr-crm"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_leads").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return;
    const leadId = String(e.active.id);
    const newStage = String(e.over.id);
    const lead = (q.data ?? []).find((l: any) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;
    await supabase.from("crm_leads").update({ stage: newStage }).eq("id", leadId);
    qc.invalidateQueries({ queryKey: ["mgr-crm"] });
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM — Funil de Locação</h1>
          <p className="text-sm text-zinc-500">Arraste cards entre as etapas do funil</p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="size-4 mr-2" /> Novo Lead
        </Button>
      </header>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map((stage) => {
            const items = (q.data ?? []).filter((l: any) => l.stage === stage.id);
            return <Column key={stage.id} stage={stage} items={items} onOpen={setEditing} />;
          })}
        </div>
      </DndContext>

      <LeadDialog open={openNew} onOpenChange={setOpenNew} lead={null} onSaved={() => qc.invalidateQueries({ queryKey: ["mgr-crm"] })} />
      <LeadDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} lead={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["mgr-crm"] })} />
    </div>
  );
}

function Column({ stage, items, onOpen }: { stage: typeof STAGES[number]; items: any[]; onOpen: (l: any) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div ref={setNodeRef} className={`rounded-lg border-2 border-dashed p-3 min-h-[400px] transition-colors ${isOver ? "border-primary bg-primary/5" : "border-zinc-200 bg-zinc-50/40"}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`size-2 rounded-full ${stage.color}`} />
        <h3 className="font-semibold text-sm">{stage.label}</h3>
        <span className="text-xs text-zinc-500 ml-auto">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function LeadCard({ lead, onOpen }: { lead: any; onOpen: (l: any) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : {};
  return (
    <Card ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "shadow-lg" : ""}`}
      onDoubleClick={() => onOpen(lead)}>
      <CardContent className="p-3 space-y-2">
        <div className="font-medium text-sm">{lead.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-600"><Wallet className="size-3" />{formatBRL(lead.budget)}</div>
        {lead.interested_code && <div className="text-xs text-zinc-500 font-mono">Imóvel: {lead.interested_code}</div>}
        {lead.phone && <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Phone className="size-3" />{lead.phone}</div>}
        <Button size="sm" variant="ghost" className="h-7 text-xs w-full" onClick={(e) => { e.stopPropagation(); onOpen(lead); }}>
          Abrir / Notas
        </Button>
      </CardContent>
    </Card>
  );
}

function LeadDialog({ open, onOpenChange, lead, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; lead: any; onSaved: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!lead;
  const [form, setForm] = useState(() => ({
    name: lead?.name ?? "", phone: lead?.phone ?? "", email: lead?.email ?? "",
    budget: String(lead?.budget ?? ""), interested_code: lead?.interested_code ?? "", stage: lead?.stage ?? "novos", notes: lead?.notes ?? "",
  }));
  const [newNote, setNewNote] = useState("");

  // reset when lead changes
  useState(() => { setForm({
    name: lead?.name ?? "", phone: lead?.phone ?? "", email: lead?.email ?? "",
    budget: String(lead?.budget ?? ""), interested_code: lead?.interested_code ?? "", stage: lead?.stage ?? "novos", notes: lead?.notes ?? "",
  }); });

  const qNotes = useQuery({
    queryKey: ["mgr-crm-notes", lead?.id],
    enabled: !!lead?.id,
    queryFn: async () => {
      const { data } = await supabase.from("crm_lead_notes").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      name: form.name, phone: form.phone, email: form.email, budget: Number(form.budget || 0),
      interested_code: form.interested_code, stage: form.stage, notes: form.notes,
    };
    if (isEdit) {
      await supabase.from("crm_leads").update(payload).eq("id", lead.id);
    } else {
      await supabase.from("crm_leads").insert({ ...payload, manager_user_id: u.user!.id });
    }
    toast.success("Lead salvo");
    onSaved(); onOpenChange(false);
  };

  const addNote = async () => {
    if (!newNote.trim() || !lead?.id) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("crm_lead_notes").insert({ lead_id: lead.id, author_user_id: u.user!.id, content: newNote });
    setNewNote("");
    qc.invalidateQueries({ queryKey: ["mgr-crm-notes", lead.id] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Editar Lead" : "Novo Lead"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Orçamento (R$)</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
          <div><Label>Código do imóvel</Label><Input value={form.interested_code} onChange={(e) => setForm({ ...form, interested_code: e.target.value })} /></div>
          <div className="col-span-2"><Label>Etapa</Label>
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <Button onClick={save} className="bg-primary hover:bg-primary/90">Salvar</Button>

        {isEdit && (
          <div className="border-t pt-4 mt-2 space-y-3">
            <h4 className="font-semibold text-sm">Follow-ups / Notas</h4>
            <div className="flex gap-2">
              <Input placeholder="Nova nota..." value={newNote} onChange={(e) => setNewNote(e.target.value)} />
              <Button onClick={addNote}>Adicionar</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(qNotes.data ?? []).map((n: any) => (
                <div key={n.id} className="bg-zinc-50 rounded p-2 text-sm">
                  <div className="text-xs text-zinc-500">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
                  {n.content}
                </div>
              ))}
              {(qNotes.data ?? []).length === 0 && <div className="text-sm text-zinc-400">Nenhuma nota ainda</div>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
