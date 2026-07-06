import {
  Building2,
  CheckCircle2,
  DoorOpen,
  FileText,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertCircle,
  Wrench,
  FolderClock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";

export type PortfolioSummaryData = {
  totalProperties: number;
  rentedProperties: number;
  availableProperties: number;
  activeContracts: number;
  forecastRevenue: number;
  receivedRevenue: number;
  pendingRevenue: number;
  overdueAmount: number;
  openMaintenances: number;
  pendingDocuments: number;
};

const items = (d: PortfolioSummaryData) => [
  { label: "Imóveis", value: String(d.totalProperties), icon: Building2, tone: "muted" as const },
  { label: "Alugados", value: String(d.rentedProperties), icon: CheckCircle2, tone: "primary" as const },
  { label: "Disponíveis", value: String(d.availableProperties), icon: DoorOpen, tone: "muted" as const },
  { label: "Contratos ativos", value: String(d.activeContracts), icon: FileText, tone: "muted" as const },
  { label: "Receita prevista", value: formatBRL(d.forecastRevenue), icon: Wallet, tone: "muted" as const },
  { label: "Receita recebida", value: formatBRL(d.receivedRevenue), icon: ArrowDownCircle, tone: "emerald" as const },
  { label: "Receita pendente", value: formatBRL(d.pendingRevenue), icon: ArrowUpCircle, tone: "amber" as const },
  { label: "Inadimplência", value: formatBRL(d.overdueAmount), icon: AlertCircle, tone: "destructive" as const },
  { label: "Manutenções abertas", value: String(d.openMaintenances), icon: Wrench, tone: "muted" as const },
  { label: "Documentos pendentes", value: String(d.pendingDocuments), icon: FolderClock, tone: "muted" as const },
];

function toneClass(t: "muted" | "primary" | "emerald" | "amber" | "destructive") {
  switch (t) {
    case "primary":
      return "text-primary";
    case "emerald":
      return "text-emerald-500";
    case "amber":
      return "text-amber-500";
    case "destructive":
      return "text-destructive";
    default:
      return "text-foreground";
  }
}

export function PortfolioSummary({ data }: { data: PortfolioSummaryData }) {
  return (
    <Card className="p-5 lg:p-6 relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 60%, transparent), transparent)",
        }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Minha Carteira</h2>
          <p className="text-sm text-muted-foreground">
            Panorama consolidado — atualizado agora
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items(data).map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 flex flex-col gap-1 min-w-0"
          >
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wide truncate">{label}</span>
              <Icon className={`size-3.5 shrink-0 ${toneClass(tone)}`} />
            </div>
            <div className={`text-lg font-bold tabular-nums truncate ${toneClass(tone)}`}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
