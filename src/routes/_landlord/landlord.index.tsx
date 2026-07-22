import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useMemo } from "react";
import { Building2, Wallet, TrendingUp, Wrench, ArrowRight, CheckCircle2, AlertCircle, Home } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/PageHeader";
import {
  useLandlordProperties, useLandlordInstallments, useLandlordMaintenances, useLandlordSaldo,
} from "@/lib/landlord-queries";
import { formatBRL, monthRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_landlord/landlord/")({
  head: () => ({ meta: [{ title: "Dashboard — Proprietário NEXO" }] }),
  component: LandlordDashboard,
});

function LandlordDashboard() {
  const { data: properties = [], isPending: propsPending } = useLandlordProperties();
  const { data: installments = [], isPending: instPending } = useLandlordInstallments();
  const { data: maintenances = [], isPending: maintPending } = useLandlordMaintenances();
  const { saldoDisponivel, totalRecebido, loading: saldoLoading } = useLandlordSaldo();

  const loading = propsPending || instPending || maintPending || saldoLoading;

  const stats = useMemo(() => {
    const { start, end } = monthRange();
    const monthly = (installments as any[]).filter((i) => i.due_date >= start && i.due_date <= end);
    const toReceive = monthly.filter((i) => i.status !== "pago")
      .reduce((s, i) => s + Number(i.amount), 0);
    const paid = monthly.filter((i) => i.status === "pago")
      .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
    const total = properties.length;
    const rented = (properties as any[]).filter((p) => p.status === "alugado").length;
    const occupancy = total === 0 ? 0 : Math.round((rented / total) * 100);
    const openMaint = (maintenances as any[]).filter((m) => m.status !== "concluida").length;
    return { toReceive, paid, total, rented, occupancy, openMaint };
  }, [properties, installments, maintenances]);

  return (
    <PageShell>
      <header>
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold mb-2">
          <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
          Proprietário
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-bold tracking-tight">
          Bem-vindo ao seu painel
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
          Acompanhe os imóveis sob gestão da sua imobiliária, repasses e manutenções.
        </p>
      </header>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Saldo disponível"
              value={formatBRL(saldoDisponivel)}
              icon={<Wallet className="size-5" />}
              tone="emerald"
              hint={`Total recebido: ${formatBRL(totalRecebido)}`}
            />
            <StatCard
              label="A receber no mês"
              value={formatBRL(stats.toReceive)}
              icon={<TrendingUp className="size-5" />}
              tone="violet"
              hint={`Recebido: ${formatBRL(stats.paid)}`}
            />
            <StatCard
              label="Imóveis"
              value={`${stats.rented} / ${stats.total}`}
              icon={<Building2 className="size-5" />}
              tone="fuchsia"
              hint={`Ocupação ${stats.occupancy}%`}
            />
            <StatCard
              label="Manutenções abertas"
              value={String(stats.openMaint)}
              icon={<Wrench className="size-5" />}
              tone={stats.openMaint > 0 ? "amber" : "emerald"}
              hint={stats.openMaint > 0 ? "Chamados em andamento" : "Sem chamados abertos"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Meus imóveis</h2>
                <Link
                  to="/landlord/financeiro"
                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline transition-colors"
                >
                  Ver financeiro <ArrowRight className="size-3" />
                </Link>
              </div>
              {properties.length === 0 ? (
                <EmptyState
                  icon={<Home className="size-8" />}
                  title="Nenhum imóvel vinculado"
                  text="Sua imobiliária ajustará isso em breve."
                />
              ) : (
                <ul className="divide-y divide-border/60">
                  {(properties as any[]).slice(0, 6).map((p) => (
                    <li
                      key={p.id}
                      className="py-3 flex items-center justify-between gap-3 rounded-md px-2 -mx-2 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-md border border-border bg-muted/40 text-foreground/80 shrink-0">
                          <Building2 className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-sm">{p.nickname || p.address}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0 capitalize", statusColor(p.status))}>
                        {p.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold mb-4">Ocupação da carteira</h2>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold tabular-nums">{stats.occupancy}%</span>
                  <span className="text-xs text-muted-foreground">
                    {stats.rented} / {stats.total}
                  </span>
                </div>
                <Progress value={stats.occupancy} className="h-2" />
              </div>
              <div className="mt-6 space-y-2 text-sm">
                <Row
                  icon={<CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />}
                  label="Alugados"
                  value={stats.rented}
                />
                <Row
                  icon={<AlertCircle className="size-4 text-muted-foreground" />}
                  label="Disponíveis"
                  value={stats.total - stats.rented}
                />
              </div>
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}

const StatCard = memo(function StatCard({ label, value, icon, tone, hint }: {
  label: string; value: string; icon: React.ReactNode;
  tone: "emerald" | "violet" | "fuchsia" | "amber"; hint?: string;
}) {
  const map = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10 ring-violet-500/30",
    fuchsia: "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/10 ring-fuchsia-500/30",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 ring-amber-500/30",
  } as const;
  return (
    <Card className="p-5 transition-all hover:border-primary/30 hover:shadow-card">
      <div className={cn("size-10 rounded-lg grid place-items-center ring-1 mb-3", map[tone])}>{icon}</div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1 leading-tight">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
    </Card>
  );
});

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto size-12 rounded-full bg-muted/50 grid place-items-center text-muted-foreground mb-3">
        {icon}
      </div>
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{text}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-3">
          <Skeleton className="h-5 w-32 mb-2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <Skeleton className="size-9 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </Card>
        <Card className="p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-2 w-full" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </Card>
      </div>
    </>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "alugado": return "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5";
    case "disponivel": return "border-border text-muted-foreground";
    case "manutencao": return "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5";
    default: return "";
  }
}
