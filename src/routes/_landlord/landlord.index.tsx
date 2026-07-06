import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Building2, Wallet, TrendingUp, TrendingDown, Wrench, ArrowRight, CheckCircle2,
  AlertCircle, Sparkles, Receipt, ArrowUpRight, Percent, Calendar, PiggyBank,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import {
  useLandlordProperties, useLandlordInstallments, useLandlordMaintenances,
  useLandlordSaldo, useLandlordContracts,
} from "@/lib/landlord-queries";
import { formatBRL, formatBRLCompact, formatDate, monthRange } from "@/lib/format";

export const Route = createFileRoute("/_landlord/landlord/")({
  head: () => ({ meta: [{ title: "Visão Geral — Proprietário NEXO" }] }),
  component: LandlordDashboard,
});

type Period = "6m" | "12m" | "ytd" | "yoy";

function LandlordDashboard() {
  const { data: properties = [] } = useLandlordProperties();
  const { data: contracts = [] } = useLandlordContracts();
  const { data: installments = [] } = useLandlordInstallments();
  const { data: maintenances = [] } = useLandlordMaintenances();
  const { saldoDisponivel, totalRecebido } = useLandlordSaldo();
  const [period, setPeriod] = useState<Period>("6m");

  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const stats = useMemo(() => {
    const { start, end } = monthRange();
    const monthly = (installments as any[]).filter((i) => i.due_date >= start && i.due_date <= end);
    const receitaPrevista = monthly.reduce((s, i) => s + Number(i.amount), 0);
    const receitaRecebida = monthly.filter((i) => i.status === "pago")
      .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
    const receitaPendente = monthly.filter((i) => i.status !== "pago" && i.due_date >= today)
      .reduce((s, i) => s + Number(i.amount), 0);
    const inadimplencia = (installments as any[])
      .filter((i) => i.status !== "pago" && i.due_date < today)
      .reduce((s, i) => s + Number(i.amount), 0);

    const totalPago = (installments as any[]).filter((i) => i.status === "pago");
    const taxaAdmPaga = totalPago.reduce((s, i) => {
      const amt = Number(i.paid_amount || i.amount);
      const pct = Number(i.management_fee_percent || 0);
      return s + (amt * pct) / 100;
    }, 0);
    const retidoManutencao = (maintenances as any[])
      .filter((m: any) => m.status !== "concluida")
      .reduce((s: number, m: any) => s + Number(m.budget_amount || 0), 0);
    const receitaLiquida = totalRecebido - taxaAdmPaga;
    const receitaAno = totalPago
      .filter((i) => (i.paid_at || i.payment_date || "") >= yearStart)
      .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
    const recebimentoMedio = totalPago.length > 0 ? totalRecebido / new Set(totalPago.map((i) => (i.paid_at || i.payment_date || "").slice(0, 7))).size : 0;

    const total = properties.length;
    const rented = properties.filter((p: any) => p.status === "alugado").length;
    const disponiveis = properties.filter((p: any) => p.status === "disponivel").length;
    const emManut = properties.filter((p: any) => p.status === "manutencao").length;
    const occupancy = total === 0 ? 0 : Math.round((rented / total) * 100);
    const openMaint = (maintenances as any[]).filter((m) => m.status !== "concluida").length;
    const contratosAtivos = (contracts as any[]).filter((c) => c.active).length;

    return {
      receitaPrevista, receitaRecebida, receitaPendente, inadimplencia,
      taxaAdmPaga, retidoManutencao, receitaLiquida, receitaAno, recebimentoMedio,
      total, rented, disponiveis, emManut, occupancy, openMaint, contratosAtivos,
    };
  }, [properties, contracts, installments, maintenances, today, yearStart, totalRecebido]);

  // Gráfico: receita prevista vs recebida por mês
  const chartData = useMemo(() => {
    const now = new Date();
    let monthsBack = 6;
    if (period === "12m") monthsBack = 12;
    if (period === "ytd") monthsBack = now.getMonth() + 1;
    if (period === "yoy") monthsBack = 24;

    const buckets: Record<string, { key: string; label: string; prevista: number; recebida: number }> = {};
    for (let k = monthsBack - 1; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: period === "yoy" ? "2-digit" : undefined });
      buckets[key] = { key, label, prevista: 0, recebida: 0 };
    }
    for (const i of installments as any[]) {
      const key = String(i.due_date).slice(0, 7);
      if (!buckets[key]) continue;
      buckets[key].prevista += Number(i.amount);
      if (i.status === "pago") buckets[key].recebida += Number(i.paid_amount || i.amount);
    }
    return Object.values(buckets);
  }, [installments, period]);

  const insights = useMemo(() => buildInsights({ stats, properties, contracts, maintenances }), [stats, properties, contracts, maintenances]);

  const pendingApprovals = useMemo(
    () => (maintenances as any[])
      .filter((m) => m.status !== "concluida" && (m.budget_status === "aguardando_aprovacao" || m.budget_status === "pendente"))
      .slice(0, 4),
    [maintenances],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80 font-medium mb-2">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
            Proprietário
          </div>
          <h1 className="truncate text-2xl sm:text-3xl lg:text-[2.25rem] font-bold tracking-tight">
            Visão executiva da carteira
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {stats.total} imóvel(eis) · {stats.contratosAtivos} contrato(s) ativos · ocupação {stats.occupancy}%.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to="/landlord/saldo"><PiggyBank className="size-4 mr-2" />Saldo & Saque</Link>
        </Button>
      </header>

      {/* MINHA CARTEIRA */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-primary/[0.08] via-transparent to-transparent border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <Building2 className="size-4 text-primary" /> Minha Carteira
          </h2>
          <Link to="/landlord/imoveis" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
            Ver imóveis <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MiniStat label="Imóveis" value={stats.total} />
          <MiniStat label="Alugados" value={stats.rented} tone="emerald" />
          <MiniStat label="Disponíveis" value={stats.disponiveis} tone="zinc" />
          <MiniStat label="Em manutenção" value={stats.emManut} tone="amber" />
          <MiniStat label="Contratos ativos" value={stats.contratosAtivos} tone="violet" />
          <MiniStat label="Receita prevista" value={formatBRLCompact(stats.receitaPrevista)} tone="violet" money />
          <MiniStat label="Recebida" value={formatBRLCompact(stats.receitaRecebida)} tone="emerald" money />
          <MiniStat label="Pendente" value={formatBRLCompact(stats.receitaPendente)} tone="amber" money />
          <MiniStat label="Inadimplência" value={formatBRLCompact(stats.inadimplencia)} tone={stats.inadimplencia > 0 ? "rose" : "emerald"} money />
          <MiniStat label="Manut. abertas" value={stats.openMaint} tone={stats.openMaint > 0 ? "amber" : "emerald"} />
        </div>
      </Card>

      {/* Indicadores financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Saldo disponível"
          value={formatBRL(saldoDisponivel)}
          icon={<Wallet className="size-5" />}
          tone="emerald"
          hint={`Total recebido: ${formatBRL(totalRecebido)}`}
        />
        <StatCard
          label="Receita líquida"
          value={formatBRL(stats.receitaLiquida)}
          icon={<TrendingUp className="size-5" />}
          tone="violet"
          hint={`Taxa adm.: ${formatBRL(stats.taxaAdmPaga)}`}
        />
        <StatCard
          label="Recebimento médio/mês"
          value={formatBRL(stats.recebimentoMedio)}
          icon={<Percent className="size-5" />}
          tone="fuchsia"
          hint={`Ano acumulado: ${formatBRL(stats.receitaAno)}`}
        />
        <StatCard
          label="Retido em manutenção"
          value={formatBRL(stats.retidoManutencao)}
          icon={<Wrench className="size-5" />}
          tone={stats.retidoManutencao > 0 ? "amber" : "emerald"}
          hint={`${stats.openMaint} chamado(s) aberto(s)`}
        />
      </div>

      {/* Insights + Aprovações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold inline-flex items-center gap-2 mb-3">
            <Sparkles className="size-4 text-primary" /> Insights da Carteira
          </h2>
          <ul className="space-y-2">
            {insights.map((it, idx) => (
              <li key={idx} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
                <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ring-1 ${insightToneClass(it.tone)}`}>
                  {it.icon}
                </span>
                <p className="text-sm leading-relaxed">{it.text}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold inline-flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-400" /> Aprovações
            </h2>
            <Link to="/landlord/manutencoes" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma aprovação pendente.</p>
          ) : (
            <ul className="space-y-2">
              {pendingApprovals.map((m: any) => (
                <li key={m.id} className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.property?.nickname || m.property?.address}
                  </p>
                  {m.budget_amount && (
                    <p className="text-sm mt-1 tabular-nums font-semibold text-amber-300">
                      {formatBRL(Number(m.budget_amount))}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button asChild size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-400 text-white">
                      <Link to="/landlord/manutencoes">Ver e aprovar</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Gráfico prevista × recebida */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> Receita prevista × recebida
          </h2>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="ytd">Ano atual</SelectItem>
              <SelectItem value="yoy">Comparativo 24 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatBRLCompact(v)} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="prevista" name="Prevista" fill="hsl(var(--muted-foreground) / 0.4)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="recebida" name="Recebida" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Ocupação + últimos imóveis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold inline-flex items-center gap-2">
              <Building2 className="size-4 text-primary" /> Imóveis
            </h2>
            <Link to="/landlord/imoveis" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight className="size-3" />
            </Link>
          </div>
          {properties.length === 0 ? (
            <EmptyState text="Nenhum imóvel vinculado ainda. Sua imobiliária ajustará isso em breve." />
          ) : (
            <ul className="divide-y divide-border">
              {(properties as any[]).slice(0, 5).map((p) => (
                <li key={p.id} className="py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <Link to="/landlord/imoveis/$id" params={{ id: p.id }} className="min-w-0 hover:opacity-80">
                    <p className="font-medium truncate">{p.nickname || p.address}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                  </Link>
                  <Badge variant="outline" className={statusColor(p.status)}>{p.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-4 inline-flex items-center gap-2">
            <Percent className="size-4 text-primary" /> Ocupação
          </h2>
          <div className="space-y-2">
            <Progress value={stats.occupancy} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {stats.rented} alugado(s) de {stats.total} imóvel(eis).
            </p>
          </div>
          <div className="mt-6 space-y-2 text-sm">
            <Row icon={<CheckCircle2 className="size-4 text-emerald-400" />} label="Alugados" value={stats.rented} />
            <Row icon={<AlertCircle className="size-4 text-zinc-400" />} label="Disponíveis" value={stats.disponiveis} />
            <Row icon={<Wrench className="size-4 text-amber-400" />} label="Em manutenção" value={stats.emManut} />
          </div>
          <Button asChild variant="outline" size="sm" className="w-full mt-5">
            <Link to="/landlord/financeiro"><Receipt className="size-3.5 mr-2" />Abrir Conta Corrente</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------- helpers -------------------------- */

function MiniStat({ label, value, tone = "primary", money = false }: {
  label: string; value: number | string; tone?: "primary" | "emerald" | "amber" | "rose" | "violet" | "zinc"; money?: boolean;
}) {
  const map = {
    primary: "text-primary",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    violet: "text-violet-400",
    zinc: "text-zinc-300",
  } as const;
  return (
    <div className="rounded-lg bg-card/60 border border-border/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={`mt-0.5 font-bold tabular-nums truncate ${money ? "text-base" : "text-lg"} ${map[tone]}`}>{value}</p>
    </div>
  );
}

function StatCard({ label, value, icon, tone, hint }: {
  label: string; value: string; icon: React.ReactNode;
  tone: "emerald" | "violet" | "fuchsia" | "amber" | "rose"; hint?: string;
}) {
  const map = {
    emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    violet: "text-violet-400 bg-violet-500/10 ring-violet-500/30",
    fuchsia: "text-fuchsia-400 bg-fuchsia-500/10 ring-fuchsia-500/30",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
    rose: "text-rose-400 bg-rose-500/10 ring-rose-500/30",
  } as const;
  return (
    <Card className="p-5">
      <div className={`size-9 rounded-lg grid place-items-center ring-1 ${map[tone]} mb-3`}>{icon}</div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1 truncate">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</p>}
    </Card>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}

function statusColor(status: string) {
  switch (status) {
    case "alugado": return "border-emerald-500/40 text-emerald-300";
    case "disponivel": return "border-zinc-700 text-zinc-300";
    case "manutencao": return "border-amber-500/40 text-amber-300";
    default: return "";
  }
}

type InsightTone = "emerald" | "amber" | "rose" | "violet";
type Insight = { text: string; tone: InsightTone; icon: React.ReactNode };

function insightToneClass(t: InsightTone) {
  return {
    emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
    rose: "text-rose-400 bg-rose-500/10 ring-rose-500/30",
    violet: "text-violet-400 bg-violet-500/10 ring-violet-500/30",
  }[t];
}

function buildInsights({ stats, properties, contracts, maintenances }: any): Insight[] {
  const out: Insight[] = [];
  const today = new Date();

  if (stats.receitaPrevista > 0 && stats.receitaRecebida >= stats.receitaPrevista) {
    out.push({ text: "Todos os aluguéis previstos para este mês foram recebidos.", tone: "emerald", icon: <CheckCircle2 className="size-4" /> });
  } else if (stats.receitaPendente > 0) {
    out.push({ text: `${formatBRL(stats.receitaPendente)} ainda a receber este mês.`, tone: "violet", icon: <Calendar className="size-4" /> });
  }

  if (stats.inadimplencia > 0) {
    out.push({ text: `${formatBRL(stats.inadimplencia)} em inadimplência acumulada. A imobiliária já está negociando.`, tone: "rose", icon: <TrendingDown className="size-4" /> });
  }

  // imóvel disponível há muito tempo
  const stale = (properties as any[])
    .filter((p) => p.status === "disponivel")
    .map((p) => ({ p, days: Math.floor((today.getTime() - new Date(p.updated_at || p.created_at).getTime()) / 86400000) }))
    .filter((x) => x.days >= 30)
    .sort((a, b) => b.days - a.days)[0];
  if (stale) {
    out.push({ text: `Imóvel "${stale.p.nickname || stale.p.address}" está disponível há ${stale.days} dias.`, tone: "amber", icon: <Building2 className="size-4" /> });
  }

  // manutenção aguardando aprovação
  const waiting = (maintenances as any[]).filter((m) => m.budget_status === "aguardando_aprovacao" || m.budget_status === "pendente").length;
  if (waiting > 0) {
    out.push({ text: `${waiting} manutenção(ões) aguardando sua aprovação de orçamento.`, tone: "amber", icon: <Wrench className="size-4" /> });
  }

  // contratos vencendo
  const soon = (contracts as any[]).filter((c) => {
    if (!c.active || !c.end_date) return false;
    const diff = (new Date(c.end_date).getTime() - today.getTime()) / 86400000;
    return diff > 0 && diff <= 30;
  });
  if (soon.length > 0) {
    out.push({ text: `${soon.length} contrato(s) vencem nos próximos 30 dias.`, tone: "violet", icon: <ArrowUpRight className="size-4" /> });
  }

  if (out.length === 0) {
    out.push({ text: "Nenhuma pendência encontrada — sua carteira está em dia.", tone: "emerald", icon: <CheckCircle2 className="size-4" /> });
  }

  return out.slice(0, 5);
}
