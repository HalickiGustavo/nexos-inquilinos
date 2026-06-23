import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Building2, Wallet, TrendingUp, Wrench, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  useLandlordProperties, useLandlordInstallments, useLandlordMaintenances, useLandlordSaldo,
} from "@/lib/landlord-queries";
import { formatBRL, monthRange } from "@/lib/format";

export const Route = createFileRoute("/_landlord/landlord/")({
  head: () => ({ meta: [{ title: "Dashboard — Proprietário NEXO" }] }),
  component: LandlordDashboard,
});

function LandlordDashboard() {
  const { data: properties = [] } = useLandlordProperties();
  const { data: installments = [] } = useLandlordInstallments();
  const { data: maintenances = [] } = useLandlordMaintenances();
  const { saldoDisponivel, totalRecebido } = useLandlordSaldo();

  const stats = useMemo(() => {
    const { start, end } = monthRange();
    const monthly = installments.filter((i: any) => i.due_date >= start && i.due_date <= end);
    const toReceive = monthly.filter((i: any) => i.status !== "pago")
      .reduce((s: number, i: any) => s + Number(i.amount), 0);
    const paid = monthly.filter((i: any) => i.status === "pago")
      .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
    const total = properties.length;
    const rented = properties.filter((p: any) => p.status === "alugado").length;
    const occupancy = total === 0 ? 0 : Math.round((rented / total) * 100);
    const openMaint = maintenances.filter((m: any) => m.status !== "concluida").length;
    return { toReceive, paid, total, rented, occupancy, openMaint };
  }, [properties, installments, maintenances]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80 font-medium mb-2">
          <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
          Proprietário
        </div>
        <h1 className="text-3xl lg:text-[2.25rem] font-bold tracking-tight">Bem-vindo ao seu painel</h1>
        <p className="text-muted-foreground mt-1.5">
          Acompanhe os imóveis sob gestão da sua imobiliária, repasses e manutenções.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Meus imóveis</h2>
            <Link to="/landlord/financeiro" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              Ver financeiro <ArrowRight className="size-3" />
            </Link>
          </div>
          {properties.length === 0 ? (
            <EmptyState text="Nenhum imóvel vinculado ainda. Sua imobiliária ajustará isso em breve." />
          ) : (
            <ul className="divide-y divide-border">
              {properties.slice(0, 6).map((p: any) => (
                <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.nickname || p.address}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                  </div>
                  <Badge variant="outline" className={statusColor(p.status)}>{p.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-4">Ocupação da carteira</h2>
          <div className="space-y-2">
            <Progress value={stats.occupancy} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {stats.rented} alugado(s) de {stats.total} imóvel(eis).
            </p>
          </div>
          <div className="mt-6 space-y-2 text-sm">
            <Row icon={<CheckCircle2 className="size-4 text-emerald-400" />} label="Alugados" value={stats.rented} />
            <Row icon={<AlertCircle className="size-4 text-zinc-400" />} label="Disponíveis" value={stats.total - stats.rented} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, tone, hint }: {
  label: string; value: string; icon: React.ReactNode;
  tone: "emerald" | "violet" | "fuchsia" | "amber"; hint?: string;
}) {
  const map = {
    emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    violet: "text-violet-400 bg-violet-500/10 ring-violet-500/30",
    fuchsia: "text-fuchsia-400 bg-fuchsia-500/10 ring-fuchsia-500/30",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
  } as const;
  return (
    <Card className="p-5">
      <div className={`size-10 rounded-lg grid place-items-center ring-1 ${map[tone]} mb-3`}>{icon}</div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
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
