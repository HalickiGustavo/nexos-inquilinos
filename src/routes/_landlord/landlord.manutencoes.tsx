import { createFileRoute } from "@tanstack/react-router";
import { Wrench, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/PageHeader";
import { useLandlordMaintenances } from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_landlord/landlord/manutencoes")({
  head: () => ({ meta: [{ title: "Manutenções — Proprietário NEXO" }] }),
  component: LandlordMaintenances,
});

function LandlordMaintenances() {
  const { data: maintenances = [], isPending } = useLandlordMaintenances();

  return (
    <PageShell>
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manutenções</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Acompanhe os chamados nos seus imóveis. Apenas leitura — a imobiliária executa as ações.
        </p>
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            </Card>
          ))}
        </div>
      ) : maintenances.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto size-14 rounded-full bg-muted/50 grid place-items-center text-muted-foreground mb-3">
            <Wrench className="size-6" />
          </div>
          <p className="font-medium">Nenhuma manutenção registrada</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Quando sua imobiliária abrir um chamado, ele aparece aqui.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(maintenances as any[]).map((m) => (
            <Card
              key={m.id}
              className="p-5 space-y-3 transition-all hover:border-primary/30 hover:shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate leading-snug">{m.title}</h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {m.property?.nickname || m.property?.address || "—"}
                  </p>
                  {m.contract && (
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Contrato · {m.contract.tenant?.full_name ?? "inquilino"}
                      </Badge>
                      {m.contract.active && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                        >
                          vigente
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <StatusBadge status={m.status} />
              </div>

              {m.description && (
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {m.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-border/60">
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
    </PageShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground uppercase text-[10px] tracking-wider font-medium">{label}</p>
      <p className="font-medium truncate mt-0.5">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cn: string; icon: React.ReactNode }> = {
    aberta: {
      label: "Aberta",
      cn: "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5",
      icon: <AlertCircle className="size-3" />,
    },
    em_andamento: {
      label: "Em andamento",
      cn: "border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/5",
      icon: <Clock className="size-3" />,
    },
    concluida: {
      label: "Concluída",
      cn: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5",
      icon: <CheckCircle2 className="size-3" />,
    },
  };
  const cfg = map[status] ?? { label: status, cn: "border-border text-muted-foreground", icon: null };
  return (
    <Badge variant="outline" className={cn("inline-flex items-center gap-1 shrink-0", cfg.cn)}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}
