import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Percent,
  Landmark,
  Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useProperties,
  useInstallments,
  useMaintenances,
  useContracts,
} from "@/lib/queries";
import { useDocuments } from "@/lib/documents";
import { useUserRole, roleHomePath } from "@/lib/useUserRole";
import { formatBRL, monthRange } from "@/lib/format";
import { PortfolioSummary } from "@/components/owner/PortfolioSummary";
import { PortfolioInsights } from "@/components/owner/PortfolioInsights";
import { PendingApprovalsPanel } from "@/components/owner/PendingApprovalsPanel";
import { OperationalIndicators } from "@/components/owner/OperationalIndicators";
import { buildOwnerInsights } from "@/lib/owner-insights";

const DashboardCollectionChart = lazy(
  () => import("@/components/charts/DashboardCollectionChart"),
);
const ForecastVsReceivedChart = lazy(
  () => import("@/components/owner/ForecastVsReceivedChart"),
);
const OccupancyChart = lazy(() => import("@/components/owner/OccupancyChart"));

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Visão Geral — Nexo" }] }),
  component: Dashboard,
});

type Period = "6m" | "12m" | "ytd";

function Dashboard() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  useEffect(() => {
    if (role && role !== "owner") navigate({ to: roleHomePath(role), replace: true });
  }, [role, navigate]);

  const { data: properties = [] } = useProperties();
  const { data: installments = [] } = useInstallments();
  const { data: contracts = [] } = useContracts();
  const { data: maintenances = [] } = useMaintenances();
  const { data: documents = [] } = useDocuments();

  const [period, setPeriod] = useState<Period>("6m");

  const occupiedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of contracts as any[]) {
      if (c.active && !c.deleted_at && c.property_id) ids.add(c.property_id);
    }
    return ids;
  }, [contracts]);

  const pendingApprovals = (maintenances as any[]).filter(
    (m) => m.budget_status === "pendente",
  );

  const stats = useMemo(() => {
    const { start, end } = monthRange();
    const monthly = installments.filter(
      (i) => i.due_date >= start && i.due_date <= end,
    );
    const forecast = monthly.reduce(
      (s, i) => s + Number(i.amount || 0),
      0,
    );
    const paid = monthly
      .filter((i) => i.status === "pago")
      .reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);
    const pending = monthly
      .filter((i) => i.status !== "pago")
      .reduce((s, i) => s + Number(i.amount) + Number(i.extra_fees || 0), 0);

    const today = new Date().toISOString().slice(0, 10);
    const overdue = installments
      .filter((i) => i.status !== "pago" && i.due_date < today)
      .reduce((s, i) => s + Number(i.amount) + Number(i.extra_fees || 0), 0);

    const total = properties.length;
    const rented = properties.filter((p) => occupiedIds.has(p.id)).length;
    const available = total - rented;

    // Taxa administrativa paga (parcelas pagas × management_fee_percent efetivo)
    const mgmtFee = installments
      .filter((i) => i.status === "pago")
      .reduce((s, i) => {
        const amt = Number(i.paid_amount || i.amount || 0);
        const pct = Number(i.management_fee_percent || 0);
        return s + (amt * pct) / 100;
      }, 0);

    // Manutenções aprovadas do owner (retido)
    const maintCost = (maintenances as any[])
      .filter(
        (m) =>
          m.responsible === "proprietario" &&
          (m.budget_status === "aprovado" || m.status === "concluido"),
      )
      .reduce((s, m) => s + Number(m.budget_amount || m.cost || 0), 0);

    // YTD
    const year = new Date().getFullYear();
    const ytdPaid = installments
      .filter(
        (i) =>
          i.status === "pago" &&
          i.due_date?.startsWith(String(year)),
      )
      .reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);
    const monthsElapsed = new Date().getMonth() + 1;
    const avgMonthly = monthsElapsed > 0 ? ytdPaid / monthsElapsed : 0;

    const netRevenue = paid - mgmtFee - maintCost;

    // Docs pendentes (heurística: sem categoria ou com status pendente)
    const pendingDocs = (documents as any[]).filter(
      (d) => d.status === "pendente" || d.pending === true,
    ).length;

    // Mês anterior (para tendências)
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevRange = monthRange(prev);
    const prevMonthly = installments.filter(
      (i) => i.due_date >= prevRange.start && i.due_date <= prevRange.end,
    );
    const prevForecast = prevMonthly.reduce((s, i) => s + Number(i.amount || 0), 0);
    const prevPaid = prevMonthly
      .filter((i) => i.status === "pago")
      .reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);
    const prevPending = prevMonthly
      .filter((i) => i.status !== "pago")
      .reduce((s, i) => s + Number(i.amount) + Number(i.extra_fees || 0), 0);
    const prevOverdue = installments
      .filter(
        (i) =>
          i.status !== "pago" &&
          i.due_date < prevRange.end &&
          i.due_date >= prevRange.start,
      )
      .reduce((s, i) => s + Number(i.amount) + Number(i.extra_fees || 0), 0);

    const delta = (curr: number, before: number) =>
      before > 0 ? ((curr - before) / before) * 100 : null;

    return {
      forecast,
      paid,
      pending,
      overdue,
      total,
      rented,
      available,
      mgmtFee,
      maintCost,
      netRevenue,
      ytdPaid,
      avgMonthly,
      trends: {
        forecast: delta(forecast, prevForecast),
        received: delta(paid, prevPaid),
        pending: delta(pending, prevPending),
        overdue: delta(overdue, prevOverdue),
      },
      openMaintenances: (maintenances as any[]).filter(
        (m) => m.status !== "concluido" && m.status !== "cancelado",
      ).length,
      pendingDocs,
      activeContracts: (contracts as any[]).filter(
        (c) => c.active && !c.deleted_at,
      ).length,
    };
  }, [properties, installments, contracts, maintenances, occupiedIds, documents]);


  const monthsCount = period === "6m" ? 6 : period === "12m" ? 12 : new Date().getMonth() + 1;

  const collectionData = useMemo(() => {
    const arr: { month: string; pago: number; pendente: number }[] = [];
    const now = new Date();
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const items = installments.filter((x) => x.due_date.startsWith(ym));
      arr.push({
        month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        pago: items
          .filter((i) => i.status === "pago")
          .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0),
        pendente: items
          .filter((i) => i.status !== "pago")
          .reduce((s, i) => s + Number(i.amount), 0),
      });
    }
    return arr;
  }, [installments, monthsCount]);

  const forecastData = useMemo(() => {
    const arr: { month: string; previsto: number; recebido: number }[] = [];
    const now = new Date();
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const items = installments.filter((x) => x.due_date.startsWith(ym));
      arr.push({
        month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        previsto: items.reduce((s, i) => s + Number(i.amount), 0),
        recebido: items
          .filter((i) => i.status === "pago")
          .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0),
      });
    }
    return arr;
  }, [installments, monthsCount]);

  const occupancyData = useMemo(() => {
    // Ocupação histórica: para cada mês, % de imóveis com contrato ativo naquele mês
    const arr: { month: string; ocupacao: number }[] = [];
    const now = new Date();
    const total = properties.length || 1;
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
        .toISOString()
        .slice(0, 10);
      const monthStart = d.toISOString().slice(0, 10);
      const occupied = new Set<string>();
      for (const c of contracts as any[]) {
        if (c.deleted_at || !c.property_id) continue;
        const s = c.start_date;
        const e = c.end_date || "9999-12-31";
        if (s && s <= monthEnd && e >= monthStart) occupied.add(c.property_id);
      }
      arr.push({
        month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        ocupacao: Math.round((occupied.size / total) * 100),
      });
    }
    return arr;
  }, [contracts, properties, monthsCount]);

  const insights = useMemo(
    () =>
      buildOwnerInsights({
        properties,
        contracts,
        installments,
        maintenances,
        occupiedIds,
      }),
    [properties, contracts, installments, maintenances, occupiedIds],
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80 font-medium mb-2">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
            Painel executivo
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
            Bem-vindo de volta
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhe rapidamente a saúde da sua carteira — em tempo real.
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="6m">6m</TabsTrigger>
            <TabsTrigger value="12m">12m</TabsTrigger>
            <TabsTrigger value="ytd">Ano</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Carteira consolidada */}
      <PortfolioSummary
        data={{
          totalProperties: stats.total,
          rentedProperties: stats.rented,
          availableProperties: stats.available,
          activeContracts: stats.activeContracts,
          forecastRevenue: stats.forecast,
          receivedRevenue: stats.paid,
          pendingRevenue: stats.pending,
          overdueAmount: stats.overdue,
          trends: stats.trends,
        }}
      />

      {/* Aprovações pendentes acionáveis */}
      <PendingApprovalsPanel items={pendingApprovals} />

      {/* Indicadores operacionais (abaixo da dobra) */}
      <OperationalIndicators
        openMaintenances={stats.openMaintenances}
        pendingDocuments={stats.pendingDocs}
        activeContracts={stats.activeContracts}
      />

      {/* Insights + Coleta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <PortfolioInsights insights={insights} />
        </div>

        <Card className="lg:col-span-2 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="size-4 text-muted-foreground" />
                Coleta mensal
              </h3>
              <p className="text-sm text-muted-foreground">Pago x pendente por mês</p>
            </div>
          </div>
          <div className="h-44">
            <Suspense fallback={<div className="h-full w-full animate-pulse rounded-md bg-muted/40" />}>
              <DashboardCollectionChart data={collectionData} />
            </Suspense>
          </div>
        </Card>
      </div>

      {/* KPIs financeiros detalhados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Receita líquida (mês)" value={formatBRL(stats.netRevenue)} icon={<Wallet className="size-4" />} tone="primary" />
        <KpiCard title="Retido em manutenção" value={formatBRL(stats.maintCost)} icon={<TrendingDown className="size-4" />} />
        <KpiCard title="Taxa admin. paga" value={formatBRL(stats.mgmtFee)} icon={<Percent className="size-4" />} />
        <KpiCard title="Ticket médio mensal" value={formatBRL(stats.avgMonthly)} icon={<BarChart3 className="size-4" />} />
        <KpiCard title="Receita acumulada (ano)" value={formatBRL(stats.ytdPaid)} icon={<Landmark className="size-4" />} tone="emerald" />
        <KpiCard title="Receita prevista (mês)" value={formatBRL(stats.forecast)} icon={<Calendar className="size-4" />} />
        <KpiCard title="Receita pendente (mês)" value={formatBRL(stats.pending)} icon={<TrendingUp className="size-4" />} tone="amber" />
        <KpiCard title="Inadimplência total" value={formatBRL(stats.overdue)} icon={<TrendingDown className="size-4" />} tone="destructive" />
      </div>


      {/* Previsto × recebido + Ocupação */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 lg:p-6">
          <div className="mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              Previsto × recebido
            </h3>
            <p className="text-sm text-muted-foreground">Aderência ao forecast</p>
          </div>
          <div className="h-44">
            <Suspense fallback={<div className="h-full w-full animate-pulse rounded-md bg-muted/40" />}>
              <ForecastVsReceivedChart data={forecastData} />
            </Suspense>
          </div>
        </Card>

        <Card className="p-5 lg:p-6">
          <div className="mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <PieChart className="size-4 text-muted-foreground" />
              Ocupação da carteira
            </h3>
            <p className="text-sm text-muted-foreground">
              % de imóveis ocupados por mês
            </p>
          </div>
          <div className="h-44">
            <Suspense fallback={<div className="h-full w-full animate-pulse rounded-md bg-muted/40" />}>
              <OccupancyChart data={occupancyData} />
            </Suspense>
          </div>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone?: "primary" | "emerald" | "amber" | "destructive";
}) {
  const accent =
    tone === "primary"
      ? "text-primary"
      : tone === "emerald"
        ? "text-emerald-500"
        : tone === "amber"
          ? "text-amber-500"
          : tone === "destructive"
            ? "text-destructive"
            : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-1.5 text-muted-foreground">
        <span className="text-xs truncate">{title}</span>
        <span className={`shrink-0 ${accent}`}>{icon}</span>
      </div>
      <div className={`text-lg lg:text-xl font-bold tabular-nums truncate ${accent}`}>
        {value}
      </div>
    </Card>
  );
}
