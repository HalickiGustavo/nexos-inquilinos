import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import {
  useLandlordProperties,
  useLandlordInstallments,
  useLandlordMaintenances,
  useLandlordSaldo,
} from "@/lib/landlord-queries";
import { formatBRL, monthRange } from "@/lib/format";
import { KpiCard, LineBar, Panel, Pill, SectionHeader, URBANIST } from "@/components/landlord/ui";

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
    const monthly = (installments as any[]).filter((i) => i.due_date >= start && i.due_date <= end);
    const toReceive = monthly
      .filter((i: any) => i.status !== "pago")
      .reduce((s: number, i: any) => s + Number(i.amount), 0);
    const paid = monthly
      .filter((i: any) => i.status === "pago")
      .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
    const total = (properties as any[]).length;
    const rented = (properties as any[]).filter((p: any) => p.status === "alugado").length;
    const occupancy = total === 0 ? 0 : Math.round((rented / total) * 100);
    const openMaint = (maintenances as any[]).filter((m: any) => m.status !== "concluida").length;
    return { toReceive, paid, total, rented, occupancy, openMaint };
  }, [properties, installments, maintenances]);

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Saldo Disponível"
          value={formatBRL(saldoDisponivel)}
          footer={<>Total recebido: <span className="text-slate-300">{formatBRL(totalRecebido)}</span></>}
        />
        <KpiCard
          label="A Receber no Mês"
          value={formatBRL(stats.toReceive)}
          footer={
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-500">Recebido</span>
                <span className="text-emerald-400">{formatBRL(stats.paid)}</span>
              </div>
              <LineBar value={stats.toReceive + stats.paid === 0 ? 0 : (stats.paid / (stats.toReceive + stats.paid)) * 100} />
            </div>
          }
        />
        <KpiCard
          label="Imóveis"
          value={`${stats.rented} / ${stats.total}`}
          footer={<>Ocupação <span className="text-white font-bold">{stats.occupancy}%</span></>}
        />
        <KpiCard
          label="Manutenções"
          value={String(stats.openMaint).padStart(2, "0")}
          accent={
            stats.openMaint > 0 ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
              </span>
            ) : undefined
          }
          footer={
            stats.openMaint > 0 ? (
              <span className="font-bold uppercase tracking-wider text-rose-400">Chamados abertos</span>
            ) : (
              <span className="font-bold uppercase tracking-wider text-emerald-400">Nenhum aberto</span>
            )
          }
        />
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <SectionHeader
            title="Meus Imóveis"
            action={
              <Link
                to="/landlord/financeiro"
                className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#a5b4fc] transition-colors hover:text-[#c7d2fe]"
              >
                Ver financeiro <ArrowRight className="size-3" />
              </Link>
            }
          />
          <Panel>
            {(properties as any[]).length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                Nenhum imóvel vinculado ainda. Sua imobiliária ajustará isso em breve.
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-[#1e1e5a] bg-[#1e1e5a]/30">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                      Imóvel
                    </th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                      Endereço
                    </th>
                    <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e5a]/50">
                  {(properties as any[]).slice(0, 8).map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-[#1e1e5a]/20">
                      <td className="px-8 py-5">
                        <div className="text-sm font-bold text-white" style={URBANIST}>
                          {p.nickname || p.address}
                        </div>
                        <div className="text-xs text-slate-500">Cód: {p.code || p.id.slice(0, 8).toUpperCase()}</div>
                      </td>
                      <td className="max-w-[280px] truncate px-8 py-5 text-sm text-slate-400">
                        {p.address}
                      </td>
                      <td className="px-8 py-5 text-right">
                        {p.status === "alugado" ? (
                          <Pill tone="emerald">Alugado</Pill>
                        ) : p.status === "manutencao" ? (
                          <Pill tone="amber">Manutenção</Pill>
                        ) : (
                          <Pill tone="slate">Disponível</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <SectionHeader title="Ocupação" />
          <Panel padded className="space-y-6">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span
                  className="text-4xl font-extrabold text-white tracking-tight tabular-nums"
                  style={URBANIST}
                >
                  {stats.occupancy}%
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {stats.rented}/{stats.total} unidades
                </span>
              </div>
              <LineBar value={stats.occupancy} tone="indigo" />
            </div>
            <div className="space-y-3 text-sm">
              <Row
                icon={<CheckCircle2 className="size-4 text-emerald-400" />}
                label="Alugados"
                value={stats.rented}
              />
              <Row
                icon={<AlertCircle className="size-4 text-slate-500" />}
                label="Disponíveis"
                value={stats.total - stats.rented}
              />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-t border-[#1e1e5a]/50 pt-3 first:border-0 first:pt-0">
      <span className="inline-flex items-center gap-2 text-slate-400">
        {icon}
        {label}
      </span>
      <span
        className="font-bold text-white tabular-nums"
        style={URBANIST}
      >
        {value}
      </span>
    </div>
  );
}
