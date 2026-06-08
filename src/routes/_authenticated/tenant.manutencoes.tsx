import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageCircle, Wrench, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  useCurrentTenant,
  useTenantActiveContract,
  useTenantMaintenances,
} from "@/lib/tenant-queries";
import { MaintenanceChat } from "@/components/MaintenanceChat";
import { EvidenceUploader, EvidenceGrid } from "@/components/EvidenceUploader";
import { cn } from "@/lib/utils";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tenant/manutencoes")({
  head: () => ({ meta: [{ title: "Manutenções — Nexo Inquilino" }] }),
  component: TenantManutencoes,
});

const statusLabel: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  em_andamento: { label: "Em andamento", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" },
  concluido: { label: "Concluído", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
};

function TenantManutencoes() {
  const { data: items = [], isLoading } = useTenantMaintenances();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const current = items.find((m: any) => m.id === selected) ?? null;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manutenções</h1>
          <p className="text-sm text-muted-foreground">Abra chamados e converse com o proprietário.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-1.5" /> Nova
            </Button>
          </DialogTrigger>
          <NewRequestDialog onDone={() => setOpen(false)} />
        </Dialog>
      </header>

      <div className="grid md:grid-cols-[320px_1fr] gap-4">
        {/* List */}
        <div className={cn("space-y-2", current && "hidden md:block")}>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && items.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground border-dashed">
              <Wrench className="size-6 mx-auto mb-2" />
              <p className="text-sm">Nenhum chamado ainda.</p>
            </Card>
          )}
          {items.map((m: any) => {
            const s = statusLabel[m.status] ?? statusLabel.pendente;
            const active = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition",
                  active ? "border-primary bg-primary/5" : "bg-card hover:border-primary/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{m.title}</p>
                  <Badge variant="outline" className={cn("border text-xs shrink-0", s.className)}>
                    {s.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(m.created_at)}</p>
              </button>
            );
          })}
        </div>

        {/* Chat */}
        <div className={cn(current ? "block" : "hidden md:block")}>
          {current ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 md:hidden">
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  <ArrowLeft className="size-4 mr-1" /> Voltar
                </Button>
              </div>
              <Card className="p-4 space-y-3">
                <p className="font-semibold">{current.title}</p>
                {current.description && (
                  <p className="text-sm text-muted-foreground">{current.description}</p>
                )}
                {current.evidence_urls?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Evidências enviadas</p>
                    <EvidenceGrid paths={current.evidence_urls} />
                  </div>
                )}
                {current.budget_status && current.budget_status !== "nenhum" && (
                  <div className="mt-2 pt-2 border-t text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Orçamento:</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          current.budget_status === "pendente" &&
                            "border-amber-500/40 text-amber-700 dark:text-amber-400",
                          current.budget_status === "aprovado" &&
                            "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
                          current.budget_status === "recusado" &&
                            "border-destructive/40 text-destructive",
                        )}
                      >
                        {current.budget_status === "pendente" && "Aguardando proprietário"}
                        {current.budget_status === "aprovado" && "Aprovado"}
                        {current.budget_status === "recusado" && "Recusado"}
                      </Badge>
                    </div>
                    {current.provider_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Prestador:</span>
                        <span className="font-medium">{current.provider_name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Valor:</span>
                      <span className="font-medium">
                        {formatBRL(Number(current.budget_amount ?? 0))}
                      </span>
                    </div>
                    {current.budget_status === "aprovado" && current.budget_rent_deduction && (
                      <p className="text-primary">
                        ✓ Será abatido do seu próximo aluguel.
                      </p>
                    )}
                  </div>
                )}
              </Card>
              <MaintenanceChat maintenanceId={current.id} />
            </div>
          ) : (
            <Card className="hidden md:flex flex-col items-center justify-center text-center p-10 min-h-[400px] border-dashed">
              <MessageCircle className="size-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Selecione um chamado para conversar.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function NewRequestDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const { data: tenant } = useCurrentTenant();
  const { data: contract } = useTenantActiveContract();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", category: "eletrica" });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !tenant || !contract?.property_id) {
        throw new Error("Sem contrato ativo.");
      }
      const { error } = await supabase.from("maintenances").insert({
        user_id: contract.user_id,
        tenant_id: tenant.id,
        property_id: contract.property_id,
        title: form.title,
        description: `[${form.category.toUpperCase()}] ${form.description}`,
        cost: 0,
        status: "pendente",
        responsible: "proprietario",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado aberto!");
      qc.invalidateQueries({ queryKey: ["tenant-maintenances"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Nova solicitação</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label>Título *</Label>
          <Input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: Vazamento no banheiro"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eletrica">Elétrica</SelectItem>
              <SelectItem value="hidraulica">Hidráulica</SelectItem>
              <SelectItem value="estrutural">Estrutural</SelectItem>
              <SelectItem value="eletrodomestico">Eletrodoméstico</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descreva o problema..."
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={create.isPending}>
            Abrir chamado
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
