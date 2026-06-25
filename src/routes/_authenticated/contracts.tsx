import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ContractPdfUploader } from "@/components/ContractPdfUploader";
import { useAuth } from "@/lib/auth";
import { useContracts, useProperties, useTenants, useInvalidate } from "@/lib/queries";
import { formatBRL, formatDate, parseNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({ meta: [{ title: "Contratos — Nexo" }] }),
  component: ContractsPage,
});

function ContractsPage() {
  const { data: contracts = [], isLoading } = useContracts();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground mt-1">Vincule imóveis a inquilinos e gere as parcelas automaticamente.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Novo contrato</Button>
          </DialogTrigger>
          <ContractDialog onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : contracts.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum contrato criado ainda.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {contracts.map((c: any) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{c.property?.nickname}</h3>
                    <Badge variant="secondary">{c.tenant?.full_name}</Badge>
                    {c.active && <Badge className="bg-primary text-primary-foreground">Ativo</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{c.property?.address}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{formatBRL(Number(c.rent_amount))}/mês</div>
                  <div className="text-xs text-muted-foreground">Vencimento dia {c.due_day}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <Info label="Início" value={formatDate(c.start_date)} />
                <Info label="Fim" value={formatDate(c.end_date)} />
                <Info label="Reajuste" value={c.readjustment_index} />
                <Info label="Caução" value={formatBRL(Number(c.security_deposit))} />
              </div>
              <div className="mt-4 flex justify-between items-center gap-2 flex-wrap border-t pt-4">
                <ContractPdfUploader contractId={c.id} currentPath={c.contract_pdf_path} />
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!confirm("Tem certeza que deseja excluir este contrato? Todas as parcelas vinculadas serão perdidas.")) return;
                  const { error } = await supabase.from("contracts").delete().eq("id", c.id);
                  if (error) return toast.error(error.message);
                  toast.success("Contrato excluído");
                  invalidate(["contracts", "installments", "properties"]);
                }}>
                  <Trash2 className="size-3.5 text-destructive mr-1.5" />Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function ContractDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const { data: properties = [] } = useProperties();
  const { data: tenants = [] } = useTenants();

  const today = new Date().toISOString().slice(0, 10);
  const oneYear = new Date(); oneYear.setFullYear(oneYear.getFullYear() + 1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    property_id: "",
    tenant_id: "",
    start_date: today,
    end_date: oneYear.toISOString().slice(0, 10),
    due_day: "5",
    rent_amount: "",
    readjustment_index: "IGP-M",
    security_deposit: "0",
    late_fee_percent: "2",
    daily_interest_percent: "0.033",
  });


  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader>
      <form
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user || submitting) return;
          setSubmitting(true);
          try {
            const payload = {
              user_id: user.id,
              property_id: form.property_id,
              tenant_id: form.tenant_id,
              start_date: form.start_date,
              end_date: form.end_date,
              due_day: parseInt(form.due_day),
              rent_amount: parseNumber(form.rent_amount),
              readjustment_index: form.readjustment_index as any,
              security_deposit: parseNumber(form.security_deposit),
              late_fee_percent: parseNumber(form.late_fee_percent),
              daily_interest_percent: parseNumber(form.daily_interest_percent),
              active: true,
            };

            const { error } = await supabase.from("contracts").insert(payload);
            if (error) {
              toast.error(error.message);
              return;
            }
            toast.success("Contrato criado e parcelas geradas!");
            invalidate();
            onDone();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label>Imóvel *</Label>
          <Select value={form.property_id} onValueChange={(v) => {
            const prop = properties.find((p) => p.id === v);
            setForm({ ...form, property_id: v, rent_amount: prop ? String(prop.rent_price) : form.rent_amount });
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione um imóvel" /></SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nickname} — {p.address}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Inquilino *</Label>
          <Select value={form.tenant_id} onValueChange={(v) => setForm({ ...form, tenant_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione um inquilino" /></SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Início *</Label><Input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
        <div className="space-y-2"><Label>Fim *</Label><Input type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
        <div className="space-y-2"><Label>Dia de vencimento (1-31) *</Label><Input type="number" min={1} max={31} required value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} /></div>
        <div className="space-y-2"><Label>Valor do aluguel (R$) *</Label><Input type="number" step="0.01" required value={form.rent_amount} onChange={(e) => setForm({ ...form, rent_amount: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Índice de reajuste</Label>
          <Select value={form.readjustment_index} onValueChange={(v) => setForm({ ...form, readjustment_index: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="IGP-M">IGP-M</SelectItem>
              <SelectItem value="IPCA">IPCA</SelectItem>
              <SelectItem value="INCC">INCC</SelectItem>
              <SelectItem value="nenhum">Nenhum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Caução (R$)</Label><Input type="number" step="0.01" value={form.security_deposit} onChange={(e) => setForm({ ...form, security_deposit: e.target.value })} /></div>
        <div className="space-y-2"><Label>Multa por atraso (%)</Label><Input type="number" step="0.01" value={form.late_fee_percent} onChange={(e) => setForm({ ...form, late_fee_percent: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Juros ao dia (%)</Label><Input type="number" step="0.001" value={form.daily_interest_percent} onChange={(e) => setForm({ ...form, daily_interest_percent: e.target.value })} /><p className="text-xs text-muted-foreground">0,033% ao dia ≈ 1% ao mês</p></div>

        <DialogFooter className="sm:col-span-2">
          <Button type="submit" disabled={submitting || !form.property_id || !form.tenant_id}>
            {submitting ? "Criando..." : "Criar contrato e gerar parcelas"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
