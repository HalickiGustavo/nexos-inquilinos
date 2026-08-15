import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useMemo } from "react";
import {
  Building2, Wallet, TrendingUp, TrendingDown, Wrench, ArrowRight, ArrowUpRight,
  AlertTriangle, FileText, Home, CheckCircle2, Clock, CircleDollarSign, Activity, Minus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/PageHeader";
import { RevenueTrendChart, DelinquencyAreaChart } from "@/components/charts/LandlordTrendCharts";
import {
  useLandlordProperties, useLandlordInstallments, useLandlordMaintenances,
  useLandlordSaldo, useLandlordContracts, useLandlordProfile,
} from "@/lib/landlord-queries";
import { formatBRL, formatDate, monthRange, today } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_landlord/landlord/")({
  head: () => ({
    meta: [
      { title: "Dashboard Executivo — Proprietário NEXO" },
      { name: "description", content: "Painel executivo do proprietário: receita do mês, pendências, inadimplência e ocupação da carteira em um só lugar." },
      { property: "og:title", content: "Dashboard Executivo — Proprietário NEXO" },
      { property: "og:description", content: "Acompanhe receita, inadimplência e ocupação da sua carteira de imóveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandlordDashboard,
});

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const num = (v: any) => Number(v ?? 0) || 0;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function LandlordDashboard() {
  const { data: properties = [], isPending: propsPending } = useLandlordProperties();
  const { data: installments = [], isPending: instPending } = useLandlordInstallments();
  const { data: maintenances = [], isPending: maintPending } = useLandlordMaintenances();
  const { data: contracts = [], isPending: contractsPending } = useLandlordContracts();
  const { data: profile } = useLandlordProfile();
  const { saldoDisponivel, totalRecebido, totalSacado, loading: saldoLoading } = useLandlordSaldo();

  const loading = propsPending || instPending || maintPending || contractsPending || saldoLoading;

  const s = useMemo(() => {
    const now = new Date();
    const { start, end } = monthRange(now);
    const prev = monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const hoje = today();
    const inst = installments as any[];

    const inRange = (i: any, a: string, b: string) => i.due_date >= a && i.due_date <= b;
    const isPaid = (i: any) => i.status === "pago";
    const val = (i: any) => num(i.paid_amount || i.amount);

    const monthly = inst.filter((i) => inRange(i, start, end));
    const received = monthly.filter(isPaid).reduce((t, i) => t + val(i), 0);
    const prevReceived = inst.filter((i) => inRange(i, prev.start, prev.end) && isPaid(i)).reduce((t, i) => t + val(i), 0);
    const pendingList = monthly.filter((i) => !isPaid(i) && i.due_date >= hoje);
    const pending = pendingList.reduce((t, i) => t + num(i.amount), 0);

    const overdueList = inst.filter((i) => !isPaid(i) && i.due_date < hoje);
    const overdue = overdueList.reduce((t, i) => t + num(i.amount), 0);

    const forecastMonth = monthly.reduce((t, i) => t + num(i.amount), 0);
    const receivedYear = inst
      .filter((i) => isPaid(i) && i.due_date.slice(0, 4) === String(now.getFullYear()))
      .reduce((t, i) => t + val(i), 0);

    const total = properties.length;
    const rented = (properties as any[]).filter((p) => p.status === "alugado").length;
    const available = total - rented;
    const occupancy = total === 0 ? 0 : Math.round((rented / total) * 100);
    const activeContracts = (contracts as any[]).filter((c) => c.active).length;

    const openMaint = (maintenances as any[]).filter((m) => m.status !== "concluida");

    const in30 = new Date(now.getTime() + 30 * 864e5).toISOString().slice(0, 10);
    const expiring = (contracts as any[]).filter(
      (c) => c.active && c.end_date && c.end_date >= hoje && c.end_date <= in30,
    );

    const delta = prevReceived === 0 ? null : Math.round(((received - prevReceived) / prevReceived) * 100);

    // Série dos últimos 12 meses
    const buckets = new Map<string, { label: string; recebido: number; pendente: number; atraso: number }>();
    for (let k = 11; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      buckets.set(monthKey(d), { label: MONTHS[d.getMonth()], recebido: 0, pendente: 0, atraso: 0 });
    }
    for (const i of inst) {
      const b = buckets.get(String(i.due_date).slice(0, 7));
      if (!b) continue;
      if (isPaid(i)) b.recebido += val(i);
      else {
        b.pendente += num(i.amount);
        if (i.due_date < hoje) b.atraso += num(i.amount);
      }
    }
    const series = [...buckets.values()];

    const health =
      overdue > 0 && received > 0 && overdue / (received + overdue) > 0.15
        ? { label: "Requer atenção", tone: "warn" as const }
        : overdue > 0
          ? { label: "Estável", tone: "ok" as const }
          : { label: "Saudável", tone: "ok" as const };

    return {
      received, prevReceived, delta, pending, pendingCount: pendingList.length,
      overdue, overdueCount: overdueList.length, forecastMonth, receivedYear,
      total, rented, available, occupancy, activeContracts,
      openMaint, expiring, series, health,
    };
  }, [properties, installments, maintenances, contracts]);

  const activity = useMemo(() => {
    const items: Array<{ id: string; icon: any; tone: string; text: string; when: string }> = [];
    for (const i of (installments as any[]).filter((x) => x.status === "pago" && x.paid_at).slice(0, 40)) {
      items.push({
        id: `p-${i.id}`, icon: CircleDollarSign, tone: "text-emerald-600 dark:text-emerald-400",
        text: `Pagamento recebido — ${formatBRL(i.paid_amount || i.amount)}`, when: i.paid_at,
      });
    }
    for (const m of (maintenances as any[]).slice(0, 10)) {
      items.push({
        id: `m-${m.id}`, icon: Wrench, tone: "text-amber-600 dark:text-amber-400",
        text: `Manutenção • ${m.title || m.description || "chamado"}`, when: m.created_at,
      });
    }
    for (const c of (contracts as any[]).slice(0, 10)) {
      items.push({
        id: `c-${c.id}`, icon: FileText, tone: "text-sky-600 dark:text-sky-400",
        text: `Contrato • ${c.property?.nickname || c.property?.address || "imóvel"}`, when: c.created_at,
      });
    }
    for (const p of (properties as any[]).slice(0, 10)) {
      items.push({
        id: `i-${p.id}`, icon: Building2, tone: "text-muted-foreground",
        text: `Imóvel cadastrado • ${p.nickname || p.address}`, when: p.created_at,
      });
    }
    return items
      .filter((i) => i.when)
      .sort((a, b) => (a.when < b.when ? 1 : -1))
      .slice(0, 8);
  }, [installments, maintenances, contracts, properties]);

  if (loading) {
    return (
      <PageShell className="space-y-8 sm:space-y-10">
        <DashboardSkeleton />
      </PageShell>
    );
  }

  const firstName = (profile?.full_name || "").trim().split(" ")[0];

  return (
    <PageShell className="space-y-8 sm:space-y-10 lg:space-y-12">
      {/* Resumo executivo */}
      <section>
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold mb-3">
          <span className="size-1.5 rounded-full bg-primary" />
          Painel executivo
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {greeting()}{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-3xl">
          Sua operação está ativa: você recebeu <strong className="text-foreground font-semibold">{formatBRL(s.received)}</strong> este mês com liquidação automática.
          tem <strong className="text-foreground font-semibold">{formatBRL(s.pending)}</strong> a receber
          {s.overdue > 0 ? (
            <> e <strong className="text-destructive font-semibold">{formatBRL(s.overdue)}</strong> em atraso</>
          ) : (
            <> e nenhum valor em atraso</>
          )}
          . Sua ocupação está em <strong className="text-foreground font-semibold">{s.occupancy}%</strong>.
        </p>
        <div className="mt-4 inline-flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              s.health.tone === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
            )}
          >
            {s.health.tone === "ok" ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
            Situação geral: {s.health.label}
          </Badge>
        </div>
      </section>

      {/* KPIs principais */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <KpiCard
          label="Receita recebida no mês"
          value={formatBRL(s.received)}
          icon={Wallet}
          tone="emerald"
          footer={
            s.delta === null ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Minus className="size-3.5" /> Sem base no mês anterior
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-medium",
                  s.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                )}
              >
                {s.delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {s.delta >= 0 ? "+" : ""}{s.delta}% vs. mês anterior
              </span>
            )
          }
        />
        <KpiCard
          label="Receita pendente"
          value={formatBRL(s.pending)}
          icon={Clock}
          tone="amber"
          footer={`${s.pendingCount} ${s.pendingCount === 1 ? "parcela a vencer" : "parcelas a vencer"}`}
        />
        <KpiCard
          label="Inadimplência"
          value={formatBRL(s.overdue)}
          icon={AlertTriangle}
          tone={s.overdue > 0 ? "red" : "emerald"}
          footer={`${s.overdueCount} ${s.overdueCount === 1 ? "parcela vencida" : "parcelas vencidas"}`}
        />
        <KpiCard
          label="Imóveis alugados"
          value={`${s.rented}`}
          suffix={`/ ${s.total}`}
          icon={Building2}
          tone="sky"
          footer={`Taxa de ocupação ${s.occupancy}%`}
        />
      </section>

      {/* Gráficos */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
        <Panel title="Receita dos últimos 12 meses" subtitle="Recebido x pendente" className="lg:col-span-3">
          <div className="h-[280px] -ml-2">
            <RevenueTrendChart data={s.series} />
          </div>
        </Panel>
        <Panel title="Evolução da inadimplência" subtitle="Valores vencidos por mês" className="lg:col-span-2">
          <div className="h-[280px] -ml-2">
            <DelinquencyAreaChart data={s.series.map((m) => ({ label: m.label, valor: m.atraso }))} />
          </div>
        </Panel>
      </section>

      {/* Atenção */}
      <section>
        <SectionTitle icon={AlertTriangle} title="Atenção" subtitle="Pendências que precisam de decisão" />
        <Card className="p-2 sm:p-3 rounded-2xl border-border/70 shadow-none">
          <ul className="divide-y divide-border/50">
            <AttentionRow
              show={s.overdueCount > 0}
              dot="bg-red-500"
              text={`${s.overdueCount} ${s.overdueCount === 1 ? "aluguel vencido" : "aluguéis vencidos"} • ${formatBRL(s.overdue)}`}
              action="Ver financeiro"
              to="/landlord/financeiro"
            />
            <AttentionRow
              show={s.expiring.length > 0}
              dot="bg-amber-500"
              text={`${s.expiring.length} ${s.expiring.length === 1 ? "contrato vencendo" : "contratos vencendo"} nos próximos 30 dias`}
              action="Ver imóveis"
              to="/landlord/financeiro"
            />
            <AttentionRow
              show={s.openMaint.length > 0}
              dot="bg-orange-500"
              text={`${s.openMaint.length} ${s.openMaint.length === 1 ? "manutenção aberta" : "manutenções abertas"}`}
              action="Resolver agora"
              to="/landlord/manutencoes"
            />
            <AttentionRow
              show={saldoDisponivel > 0}
              dot="bg-sky-500"
              text={`${formatBRL(saldoDisponivel)} disponível para saque`}
              action="Ver saldo"
              to="/landlord/saldo"
            />
            {s.overdueCount === 0 && s.expiring.length === 0 && s.openMaint.length === 0 && saldoDisponivel <= 0 && (
              <li className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-500" />
                Nenhuma pendência no momento. Tudo em dia.
              </li>
            )}
          </ul>
        </Card>
      </section>

      {/* Carteira + Financeiro */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <Panel title="Carteira" subtitle="Visão consolidada dos seus imóveis">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold tabular-nums tracking-tight">{s.occupancy}%</span>
            <span className="text-sm text-muted-foreground">de ocupação</span>
          </div>
          <Progress value={s.occupancy} className="h-2 mt-4" />
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
            <Metric label="Total de imóveis" value={s.total} />
            <Metric label="Alugados" value={s.rented} tone="emerald" />
            <Metric label="Disponíveis" value={s.available} />
            <Metric label="Contratos ativos" value={s.activeContracts} />
          </dl>
          {s.total === 0 && (
            <p className="mt-6 text-sm text-muted-foreground inline-flex items-center gap-2">
              <Home className="size-4" /> Nenhum imóvel vinculado ainda.
            </p>
          )}
        </Panel>

        <Panel
          title="Financeiro"
          subtitle="Resumo consolidado do período"
          action={
            <Link to="/landlord/financeiro" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              Detalhar <ArrowRight className="size-3" />
            </Link>
          }
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <Metric label="Previsto no mês" value={formatBRL(s.forecastMonth)} />
            <Metric label="Recebido no mês" value={formatBRL(s.received)} tone="emerald" />
            <Metric label="Pendente no mês" value={formatBRL(s.pending)} tone="amber" />
            <Metric label="Em atraso" value={formatBRL(s.overdue)} tone={s.overdue > 0 ? "red" : undefined} />
          </dl>
          <div className="mt-7 pt-6 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <Metric label="Acumulado no ano" value={formatBRL(s.receivedYear)} />
            <Metric label="Recebido histórico" value={formatBRL(totalRecebido)} />
            <Metric label="Já sacado" value={formatBRL(totalSacado)} />
            <Metric label="Saldo disponível" value={formatBRL(saldoDisponivel)} tone="emerald" />
          </div>
        </Panel>
      </section>

      {/* Atividades recentes */}
      <section>
        <SectionTitle icon={Activity} title="Atividades recentes" subtitle="Últimos eventos da sua operação" />
        <Card className="p-6 sm:p-7 rounded-2xl border-border/70 shadow-none">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma atividade registrada ainda.</p>
          ) : (
            <ol className="space-y-5">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border/70 bg-muted/40">
                    <a.icon className={cn("size-4", a.tone)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{a.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(String(a.when).slice(0, 10))}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </section>
    </PageShell>
  );
}

/* ---------- building blocks ---------- */

const TONES = {
  emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ring-emerald-500/20",
  amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 ring-amber-500/20",
  red: "text-red-600 dark:text-red-400 bg-red-500/10 ring-red-500/20",
  sky: "text-sky-600 dark:text-sky-400 bg-sky-500/10 ring-sky-500/20",
} as const;

const VALUE_TONES: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-destructive",
};

const KpiCard = memo(function KpiCard({
  label, value, suffix, icon: Icon, tone, footer,
}: {
  label: string; value: string; suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONES; footer?: React.ReactNode;
}) {
  return (
    <Card className="p-6 sm:p-7 rounded-2xl border-border/70 shadow-none transition-all duration-200 hover:border-border hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold min-w-0 truncate">
          {label}
        </p>
        <span className={cn("size-9 shrink-0 rounded-xl grid place-items-center ring-1", TONES[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-5 flex items-baseline gap-2">
        <span className="text-[2rem] sm:text-[2.35rem] leading-none font-bold tabular-nums tracking-tight">{value}</span>
        {suffix && <span className="text-base text-muted-foreground tabular-nums">{suffix}</span>}
      </p>
      {footer && <div className="mt-4 text-xs text-muted-foreground">{footer}</div>}
    </Card>
  );
});

function Panel({
  title, subtitle, action, children, className,
}: {
  title: string; subtitle?: string; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={cn("p-6 sm:p-7 rounded-2xl border-border/70 shadow-none", className)}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function SectionTitle({
  icon: Icon, title, subtitle,
}: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <h2 className="font-semibold tracking-tight">{title}</h2>
      {subtitle && <span className="text-xs text-muted-foreground hidden sm:inline">• {subtitle}</span>}
    </div>
  );
}

function AttentionRow({
  show, dot, text, action, to,
}: { show: boolean; dot: string; text: string; action: string; to: string }) {
  if (!show) return null;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 rounded-xl transition-colors hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("size-2 shrink-0 rounded-full", dot)} />
        <p className="text-sm min-w-0 truncate">{text}</p>
      </div>
      <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs">
        <Link to={to}>
          {action} <ArrowUpRight className="size-3.5" />
        </Link>
      </Button>
    </li>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-lg font-semibold tabular-nums tracking-tight truncate", tone && VALUE_TONES[tone])}>
        {value}
      </dd>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-2xl" />
        <Skeleton className="h-6 w-48 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6 sm:p-7 rounded-2xl border-border/70 shadow-none space-y-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="size-9 rounded-xl" />
            </div>
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
        <Card className="lg:col-span-3 p-6 sm:p-7 rounded-2xl border-border/70 shadow-none space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </Card>
        <Card className="lg:col-span-2 p-6 sm:p-7 rounded-2xl border-border/70 shadow-none space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-6 sm:p-7 rounded-2xl border-border/70 shadow-none space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ))}
      </div>
    </>
  );
}
