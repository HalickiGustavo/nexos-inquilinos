import { Wrench, FolderClock, ClipboardCheck, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";

export type OperationalItem = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  to?: string;
};

export function OperationalIndicators({
  openMaintenances,
  pendingDocuments,
  inspections,
  activeContracts,
}: {
  openMaintenances: number;
  pendingDocuments: number;
  inspections?: number;
  activeContracts: number;
}) {
  const items: OperationalItem[] = [
    {
      label: "Manutenções abertas",
      value: String(openMaintenances),
      hint: openMaintenances > 0 ? "Aguardando andamento" : "Tudo em dia",
      icon: Wrench,
      to: "/maintenances",
    },
    {
      label: "Documentos pendentes",
      value: String(pendingDocuments),
      hint: pendingDocuments > 0 ? "Requer envio ou revisão" : "Nenhuma pendência",
      icon: FolderClock,
      to: "/documentos",
    },
    {
      label: "Vistorias",
      value: inspections !== undefined ? String(inspections) : "—",
      hint: "Acompanhe as vistorias da carteira",
      icon: ClipboardCheck,
      to: "/vistorias",
    },
    {
      label: "Contratos ativos",
      value: String(activeContracts),
      hint: "Em vigência na carteira",
      icon: FileText,
      to: "/contracts",
    },
  ];

  return (
    <Card className="p-6 lg:p-7">
      <div className="mb-5 min-w-0">
        <h3 className="text-base font-semibold tracking-tight">Indicadores operacionais</h3>
        <p className="text-sm text-muted-foreground">
          Rotina do dia a dia — sem competir com os números estratégicos
        </p>
      </div>
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(({ label, value, hint, icon: Icon, to }) => {
          const body = (
            <div className="h-full rounded-xl border border-border/60 bg-muted/15 px-4 py-4 flex flex-col justify-between gap-3 min-w-0 transition-colors hover:bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground leading-tight">
                  {label}
                </span>
                <Icon className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-bold tabular-nums truncate">{value}</div>
                {hint && (
                  <div className="mt-1 text-[11px] text-muted-foreground truncate">{hint}</div>
                )}
              </div>
            </div>
          );
          return to ? (
            <Link key={label} to={to} className="block h-full">
              {body}
            </Link>
          ) : (
            <div key={label}>{body}</div>
          );
        })}
      </div>
    </Card>
  );
}
