import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { formatBRL, formatDate } from "@/lib/format";
import { CheckCircle2, Receipt, Sparkles, ChevronRight, BadgeCheck, FileText, Loader2, Wallet, Copy } from "lucide-react";
import { toast } from "sonner";
import { VariableExpensesDialog } from "@/components/VariableExpensesDialog";
import { SplitBreakdownDialog, NEXO_FEE_PER_INSTALLMENT } from "@/components/SplitBreakdownDialog";
import { parseExpenses, expensesTotals } from "@/lib/variable-expenses";
import { generateAsaasCharge, updateAsaasChargeFee } from "@/lib/asaas.functions";
import { PageHeader, PageShell } from "@/components/PageHeader";
import { useConfirm } from "@/components/ui/confirm";

export const Route = createFileRoute("/_manager/manager/financeiro")({
  component: Financeiro,
});

function Financeiro() {
  return (
    <PageShell>
      <PageHeader
        title="Financeiro"
        description="Recebimentos da imobiliária e repasses aos proprietários."
      />
      <Tabs defaultValue="recebimentos">
        <TabsList>
          <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
          <TabsTrigger value="repasses">Repasses</TabsTrigger>
        </TabsList>
        <TabsContent value="recebimentos"><Recebimentos /></TabsContent>
        <TabsContent value="repasses"><Repasses /></TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Recebimentos() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [statusF, setStatusF] = useState("todos");
  const [from, setFrom] = useState("");
  const [expensesFor, setExpensesFor] = useState<any | null>(null);
  const [splitFor, setSplitFor] = useState<any | null>(null);
  const [to, setTo] = useState("");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const q = useQuery({
    queryKey: ["mgr-receb", statusF, from, to],
    queryFn: async () => {
      let query = supabase
        .from("installments")
        .select("*, contract:contracts(id,property:properties(code,address,owner_name), tenant:tenants(full_name))")
        .order("due_date", { ascending: false });

      if (statusF !== "todos") {
        query = query.eq("status", statusF as any);
      }
      if (from) {
        query = query.gte("due_date", from);
      }
      if (to) {
        query = query.lte("due_date", to);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const groupList = useMemo(() => {
    const rows = q.data ?? [];
    const groups: Record<string, any> = {};
    for (const i of rows) {
      const cid = i.contract?.id ?? i.contract_id ?? "—";
      if (!groups[cid]) {
        groups[cid] = {
          contractId: cid,
          property: i.contract?.property,
          tenant: i.contract?.tenant,
          items: [],
        };
      }
      groups[cid].items.push(i);
    }
    return Object.values(groups) as any[];
  }, [q.data]);

  const badge = (s: string) => {
    const map: Record<string, string> = {
      pago: "bg-primary/15 text-primary border-primary/30",
      atrasado: "bg-red-500/15 text-red-700 border-red-500/30",
      pendente: "bg-amber-500/15 text-amber-700 border-amber-500/30",
      acordo_fechado: "bg-violet-500/15 text-violet-700 border-violet-500/30",
    };
    return <Badge variant="outline" className={map[s] ?? ""}>{s}</Badge>;
  };

  const markAsPaid = async (i: any) => {
    const ok = await confirm({
      title: "Confirmar pagamento manual?",
      description: `Deseja marcar esta parcela com vencimento em ${formatDate(i.due_date)} como paga? Esta ação registrará o recebimento integral na plataforma.`,
      confirmLabel: "Confirmar pagamento",
      tone: "info",
    });
    if (!ok) return;

    const exps = parseExpenses(i.variable_expenses);
    const t = expensesTotals(exps);
    const due = Number(i.amount) + t.tenant;
    const { error } = await supabase
      .from("installments")
      .update({
        status: "pago",
        paid_amount: due,
        payment_date: new Date().toISOString(),
      } as any)
      .eq("id", i.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Parcela marcada como paga");
    qc.invalidateQueries({ queryKey: ["mgr-receb"] });
    qc.invalidateQueries({ queryKey: ["mgr-repasses"] });
  };

  return (
    <div className="space-y-3 mt-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <Sparkles className="size-4 text-primary" />
          <div className="text-sm">
            <span className="font-semibold">Split Automático Ativo:</span>{" "}
            <span className="text-primary font-medium">{formatBRL(NEXO_FEE_PER_INSTALLMENT)} para NEXO</span>
            <span className="text-muted-foreground"> + valor restante para sua subconta, por parcela emitida.</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1"><label className="text-xs">Status</label>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente (No prazo)</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado (Vencido)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><label className="text-xs">De</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><label className="text-xs">Até</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Imóvel</TableHead>
            <TableHead>Inquilino</TableHead>
            <TableHead className="text-right">Parcelas</TableHead>
            <TableHead className="text-right">Pagas</TableHead>
            <TableHead className="text-right">Pendentes</TableHead>
            <TableHead className="text-right">Atrasadas</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {q.isLoading && <TableRowsSkeleton cols={8} rows={5} />}
            {!q.isLoading && groupList.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-zinc-500">Sem registros</TableCell></TableRow>}

            {groupList.map((g) => {
              const isOpen = !!expanded[g.contractId];
              const total = g.items.reduce((s: number, i: any) => {
                const t = expensesTotals(parseExpenses(i.variable_expenses));
                return s + Number(i.amount) + t.tenant;
              }, 0);
              const counts = g.items.reduce((acc: any, i: any) => {
                acc[i.status] = (acc[i.status] ?? 0) + 1;
                return acc;
              }, {});
              return (
                <Fragment key={g.contractId}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50 font-medium"
                    onClick={() => setExpanded((s) => ({ ...s, [g.contractId]: !s[g.contractId] }))}
                  >
                    <TableCell><ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} /></TableCell>
                    <TableCell className="text-xs font-mono">{g.property?.code ?? "—"}</TableCell>
                    <TableCell>{g.tenant?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-right">{g.items.length}</TableCell>
                    <TableCell className="text-right text-primary">{counts.pago ?? 0}</TableCell>
                    <TableCell className="text-right text-amber-600">{counts.pendente ?? 0}</TableCell>
                    <TableCell className="text-right text-red-600">{counts.atrasado ?? 0}</TableCell>
                    <TableCell className="text-right">{formatBRL(total)}</TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow key={g.contractId + "-exp"}>
                      <TableCell colSpan={8} className="bg-muted/30 p-0">
                        <div className="overflow-x-auto">
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Aluguel</TableHead>
                            <TableHead className="text-right">Despesas</TableHead>
                            <TableHead className="text-right">Devido</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {g.items.map((i: any) => {
                              const exps = parseExpenses(i.variable_expenses);
                              const t = expensesTotals(exps);
                              const due = Number(i.amount) + t.tenant;
                              return (
                                <TableRow key={i.id}>
                                  <TableCell>{formatDate(i.due_date)}</TableCell>
                                  <TableCell className="text-right">{formatBRL(i.amount)}</TableCell>
                                  <TableCell className="text-right text-xs">
                                    {exps.length === 0 ? (
                                      <span className="text-zinc-400">—</span>
                                    ) : (
                                      <span>
                                        <span className="text-amber-600">+{formatBRL(t.tenant)}</span>
                                        {t.owner > 0 && <span className="text-primary ml-1">−{formatBRL(t.owner)}</span>}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">{formatBRL(due)}</TableCell>
                                  <TableCell>{badge(i.status)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2 flex-wrap">
                                      {i.status !== "pago" && !i.asaas_payment_id && (
                                        <GenerateBoletoBtn installment={i} onDone={() => qc.invalidateQueries({ queryKey: ["mgr-receb"] })} />
                                      )}
                                      {i.status !== "pago" && i.asaas_payment_id && (
                                        <UpdateBoletoBtn installment={i} onDone={() => qc.invalidateQueries({ queryKey: ["mgr-receb"] })} />
                                      )}
                                      {i.boleto_url && (
                                        <Button size="sm" variant="outline" asChild>
                                          <a href={i.boleto_url} target="_blank" rel="noreferrer">
                                            <FileText className="size-4 mr-1" /> Boleto
                                          </a>
                                        </Button>
                                      )}
                                      {i.barcode && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            navigator.clipboard.writeText(i.barcode);
                                            toast.success("Linha digitável copiada");
                                          }}
                                        >
                                          <Copy className="size-4" />
                                        </Button>
                                      )}
                                      {i.status !== "pago" && (
                                        <Button
                                          size="sm"
                                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                                          onClick={() => markAsPaid(i)}
                                        >
                                          <BadgeCheck className="size-4 mr-1" /> Pago
                                        </Button>
                                      )}
                                      <Button size="sm" variant="outline" onClick={() => setSplitFor(i)}>
                                        <Sparkles className="size-4 mr-1" /> Split
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setExpensesFor(i)}>
                                        <Receipt className="size-4 mr-1" /> Despesas
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent></Card>

      {expensesFor && (
        <VariableExpensesDialog
          installment={expensesFor}
          open={!!expensesFor}
          onOpenChange={(o) => !o && setExpensesFor(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["mgr-receb"] })}
        />
      )}
      <SplitBreakdownDialog
        installment={splitFor}
        open={!!splitFor}
        onOpenChange={(o) => !o && setSplitFor(null)}
      />
    </div>
  );
}

function Repasses() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({
    queryKey: ["mgr-repasses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*, contract:contracts(property:properties(code,address,owner_name,owner_commission_percent))")
        .eq("status", "pago")
        .order("payment_date", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const confirmRepasse = async (id: string) => {
    const ok = await confirm({
      title: "Confirmar repasse ao proprietário?",
      description: "Você está confirmando que o valor já foi enviado para a conta do proprietário. Esta ação atualizará o status financeiro da parcela.",
      confirmLabel: "Confirmar repasse",
      tone: "info",
    });
    if (!ok) return;
    const { error } = await supabase.from("installments").update({ payout_status: "repassado", payout_date: new Date().toISOString() } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Repasse confirmado");
    qc.invalidateQueries({ queryKey: ["mgr-repasses"] });
  };

  return (
    <Card className="mt-4"><CardContent className="p-0">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Imóvel</TableHead>
          <TableHead>Proprietário</TableHead>
          <TableHead className="text-right">Recebido</TableHead>
          <TableHead className="text-right">Taxa Adm.</TableHead>
          <TableHead className="text-right">Despesas prop.</TableHead>
          <TableHead className="text-right">A Repassar</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {q.isLoading && <TableRowsSkeleton cols={8} rows={5} />}
          {!q.isLoading && (q.data ?? []).length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-zinc-500">Nenhum repasse</TableCell></TableRow>}

          {(q.data ?? []).map((i: any) => {
            const fee = Number(i.management_fee_percent ?? 10);
            const pago = Number(i.paid_amount ?? 0);
            const taxa = pago * fee / 100;
            const exps = parseExpenses(i.variable_expenses);
            const t = expensesTotals(exps);
            const repasse = pago - taxa - t.owner;
            const status = (i.payout_status ?? "aguardando");
            return (
              <TableRow key={i.id}>
                <TableCell className="text-xs font-mono">{i.contract?.property?.code ?? "—"}</TableCell>
                <TableCell>{i.contract?.property?.owner_name ?? "—"}</TableCell>
                <TableCell className="text-right">{formatBRL(pago)}</TableCell>
                <TableCell className="text-right text-zinc-500">{formatBRL(taxa)} ({fee}%)</TableCell>
                <TableCell className="text-right text-zinc-500">{t.owner > 0 ? `−${formatBRL(t.owner)}` : "—"}</TableCell>
                <TableCell className="text-right font-medium text-primary">{formatBRL(repasse)}</TableCell>
                <TableCell>
                  {status === "repassado"
                    ? <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline">Repassado</Badge>
                    : <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" variant="outline">Aguardando Repasse</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {status !== "repassado" && (
                    <Button size="sm" variant="outline" onClick={() => confirmRepasse(i.id)}>
                      <CheckCircle2 className="size-4 mr-1" /> Confirmar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </CardContent></Card>
  );
}

function GenerateBoletoBtn({ installment, onDone }: { installment: any; onDone: () => void }) {
  const generate = useServerFn(generateAsaasCharge);
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={loading}
      onClick={async () => {
        const ok = await confirm({
          title: "Gerar novo boleto/Pix?",
          description: "Um novo registro de cobrança será criado no gateway de pagamento (Asaas).",
          confirmLabel: "Gerar cobrança",
          tone: "info",
        });
        if (!ok) return;
        setLoading(true);
        try {
          const res: any = await generate({ data: { installmentId: installment.id, billingType: "UNDEFINED" } });
          if (res?.ok === false) {
            const msg = String(res.error ?? "Falha ao gerar boleto");
            const isLimit = /limite/i.test(msg);
            toast.error(msg, {
              description: isLimit
                ? "Você ainda pode registrar este pagamento manualmente em 'Pago'."
                : undefined,
              duration: 8000,
            });
          } else {
            toast.success("Boleto gerado!");
            onDone();
          }
        } catch (e: any) {
          toast.error(e?.message ?? "Falha ao gerar boleto");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <FileText className="size-4 mr-1" />}
      Gerar boleto
    </Button>
  );
}

function UpdateBoletoBtn({ installment, onDone }: { installment: any; onDone: () => void }) {
  const update = useServerFn(updateAsaasChargeFee);
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      title="Atualizar valor do boleto incluindo taxa NEXO"
      onClick={async () => {
        const ok = await confirm({
          title: "Atualizar taxa NEXO no boleto?",
          description: "O valor da cobrança atual será recalculado incluindo a taxa de serviço digital.",
          confirmLabel: "Atualizar valor",
          tone: "info",
        });
        if (!ok) return;
        setLoading(true);
        try {
          await update({ data: { installmentId: installment.id } });
          toast.success("Valor do boleto atualizado");
          onDone();
        } catch (e: any) {
          toast.error(e?.message ?? "Falha ao atualizar");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Wallet className="size-4 mr-1" />}
      Atualizar taxa
    </Button>
  );
}


function TableRowsSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
