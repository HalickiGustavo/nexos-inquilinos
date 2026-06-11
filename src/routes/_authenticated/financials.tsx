import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Wallet, Plus, AlertCircle, Clock, Building2, FileText, Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useInstallments, useInvalidate, type Installment } from "@/lib/queries";
import { formatBRL, formatDate, parseNumber } from "@/lib/format";
import { generateAsaasCharge, updateAsaasChargeFee } from "@/lib/asaas.functions";
import { parseExpenses, expensesTotals } from "@/lib/variable-expenses";

export const Route = createFileRoute("/_authenticated/financials")({
  head: () => ({ meta: [{ title: "Finanças — ImovelPro" }] }),
  component: FinancialsPage,
});

type Filter = "todos" | "pendente" | "pago" | "atrasado";

type EffectiveStatus = "pago" | "pendente" | "atrasado";

function effective(i: Installment, today: string): EffectiveStatus {
  if (i.status === "pago") return "pago";
  if (i.due_date < today) return "atrasado";
  return "pendente";
}

function FinancialsPage() {
  const { data: installments = [], isLoading } = useInstallments();
  const [filter, setFilter] = useState<Filter>("todos");
  const [extraDlg, setExtraDlg] = useState<Installment | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const totals = useMemo(() => {
    let pending = 0, paid = 0, overdue = 0;
    for (const i of installments) {
      const s = effective(i, today);
      const total = Number(i.amount) + Number(i.extra_fees);
      if (s === "pendente") pending += total;
      else if (s === "atrasado") overdue += total;
      else paid += Number(i.paid_amount || i.amount);
    }
    return { pending, paid, overdue };
  }, [installments, today]);

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; contract: any; items: any[] }>();
    for (const i of installments as any[]) {
      const key = i.contract_id ?? `sem-contrato-${i.id}`;
      if (!map.has(key)) map.set(key, { id: key, contract: i.contract, items: [] });
      map.get(key)!.items.push(i);
    }
    return Array.from(map.values()).map((g) => {
      const visible = g.items.filter((i) => filter === "todos" || effective(i, today) === filter);
      const total = g.items.reduce((s, i) => s + Number(i.amount) + Number(i.extra_fees), 0);
      const paidCount = g.items.filter((i) => i.status === "pago").length;
      const overdueCount = g.items.filter((i) => effective(i, today) === "atrasado").length;
      return { ...g, visible, total, paidCount, overdueCount };
    }).filter((g) => g.visible.length > 0);
  }, [installments, filter, today]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finanças</h1>
        <p className="text-muted-foreground mt-1">Parcelas agrupadas por contrato. Clique para expandir.</p>
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
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center">
          <Wallet className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma parcela encontrada.</p>
        </Card>
      ) : (
        <Card className="p-2">
          <Accordion type="multiple" className="w-full">
            {groups.map((g) => (
              <AccordionItem key={g.id} value={g.id}>
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full gap-4 pr-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-md bg-muted shrink-0">
                        <Building2 className="size-4" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-semibold truncate">{g.contract?.tenant?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {g.contract?.property?.nickname} — {g.contract?.property?.address}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {g.overdueCount > 0 && <Badge variant="destructive">{g.overdueCount} atrasada(s)</Badge>}
                      <Badge variant="secondary">{g.paidCount}/{g.items.length} pagas</Badge>
                      <div className="text-right hidden sm:block">
                        <div className="text-xs text-muted-foreground">Total contrato</div>
                        <div className="font-bold text-primary">{formatBRL(g.total)}</div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="text-left p-2 font-medium">Vencimento</th>
                          <th className="text-right p-2 font-medium">Valor</th>
                          <th className="text-right p-2 font-medium">Extras</th>
                          <th className="text-left p-2 font-medium">Status</th>
                          <th className="text-right p-2 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.visible.map((i: any) => {
                          const s = effective(i, today);
                          const finePct = Number(g.contract?.late_fee_percent ?? 0);
                          const dailyPct = Number(g.contract?.daily_interest_percent ?? 0);
                          const base = Number(i.amount) + Number(i.extra_fees);
                          const daysLate = s === "atrasado"
                            ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(i.due_date)) / 86400000))
                            : 0;
                          const previewLate = s === "atrasado" && !i.asaas_payment_id
                            ? +(base * finePct / 100 + base * dailyPct / 100 * daysLate).toFixed(2)
                            : Number(i.late_charges ?? 0);
                          return (
                            <tr key={i.id} className="border-t">
                              <td className="p-2">{formatDate(i.due_date)}</td>
                              <td className="p-2 text-right font-medium">{formatBRL(Number(i.amount))}</td>
                              <td className="p-2 text-right text-muted-foreground">
                                {(() => {
                                  const exps = parseExpenses(i.variable_expenses);
                                  const t = expensesTotals(exps);
                                  const hasAny = Number(i.extra_fees) > 0 || exps.length > 0 || previewLate > 0;
                                  if (!hasAny) return "—";
                                  return (
                                    <div className="space-y-0.5">
                                      {Number(i.extra_fees) > 0 && <div>{formatBRL(Number(i.extra_fees))}</div>}
                                      {t.tenant > 0 && (
                                        <div className="text-xs text-amber-600">+{formatBRL(t.tenant)} cobrança inq.</div>
                                      )}
                                      {t.owner > 0 && (
                                        <div className="text-xs text-primary">−{formatBRL(t.owner)} desp. prop.</div>
                                      )}
                                      {previewLate > 0 && (
                                        <div className="text-xs text-destructive">
                                          +{formatBRL(previewLate)} juros/multa{daysLate > 0 ? ` (${daysLate}d)` : ""}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="p-2"><StatusBadge status={s} /></td>
                              <td className="p-2 text-right whitespace-nowrap space-x-1">
                                {i.status !== "pago" && !i.asaas_payment_id && <GenerateBoletoButton installment={i} />}
                                {i.asaas_payment_id && i.status !== "pago" && <UpdateBoletoButton installment={i} />}
                                {i.boleto_url && (
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={i.boleto_url} target="_blank" rel="noreferrer">
                                      <FileText className="size-3.5 mr-1" /> Boleto
                                    </a>
                                  </Button>
                                )}
                                {i.barcode && (
                                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(i.barcode); toast.success("Linha digitável copiada"); }}>
                                    <Copy className="size-3.5" />
                                  </Button>
                                )}
                                {i.status !== "pago" && <MarkPaidButton installment={i} />}
                                <Button size="sm" variant="outline" onClick={() => setExtraDlg(i)}>
                                  <Plus className="size-3.5 mr-1" />Taxa
                                </Button>
                              </td>
                            </tr>
                          );
                        })}

                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}

      <Dialog open={!!extraDlg} onOpenChange={(o) => !o && setExtraDlg(null)}>
        {extraDlg && <ExtraFeeDialog installment={extraDlg} onDone={() => setExtraDlg(null)} />}
      </Dialog>
    </div>
  );
}

