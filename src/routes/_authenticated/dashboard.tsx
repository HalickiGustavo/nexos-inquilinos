import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Building2, Wallet, TrendingUp, AlertCircle, CheckCircle2, Home, Bell, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProperties, useInstallments, useMaintenances } from "@/lib/queries";
import { formatBRL, monthRange } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Visão Geral — ImovelPro" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: properties = [] } = useProperties();
  const { data: installments = [] } = useInstallments();
  const { data: maintenances = [] } = useMaintenances();
  const pendingApprovals = (maintenances as any[]).filter((m) => m.budget_status === "pendente");

  const stats = useMemo(() => {
    const { start, end } = monthRange();
    const monthly = installments.filter((i) => i.due_date >= start && i.due_date <= end);
    const toReceive = monthly
      .filter((i) => i.status !== "pago")
      .reduce((s, i) => s + Number(i.amount) + Number(i.extra_fees), 0);
    const paid = monthly
      .filter((i) => i.status === "pago")
      .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
    const today = new Date().toISOString().slice(0, 10);
    const overdue = installments
      .filter((i) => i.status !== "pago" && i.due_date < today)
      .reduce((s, i) => s + Number(i.amount) + Number(i.extra_fees), 0);
    const total = properties.length;
    const rented = properties.filter((p) => p.status === "alugado").length;
    const available = properties.filter((p) => p.status === "disponivel").length;
    const occupancy = total === 0 ? 0 : Math.round((rented / total) * 100);
    const monthTotal = toReceive + paid;
    const collected = monthTotal === 0 ? 0 : Math.round((paid / monthTotal) * 100);

    return { toReceive, paid, overdue, total, rented, available, occupancy, collected, monthTotal };
  }, [properties, installments]);

  const chartData = useMemo(() => {
    const arr: { month: string; pago: number; pendente: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const items = installments.filter((x) => x.due_date.startsWith(ym));
      arr.push({
        month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        pago: items.filter((i) => i.status === "pago").reduce((s, i) => s + Number(i.paid_amount || i.amount), 0),
        pendente: items.filter((i) => i.status !== "pago").reduce((s, i) => s + Number(i.amount), 0),
      });
    }
    return arr;
  }, [installments]);

  const availableProps = properties.filter((p) => p.status === "disponivel");

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground mt-1">Resumo financeiro e operacional do mês.</p>
      </div>

      {pendingApprovals.length > 0 && (
        <Link
          to="/maintenances"
          className="block group relative rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 overflow-hidden transition hover:border-primary"
          style={{ boxShadow: "0 0 40px -10px color-mix(in oklab, var(--primary) 60%, transparent)" }}
        >
          <div className="absolute inset-0 -z-10 opacity-50 blur-2xl bg-primary/20" aria-hidden />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-full bg-primary/20 grid place-items-center text-primary ring-2 ring-primary/40">
                <Bell className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  Aprovações Pendentes
                  <Badge className="bg-primary text-primary-foreground">{pendingApprovals.length}</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Orçamentos de manutenção aguardando sua decisão — valor total {" "}
                  <span className="font-semibold text-foreground">
                    {formatBRL(pendingApprovals.reduce((s, m) => s + Number(m.budget_amount ?? 0), 0))}
                  </span>
                </p>
              </div>
            </div>
            <ArrowRight className="size-5 text-primary transition group-hover:translate-x-1" />
          </div>
        </Link>
      )}


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="A receber este mês"
          value={formatBRL(stats.toReceive)}
          icon={<Wallet className="size-5" />}
          accent="text-primary"
        />
        <MetricCard
          title="Já recebido"
          value={formatBRL(stats.paid)}
          icon={<CheckCircle2 className="size-5" />}
          accent="text-primary"
        />
        <MetricCard
          title="Inadimplência"
          value={formatBRL(stats.overdue)}
          icon={<AlertCircle className="size-5" />}
          accent="text-destructive"
        />
        <MetricCard
          title="Taxa de ocupação"
          value={`${stats.occupancy}%`}
          icon={<TrendingUp className="size-5" />}
          accent="text-primary"
          subtitle={`${stats.rented} de ${stats.total} imóveis`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Coleta mensal</h3>
              <p className="text-sm text-muted-foreground">Últimos 6 meses (pago x pendente)</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="month" stroke="var(--border)" fontSize={12} tick={{ fill: "var(--muted-foreground)" }} />
                <YAxis stroke="var(--border)" fontSize={12} tick={{ fill: "var(--muted-foreground)" }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Bar dataKey="pago" stackId="a" fill="var(--primary)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pendente" stackId="a" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Progresso do mês</h3>
          <p className="text-sm text-muted-foreground mb-6">Recebido vs. total previsto</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary">{stats.collected}%</span>
            <span className="text-sm text-muted-foreground">coletado</span>
          </div>
          <Progress value={stats.collected} className="mt-3" />
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total previsto</span>
              <span className="font-medium">{formatBRL(stats.monthTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Recebido</span>
              <span className="font-medium text-primary">{formatBRL(stats.paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">A receber</span>
              <span className="font-medium">{formatBRL(stats.toReceive)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Home className="size-4 text-muted-foreground" /> Imóveis disponíveis
            </h3>
            <p className="text-sm text-muted-foreground">{availableProps.length} unidade(s) sem contrato ativo</p>
          </div>
          <Badge variant="secondary">{stats.available} vagos</Badge>
        </div>
        {availableProps.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Todos os imóveis estão alugados 🎉</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableProps.map((p) => (
              <div key={p.id} className="border rounded-lg p-4 hover:border-primary/50 transition">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.nickname}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.address}</div>
                  </div>
                  <Building2 className="size-4 text-muted-foreground shrink-0" />
                </div>
                <div className="mt-3 text-sm font-semibold text-primary">{formatBRL(Number(p.rent_price))}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function MetricCard({
  title, value, icon, accent, subtitle,
}: { title: string; value: string; icon: React.ReactNode; accent?: string; subtitle?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${accent ?? ""}`}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-muted ${accent ?? "text-muted-foreground"}`}>{icon}</div>
      </div>
    </Card>
  );
}
