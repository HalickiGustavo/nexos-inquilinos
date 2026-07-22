import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLandlordInstallments } from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";
import { EmptyLine, KpiCard, LoadingLine, Panel, Pill, SectionHeader, URBANIST } from "@/components/landlord/ui";

export const Route = createFileRoute("/_landlord/landlord/financeiro")({
  head: () => ({ meta: [{ title: "Finanças — Proprietário NEXO" }] }),
  component: LandlordFinanceiro,
});

type Filtro = "todos" | "pago" | "pendente" | "atrasado";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pago", label: "Pagos" },
  { key: "pendente", label: "Pendentes" },
  { key: "atrasado", label: "Atrasados" },
];

function LandlordFinanceiro() {
  const { data: installments = [], isLoading } = useLandlordInstallments();
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return (installments as any[]).filter((i) => {
      if (filtro === "todos") return true;
      if (filtro === "pago") return i.status === "pago";
      if (filtro === "pendente") return i.status !== "pago" && i.due_date >= todayStr;
      if (filtro === "atrasado") return i.status !== "pago" && i.due_date < todayStr;
      return true;
    });
  }, [installments, filtro, todayStr]);

  const totals = useMemo(() => {
    const recebido = (installments as any[])
      .filter((i) => i.status === "pago")
      .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
    const aReceber = (installments as any[])
      .filter((i) => i.status !== "pago" && i.due_date >= todayStr)
      .reduce((s, i) => s + Number(i.amount), 0);
    const atrasado = (installments as any[])
      .filter((i) => i.status !== "pago" && i.due_date < todayStr)
      .reduce((s, i) => s + Number(i.amount), 0);
    return { recebido, aReceber, atrasado };
  }, [installments, todayStr]);

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <KpiCard label="Total Recebido" value={formatBRL(totals.recebido)} />
        <KpiCard label="A Receber" value={formatBRL(totals.aReceber)} />
        <KpiCard
          label="Em Atraso"
          value={formatBRL(totals.atrasado)}
          footer={
            totals.atrasado > 0 ? (
              <span className="font-bold uppercase tracking-wider text-rose-400">Requer atenção</span>
            ) : (
              <span className="font-bold uppercase tracking-wider text-emerald-400">Tudo em dia</span>
            )
          }
        />
      </div>

      <div className="space-y-6">
        <SectionHeader
          title="Últimas Parcelas"
          action={
            <div className="flex gap-1 rounded-xl border border-[#1e1e5a] bg-[#141432] p-1">
              {FILTROS.map((f) => {
                const active = f.key === filtro;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFiltro(f.key)}
                    className={
                      "rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all " +
                      (active
                        ? "bg-[#4f46e5] text-white shadow-lg shadow-[#4f46e5]/30"
                        : "text-slate-400 hover:text-white")
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          }
        />

        <Panel>
          {isLoading ? (
            <LoadingLine />
          ) : filtered.length === 0 ? (
            <EmptyLine text="Nenhuma parcela neste filtro." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead className="border-b border-[#1e1e5a] bg-[#1e1e5a]/30">
                  <tr>
                    {["Vencimento", "Imóvel", "Inquilino", "Status", "Pago em", "Valor"].map((h, i) => (
                      <th
                        key={h}
                        className={
                          "px-6 py-5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 " +
                          (i === 5 ? "text-right" : "")
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e5a]/50">
                  {filtered.map((i: any) => {
                    const overdue = i.status !== "pago" && i.due_date < todayStr;
                    return (
                      <tr key={i.id} className="transition-colors hover:bg-[#1e1e5a]/20">
                        <td className="px-6 py-5 text-sm text-slate-300">{formatDate(i.due_date)}</td>
                        <td className="max-w-[220px] truncate px-6 py-5 text-sm font-bold text-white" style={URBANIST}>
                          {i.contract?.property?.nickname || i.contract?.property?.address || "—"}
                        </td>
                        <td className="max-w-[180px] truncate px-6 py-5 text-sm text-slate-400">
                          {i.contract?.tenant?.full_name || "—"}
                        </td>
                        <td className="px-6 py-5">
                          {overdue ? (
                            <Pill tone="rose">Atrasado</Pill>
                          ) : i.status === "pago" ? (
                            <Pill tone="emerald">Pago</Pill>
                          ) : i.status === "agendado" ? (
                            <Pill tone="slate">Agendado</Pill>
                          ) : (
                            <Pill tone="violet">{i.status}</Pill>
                          )}
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-400">
                          {i.paid_at ? formatDate(i.paid_at) : "—"}
                        </td>
                        <td
                          className="px-6 py-5 text-right text-sm font-extrabold tracking-tight text-white tabular-nums"
                          style={URBANIST}
                        >
                          {formatBRL(Number(i.paid_amount || i.amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
