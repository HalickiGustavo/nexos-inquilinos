import { createFileRoute } from "@tanstack/react-router";
import { Wrench, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLandlordMaintenances } from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_landlord/landlord/manutencoes")({
  head: () => ({ meta: [{ title: "Manutenções — Proprietário NEXO" }] }),
  component: LandlordMaintenances,
});

function LandlordMaintenances() {
  const { data: maintenances = [], isLoading } = useLandlordMaintenances();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Manutenções</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe os chamados nos seus imóveis. Apenas leitura — a imobiliária executa as ações.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Carregando…</p>
      ) : maintenances.length === 0 ? (
        <Card className="p-10 text-center">
          <Wrench className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Nenhuma manutenção registrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            Quando sua imobiliária abrir um chamado, ele aparece aqui.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(maintenances as any[]).map((m) => (
            <Card key={m.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{m.title}</h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {m.property?.nickname || m.property?.address || "—"}
                  </p>
                  {m.contract && (
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Contrato · {m.contract.tenant?.full_name ?? "inquilino"}
                      </Badge>
                      {m.contract.active && (
                        <Badge variant="outline" className="text-[10px] font-normal border-emerald-500/40 text-emerald-400">
                          vigente
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <StatusBadge status={m.status} />
              </div>


              {m.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">{m.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                <Field label="Aberto em" value={formatDate(m.created_at)} />
                <Field label="Prioridade" value={m.priority || "—"} />
                {m.budget_amount && (
                  <Field label="Orçamento" value={formatBRL(Number(m.budget_amount))} />
                )}
                {m.budget_status && (
                  <Field label="Status do orçamento" value={m.budget_status} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground uppercase text-[10px] tracking-wider">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cn: string; icon: React.ReactNode }> = {
    aberta: { label: "Aberta", cn: "border-rose-500/40 text-rose-300", icon: <AlertCircle className="size-3" /> },
    em_andamento: { label: "Em andamento", cn: "border-violet-500/40 text-violet-300", icon: <Clock className="size-3" /> },
    concluida: { label: "Concluída", cn: "border-emerald-500/40 text-emerald-300", icon: <CheckCircle2 className="size-3" /> },
  };
  const cfg = map[status] ?? { label: status, cn: "border-zinc-700 text-zinc-300", icon: null };
  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1 ${cfg.cn}`}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}
