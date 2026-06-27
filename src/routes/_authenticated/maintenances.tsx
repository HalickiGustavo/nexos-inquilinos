import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Wrench, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMaintenances, useProperties, useInvalidate, type Maintenance } from "@/lib/queries";
import { MaintenanceChat } from "@/components/MaintenanceChat";
import { MaintenanceBudgetPanel } from "@/components/MaintenanceBudgetPanel";
import { EvidenceGrid } from "@/components/EvidenceUploader";
import { formatBRL, formatDate, parseNumber } from "@/lib/format";
import { useConfirm } from "@/components/ui/confirm";

export const Route = createFileRoute("/_authenticated/maintenances")({
  head: () => ({ meta: [{ title: "Manutenções — Nexo" }] }),
  component: MaintenancesPage,
});

const COLUMNS = [
  { key: "pendente", label: "Pendentes", color: "bg-warning/10 text-warning-foreground" },
  { key: "em_andamento", label: "Em andamento", color: "bg-chart-2/10" },
  { key: "concluido", label: "Concluídas", color: "bg-primary/10 text-primary" },
] as const;

function MaintenancesPage() {
  const { data: items = [], isLoading } = useMaintenances();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("novo")) {
      setOpen(true);
    }
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manutenções</h1>
          <p className="text-muted-foreground mt-1">Acompanhe reparos e ordens de serviço por imóvel.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Nova manutenção</Button></DialogTrigger>
          <MaintenanceDialog onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colItems = items.filter((m: any) => m.status === col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{col.label}</h3>
                  <Badge variant="secondary">{colItems.length}</Badge>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {colItems.length === 0 ? (
                    <Card className="p-6 text-center border-dashed">
                      <Wrench className="size-6 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">Nenhum item</p>
                    </Card>
                  ) : (
                    colItems.map((m: any) => <MaintenanceCard key={m.id} item={m} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MaintenanceCard({ item }: { item: any }) {
  const invalidate = useInvalidate();
  return (
    <Card className="p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium">{item.title}</h4>
        <Badge variant="outline" className="capitalize text-xs">{item.responsible}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{item.property?.nickname}</p>
      {item.description && <p className="text-sm mt-2 text-muted-foreground line-clamp-3">{item.description}</p>}
      {item.evidence_urls?.length > 0 && (
        <div className="mt-3">
          <EvidenceGrid paths={item.evidence_urls} />
        </div>
      )}
      <div className="flex items-center justify-between mt-3 text-sm">
        <span className="font-semibold text-primary">{formatBRL(Number(item.cost))}</span>
        {item.scheduled_date && <span className="text-xs text-muted-foreground">{formatDate(item.scheduled_date)}</span>}
      </div>
      <div className="flex gap-2 mt-3">
        <Select
          value={item.status}
          onValueChange={async (v) => {
            const updates: any = { status: v };
            if (v === "concluido") updates.completed_date = new Date().toISOString().slice(0, 10);
            const { error } = await supabase.from("maintenances").update(updates).eq("id", item.id);
            if (error) return toast.error(error.message);
            toast.success("Status atualizado");
            invalidate(["maintenances"]);
          }}
        >
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
          </SelectContent>
        </Select>
        {item.tenant_id && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" title="Conversar com o inquilino">
                <MessageCircle className="size-3.5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
              <SheetHeader>
                <SheetTitle>Chat — {item.title}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 min-h-0 mt-3">
                <MaintenanceChat maintenanceId={item.id} />
              </div>
            </SheetContent>
          </Sheet>
        )}
        <Button variant="outline" size="sm" onClick={async () => {
          if (!confirm("Excluir esta manutenção?")) return;
          const { error } = await supabase.from("maintenances").delete().eq("id", item.id);
          if (error) return toast.error(error.message);
          toast.success("Excluído");
          invalidate(["maintenances"]);
        }}>
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
      <MaintenanceBudgetPanel item={item} />
    </Card>
  );
}

function MaintenanceDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const { data: properties = [] } = useProperties();
  const [form, setForm] = useState({
    title: "", description: "", property_id: "", cost: "0",
    status: "pendente" as Maintenance["status"],
    responsible: "proprietario" as Maintenance["responsible"],
    scheduled_date: "",
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Nova manutenção</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user) return;
          const { error } = await supabase.from("maintenances").insert({
            user_id: user.id,
            property_id: form.property_id,
            title: form.title,
            description: form.description || null,
            cost: parseNumber(form.cost),
            status: form.status,
            responsible: form.responsible,
            scheduled_date: form.scheduled_date || null,
          });
          if (error) return toast.error(error.message);
          toast.success("Manutenção criada");
          invalidate(["maintenances"]);
          onDone();
        }}
      >
        <div className="space-y-2"><Label>Título *</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Imóvel *</Label>
          <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Custo (R$)</Label><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
          <div className="space-y-2"><Label>Data prevista</Label><Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Maintenance["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={form.responsible} onValueChange={(v) => setForm({ ...form, responsible: v as Maintenance["responsible"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proprietario">Proprietário</SelectItem>
                <SelectItem value="inquilino">Inquilino</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button type="submit" disabled={!form.property_id}>Criar manutenção</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
