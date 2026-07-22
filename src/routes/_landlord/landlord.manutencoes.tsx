import { createFileRoute } from "@tanstack/react-router";
import { Wrench, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { useLandlordMaintenances } from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";
import { EmptyLine, LoadingLine, Panel, Pill, URBANIST } from "@/components/landlord/ui";

export const Route = createFileRoute("/_landlord/landlord/manutencoes")({
  head: () => ({ meta: [{ title: "Manutenções — Proprietário NEXO" }] }),
  component: LandlordMaintenances,
});

function LandlordMaintenances() {
  const { data: maintenances = [], isLoading } = useLandlordMaintenances();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <Panel>
          <LoadingLine />
        </Panel>
      </div>
    );
  }

  if ((maintenances as any[]).length === 0) {
    return (
      <div className="mx-auto max-w-7xl">
        <Panel padded className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-[#1e1e5a] bg-[#1e1e5a]/30 text-[#a5b4fc]">
            <Wrench className="size-6" />
          </div>
          <p className="mt-4 font-bold text-white" style={URBANIST}>
            Nenhuma manutenção registrada
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Quando sua imobiliária abrir um chamado, ele aparece aqui.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {(maintenances as any[]).map((m) => {
          const urgent = m.priority === "alta" || m.priority === "urgente";
          const status = m.status ?? "aberta";
          const border = urgent && status !== "concluida"
            ? "border-rose-500/40"
            : "border-[#1e1e5a]";
          return (
            <div
              key={m.id}
              className={`relative overflow-hidden rounded-2xl border ${border} bg-[#141432] p-5 shadow-2xl transition-all hover:-translate-y-0.5 hover:border-[#4f46e5]/40`}
            >
              {urgent && status !== "concluida" && (
                <div className="absolute right-3 top-3">
                  <span className="rounded bg-rose-500 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                    Urgente
                  </span>
                </div>
              )}
              <div className="pr-16">
                <h3 className="truncate text-base font-extrabold text-white" style={URBANIST}>
                  {m.title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {m.property?.nickname || m.property?.address || "—"}
                </p>
              </div>

              {m.contract && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Pill tone="indigo">
                    Contrato · {m.contract.tenant?.full_name ?? "inquilino"}
                  </Pill>
                  {m.contract.active && <Pill tone="emerald">Vigente</Pill>}
                </div>
              )}

              {m.description && (
                <p className="mt-3 line-clamp-3 text-sm text-slate-400">{m.description}</p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#1e1e5a] pt-4 text-xs">
                <Field label="Aberto em" value={formatDate(m.created_at)} />
                <Field label="Prioridade" value={m.priority || "—"} />
                {m.budget_amount && (
                  <Field label="Orçamento" value={formatBRL(Number(m.budget_amount))} />
                )}
                {m.budget_status && (
                  <Field label="Status do orçamento" value={m.budget_status} />
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#1e1e5a] pt-4">
                <StatusBadge status={status} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  #{String(m.id).slice(0, 6).toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white" style={URBANIST}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "concluida") {
    return (
      <Pill tone="emerald">
        <CheckCircle2 className="size-3" /> Concluída
      </Pill>
    );
  }
  if (status === "em_andamento") {
    return (
      <Pill tone="blue">
        <Clock className="size-3" /> Em andamento
      </Pill>
    );
  }
  return (
    <Pill tone="rose">
      <AlertCircle className="size-3" /> Aberta
    </Pill>
  );
}
