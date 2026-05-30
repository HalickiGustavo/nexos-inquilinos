import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Wallet, Plus, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useInstallments, useInvalidate, type Installment } from "@/lib/queries";
import { formatBRL, formatDate, parseNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/financials")({
  head: () => ({ meta: [{ title: "Finanças — ImovelPro" }] }),
  component: FinancialsPage,
});

type Filter = "todos" | "pendente" | "pago" | "atrasado";

function FinancialsPage() {
  const { data: installments = [], isLoading } = useInstallments();
  const [filter, setFilter] = useState<Filter>("todos");
  const [extraDlg, setExtraDlg] = useState<Installment | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const enriched = installments.map((i) => ({
    ...i,
    effectiveStatus:
      i.status === "pago" ? "pago" : i.due_date < today ? "atrasado" : "pendente",
  }));

  const filtered = enriched.filter((i) => filter === "todos" || i.effectiveStatus === filter);

  const totals = useMemo(() => {
    const pending = enriched.filter((i) => i.effectiveStatus === "pendente").reduce((s, i) => s + Number(i.amount) + Number(i.extra_fees), 0);
    const paid = enriched.filter((i) => i.effectiveStatus === "pago").reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
    const overdue = enriched.filter((i) => i.effectiveStatus === "atrasado").reduce((s, i) => s + Number(i.amount) + Number(i.extra_fees), 0);
    return { pending, paid, overdue };
  }, [enriched]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finanças</h1>
        <p className="text-muted-foreground mt-1">Todas as parcelas de aluguel geradas pelos contratos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={<Clock className="size-5" />} label="Pendente" value={formatBRL(totals.pending)} />
        <SummaryCard icon={<CheckCircle2 className="size-5 text-primary" />} label="Pago" value={formatBRL(totals.paid)} accent="text-primary" />
        <SummaryCard icon={<AlertCircle className="size-5 text-destructive" />} label="Atrasado" value={formatBRL(totals.overdue)} accent="text-destructive" />
      </div>

      <Card className="p-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="atrasado">Atrasados</TabsTrigger>
            <TabsTrigger value="pago">Pagos</TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Wallet className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma parcela encontrada.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Imóvel</th>
                <th className="text-left p-3 font-medium">Inquilino</th>
                <th className="text-left p-3 font-medium">Vencimento</th>
                <th className="text-right p-3 font-medium">Valor</th>
                <th className="text-right p-3 font-medium">Extras</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i: any) => (
                <tr key={i.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{i.contract?.property?.nickname ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{i.contract?.tenant?.full_name ?? "—"}</td>
                  <td className="p-3">{formatDate(i.due_date)}</td>
                  <td className="p-3 text-right font-medium">{formatBRL(Number(i.amount))}</td>
                  <td className="p-3 text-right text-muted-foreground">{Number(i.extra_fees) > 0 ? formatBRL(Number(i.extra_fees)) : "—"}</td>
                  <td className="p-3">
                    <StatusBadge status={i.effectiveStatus} />
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {i.status !== "pago" && (
                      <Button size="sm" className="mr-1" onClick={async () => {
                        const total = Number(i.amount) + Number(i.extra_fees);
                        const { error } = await supabase.from("installments").update({
                          status: "pago",
                          paid_amount: total,
                          payment_date: new Date().toISOString(),
                        }).eq("id", i.id);
                        if (error) return toast.error(error.message);
                        toast.success("Parcela marcada como paga");
                      }}>
                        <CheckCircle2 className="size-3.5 mr-1" />Pago
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setExtraDlg(i)}>
                      <Plus className="size-3.5 mr-1" />Taxa
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={!!extraDlg} onOpenChange={(o) => !o && setExtraDlg(null)}>
        {extraDlg && <ExtraFeeDialog installment={extraDlg} onDone={() => setExtraDlg(null)} />}
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pago") return <Badge className="bg-primary text-primary-foreground">Pago</Badge>;
  if (status === "atrasado") return <Badge variant="destructive">Atrasado</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className="p-2.5 rounded-lg bg-muted">{icon}</div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
      </div>
    </Card>
  );
}

function ExtraFeeDialog({ installment, onDone }: { installment: Installment; onDone: () => void }) {
  const invalidate = useInvalidate();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Adicionar taxa extra</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const add = parseNumber(amount);
          if (add <= 0) return toast.error("Valor inválido");
          const newExtras = Number(installment.extra_fees) + add;
          const prevNotes = installment.notes ? installment.notes + "\n" : "";
          const newNote = `+ ${formatBRL(add)} — ${note || "taxa extra"}`;
          const { error } = await supabase.from("installments").update({
            extra_fees: newExtras,
            notes: prevNotes + newNote,
          }).eq("id", installment.id);
          if (error) return toast.error(error.message);
          toast.success("Taxa adicionada");
          invalidate(["installments"]);
          onDone();
        }}
      >
        <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="space-y-2"><Label>Descrição</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: Conta de água, energia, condomínio extra..." /></div>
        {installment.notes && (
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
            <div className="font-medium mb-1">Histórico:</div>
            <pre className="whitespace-pre-wrap font-sans">{installment.notes}</pre>
          </div>
        )}
        <DialogFooter><Button type="submit">Adicionar</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