function GenerateBoletoButton({ installment }: { installment: any }) {
  const generate = useServerFn(generateAsaasCharge);
  const invalidate = useInvalidate();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await generate({ data: { installmentId: installment.id, billingType: "UNDEFINED" } });
          toast.success("Boleto gerado!");
          invalidate(["installments"]);
        } catch (e: any) {
          toast.error(e?.message ?? "Falha ao gerar boleto");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <FileText className="size-3.5 mr-1" />}
      Gerar boleto
    </Button>
  );
}

function UpdateBoletoButton({ installment }: { installment: any }) {
  const update = useServerFn(updateAsaasChargeFee);
  const invalidate = useInvalidate();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      title="Atualizar valor do boleto incluindo taxa NEXO"
      onClick={async () => {
        setLoading(true);
        try {
          await update({ data: { installmentId: installment.id } });
          toast.success("Valor do boleto atualizado");
          invalidate(["installments"]);
        } catch (e: any) {
          toast.error(e?.message ?? "Falha ao atualizar");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Wallet className="size-3.5 mr-1" />}
      Atualizar taxa
    </Button>
  );
}

function MarkPaidButton({ installment }: { installment: any }) {
  const invalidate = useInvalidate();
  return (
    <Button size="sm" className="mr-1" onClick={async () => {
      const total = Number(installment.amount) + Number(installment.extra_fees);
      const { error } = await supabase.from("installments").update({
        status: "pago",
        paid_amount: total,
        payment_date: new Date().toISOString(),
      }).eq("id", installment.id);
      if (error) return toast.error(error.message);
      toast.success("Parcela marcada como paga");
      invalidate(["installments"]);
    }}>
      <CheckCircle2 className="size-3.5 mr-1" />Pago
    </Button>
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
