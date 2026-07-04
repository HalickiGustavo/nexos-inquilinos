import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import {
  BarChart3, Download, FileText, Home, Wallet, TrendingUp, Wrench,
  CheckCircle2, AlertCircle, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useProperties, useContracts, useInstallments,
  useMaintenances,
} from "@/lib/queries";
import { formatBRL, formatBRLCompact, formatDate } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";

const RevenueBarChart = lazy(() =>
  import("@/components/charts/ReportsCharts").then((m) => ({ default: m.RevenueBarChart })),
);
const ExpensesPieChart = lazy(() =>
  import("@/components/charts/ReportsCharts").then((m) => ({ default: m.ExpensesPieChart })),
);
const RevenueLineChart = lazy(() =>
  import("@/components/charts/ReportsCharts").then((m) => ({ default: m.RevenueLineChart })),
);

const ChartFallback = () => <div className="h-full w-full animate-pulse rounded-md bg-muted/40" />;

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — NEXO" }] }),
  component: LandlordRelatoriosPage,
});


function inRange(dateStr: string | null | undefined, from: string, to: string) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

function LandlordRelatoriosPage() {
  const { data: properties = [] } = useProperties();
  const { data: contracts = [] } = useContracts();
  const { data: installments = [] } = useInstallments();
  const { data: maintenances = [] } = useMaintenances();

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    .toISOString().slice(0, 10);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [propertyId, setPropertyId] = useState<string>("all");

  // Filtered datasets
  const filteredInstallments = useMemo(() => {
    return installments.filter((i: any) => {
      if (propertyId !== "all" && i.contract?.property?.id !== propertyId) return false;
      return inRange(i.due_date, from, to);
    });
  }, [installments, from, to, propertyId]);

  const filteredMaintenances = useMemo(() => {
    return maintenances.filter((m: any) => {
      if (propertyId !== "all" && m.property?.id !== propertyId) return false;
      return inRange((m.created_at ?? "").slice(0, 10), from, to);
    });
  }, [maintenances, from, to, propertyId]);

  // KPIs
  const kpi = useMemo(() => {
    const totalImoveis = properties.length;
    const alugados = properties.filter((p: any) => p.status === "alugado").length;
    const vagos = totalImoveis - alugados;
    const taxaOcupacao = totalImoveis ? Math.round((alugados / totalImoveis) * 100) : 0;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const yearEnd = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);

    const receitaMes = installments
      .filter((i: any) => i.status === "pago" && inRange(i.payment_date?.slice(0, 10) ?? i.due_date, monthStart, monthEnd))
      .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
    const receitaAno = installments
      .filter((i: any) => i.status === "pago" && inRange(i.payment_date?.slice(0, 10) ?? i.due_date, yearStart, yearEnd))
      .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);

    const totalRecebido = filteredInstallments
      .filter((i: any) => i.status === "pago")
      .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
    const totalPendente = filteredInstallments
      .filter((i: any) => ["pendente", "atrasado", "agendado"].includes(i.status))
      .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

    const gastoManutencao = filteredMaintenances
      .reduce((s: number, m: any) => s + Number(m.payment_paid_amount || m.budget_amount || 0), 0);

    const contratosAtivos = contracts.filter((c: any) => c.active).length;
    const em60Dias = new Date(now); em60Dias.setDate(em60Dias.getDate() + 60);
    const contratosVencendo = contracts.filter((c: any) => {
      if (!c.active || !c.end_date) return false;
      const end = new Date(c.end_date);
      return end >= now && end <= em60Dias;
    }).length;

    return {
      totalImoveis, alugados, vagos, taxaOcupacao,
      receitaMes, receitaAno, totalRecebido, totalPendente,
      gastoManutencao, qtdManutencoes: filteredMaintenances.length,
      contratosAtivos, contratosVencendo,
    };
  }, [properties, contracts, installments, filteredInstallments, filteredMaintenances]);

  // Monthly revenue chart (12 months)
  const monthlyRevenue = useMemo(() => {
    const months: { key: string; label: string; recebido: number; pendente: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        recebido: 0, pendente: 0,
      });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const i of installments) {
      if (propertyId !== "all" && i.contract?.property?.id !== propertyId) continue;
      const dateStr = (i.status === "pago" && i.payment_date ? i.payment_date : i.due_date)?.slice(0, 7);
      const bucket = byKey.get(dateStr);
      if (!bucket) continue;
      if (i.status === "pago") bucket.recebido += Number(i.paid_amount || i.amount || 0);
      else bucket.pendente += Number(i.amount || 0);
    }
    return months;
  }, [installments, propertyId]);

  // Expenses by property
  const expensesByProperty = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const m of filteredMaintenances) {
      const name = m.property?.nickname ?? "Sem imóvel";
      const value = Number(m.payment_paid_amount || m.budget_amount || 0);
      if (value === 0) continue;
      const cur = map.get(name);
      if (cur) cur.value += value;
      else map.set(name, { name, value });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredMaintenances]);

  // Profitability per property
  const profitability = useMemo(() => {
    const rows = properties
      .filter((p: any) => propertyId === "all" || p.id === propertyId)
      .map((p: any) => {
        const recebido = filteredInstallments
          .filter((i: any) => i.contract?.property?.id === p.id && i.status === "pago")
          .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
        const gasto = filteredMaintenances
          .filter((m: any) => m.property?.id === p.id)
          .reduce((s: number, m: any) => s + Number(m.payment_paid_amount || m.budget_amount || 0), 0);
        return { id: p.id, nickname: p.nickname, recebido, gasto, liquido: recebido - gasto };
      })
      .sort((a, b) => b.liquido - a.liquido);
    return rows;
  }, [properties, filteredInstallments, filteredMaintenances, propertyId]);

  const propNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) m.set(p.id, p.nickname);
    return m;
  }, [properties]);

  const filtroLabel = `Período: ${formatDate(from)} a ${formatDate(to)} — Imóvel: ${
    propertyId === "all" ? "Todos" : propNameById.get(propertyId) ?? "—"
  }`;

  async function exportFinanceiroPdf() {
    const lines: string[] = [
      "Relatório Financeiro — NEXO",
      filtroLabel,
      "",
      `Total recebido no período: ${formatBRL(kpi.totalRecebido)}`,
      `Total pendente no período: ${formatBRL(kpi.totalPendente)}`,
      `Gasto em manutenção: ${formatBRL(kpi.gastoManutencao)}`,
      `Lucro líquido: ${formatBRL(kpi.totalRecebido - kpi.gastoManutencao)}`,
      "",
      "Rentabilidade por imóvel:",
      ...profitability.map((r) =>
        `- ${r.nickname}: recebido ${formatBRL(r.recebido)} • gasto ${formatBRL(r.gasto)} • líquido ${formatBRL(r.liquido)}`,
      ),
      "",
      "Receita mensal (últimos 12 meses):",
      ...monthlyRevenue.map((m) =>
        `- ${m.key}: recebido ${formatBRL(m.recebido)} • pendente ${formatBRL(m.pendente)}`,
      ),
    ];
    await downloadPdf(`relatorio-financeiro-${from}-a-${to}.pdf`, lines);
    toast.success("Relatório gerado");
  }

  async function exportOperacionalPdf() {
    const lines: string[] = [
      "Relatório Operacional — NEXO",
      filtroLabel,
      "",
      `Total de imóveis: ${kpi.totalImoveis}`,
      `Alugados: ${kpi.alugados} • Vagos: ${kpi.vagos} • Ocupação: ${kpi.taxaOcupacao}%`,
      `Contratos ativos: ${kpi.contratosAtivos} • Vencendo em 60d: ${kpi.contratosVencendo}`,
      `Manutenções no período: ${kpi.qtdManutencoes}`,
      "",
      "Manutenções detalhadas:",
      ...filteredMaintenances.slice(0, 100).map((m: any) => {
        const val = Number(m.payment_paid_amount || m.budget_amount || 0);
        return `- ${formatDate(m.created_at?.slice(0, 10))} • ${m.property?.nickname ?? "—"} • ${m.title ?? "—"} • ${m.status} • ${formatBRL(val)}`;
      }),
    ];
    await downloadPdf(`relatorio-operacional-${from}-a-${to}.pdf`, lines);
    toast.success("Relatório gerado");
  }

  function exportCsv(kind: "financeiro" | "operacional") {
    let rows: string[][];
    let filename: string;
    if (kind === "financeiro") {
      rows = [
        ["Data vencimento", "Data pagamento", "Imóvel", "Inquilino", "Valor", "Pago", "Status"],
        ...filteredInstallments.map((i: any) => [
          i.due_date ?? "",
          i.payment_date?.slice(0, 10) ?? "",
          i.contract?.property?.nickname ?? "",
          i.contract?.tenant?.full_name ?? "",
          String(i.amount ?? ""),
          String(i.paid_amount ?? ""),
          i.status ?? "",
        ]),
      ];
      filename = `financeiro-${from}-a-${to}.csv`;
    } else {
      rows = [
        ["Data", "Imóvel", "Título", "Categoria", "Status", "Responsável execução", "Valor aprovado", "Valor pago"],
        ...filteredMaintenances.map((m: any) => [
          m.created_at?.slice(0, 10) ?? "",
          m.property?.nickname ?? "",
          m.title ?? "",
          m.category ?? "",
          m.status ?? "",
          m.execution_responsible ?? "",
          String(m.budget_amount ?? ""),
          String(m.payment_paid_amount ?? ""),
        ]),
      ];
      filename = `operacional-${from}-a-${to}.csv`;
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 print:p-0">
      <div className="flex items-start justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Indicadores, análises e exportações financeiras e operacionais.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4 mr-2" /> Imprimir
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-3 md:p-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Início</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fim</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Imóvel</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos imóveis</SelectItem>
                {properties.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{filtroLabel}</p>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard icon={Home} label="Imóveis" value={String(kpi.totalImoveis)} />
        <KpiCard icon={CheckCircle2} label="Alugados" value={String(kpi.alugados)} sub={`${kpi.taxaOcupacao}% ocupação`} />
        <KpiCard icon={AlertCircle} label="Vagos" value={String(kpi.vagos)} />
        <KpiCard icon={FileText} label="Contratos ativos" value={String(kpi.contratosAtivos)} sub={`${kpi.contratosVencendo} vencendo em 60d`} />
        <KpiCard icon={Wallet} label="Receita do mês" value={formatBRLCompact(kpi.receitaMes)} accent />
        <KpiCard icon={TrendingUp} label="Receita do ano" value={formatBRLCompact(kpi.receitaAno)} />
        <KpiCard icon={CheckCircle2} label="Recebido (período)" value={formatBRLCompact(kpi.totalRecebido)} />
        <KpiCard icon={AlertCircle} label="Pendente (período)" value={formatBRLCompact(kpi.totalPendente)} />
        <KpiCard icon={Wrench} label="Gasto manutenção" value={formatBRLCompact(kpi.gastoManutencao)} sub={`${kpi.qtdManutencoes} ocorrência(s)`} />
        <KpiCard
          icon={BarChart3}
          label="Lucro líquido"
          value={formatBRLCompact(kpi.totalRecebido - kpi.gastoManutencao)}
          accent
        />
      </div>

      {/* Tabs de relatórios */}
      <Tabs defaultValue="financeiro" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full sm:w-auto print:hidden">
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="space-y-4">
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button size="sm" variant="outline" onClick={() => exportCsv("financeiro")}>
              <Download className="size-3.5 mr-1.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportFinanceiroPdf}>
              <FileText className="size-3.5 mr-1.5" /> PDF
            </Button>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Receita mensal (últimos 12 meses)</h3>
            <div className="h-72">
              <Suspense fallback={<ChartFallback />}>
                <RevenueBarChart data={monthlyRevenue} />
              </Suspense>
            </div>

          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Gastos por imóvel</h3>
              {expensesByProperty.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem gastos no período.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensesByProperty}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                        label={(e) => e.name}
                      >
                        {expensesByProperty.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Rentabilidade por imóvel</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground uppercase border-b">
                      <th className="py-2 pr-2">Imóvel</th>
                      <th className="py-2 pr-2 text-right">Recebido</th>
                      <th className="py-2 pr-2 text-right">Gasto</th>
                      <th className="py-2 text-right">Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitability.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 truncate max-w-[160px]" title={r.nickname}>{r.nickname}</td>
                        <td className="py-2 pr-2 text-right">{formatBRL(r.recebido)}</td>
                        <td className="py-2 pr-2 text-right">{formatBRL(r.gasto)}</td>
                        <td className={`py-2 text-right font-medium ${r.liquido < 0 ? "text-destructive" : ""}`}>
                          {formatBRL(r.liquido)}
                        </td>
                      </tr>
                    ))}
                    {profitability.length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sem dados no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operacional" className="space-y-4">
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button size="sm" variant="outline" onClick={() => exportCsv("operacional")}>
              <Download className="size-3.5 mr-1.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportOperacionalPdf}>
              <FileText className="size-3.5 mr-1.5" /> PDF
            </Button>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Ocupação x contratos ativos</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="recebido" stroke={CHART_COLORS[0]} name="Recebido" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Manutenções no período</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase border-b">
                    <th className="py-2 pr-2">Data</th>
                    <th className="py-2 pr-2">Imóvel</th>
                    <th className="py-2 pr-2">Título</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaintenances.slice(0, 50).map((m: any) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">{formatDate(m.created_at?.slice(0, 10))}</td>
                      <td className="py-2 pr-2 truncate max-w-[140px]">{m.property?.nickname ?? "—"}</td>
                      <td className="py-2 pr-2 truncate max-w-[200px]">{m.title ?? "—"}</td>
                      <td className="py-2 pr-2 capitalize">{m.status}</td>
                      <td className="py-2 text-right">
                        {formatBRL(Number(m.payment_paid_amount || m.budget_amount || 0))}
                      </td>
                    </tr>
                  ))}
                  {filteredMaintenances.length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sem manutenções no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: any; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <Card className={`p-3 md:p-4 ${accent ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="size-3.5" />
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg md:text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
