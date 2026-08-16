import {
  Building2,
  CheckCircle2,
  DoorOpen,
  FileText,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertCircle,
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Coins,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatBRL, formatBRLCompact } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type PortfolioSummaryData = {
  totalProperties: number;
  rentedProperties: number;
  availableProperties: number;
  activeContracts: number;
  forecastRevenue: number;
  receivedRevenue: number;
  pendingRevenue: number;
  overdueAmount: number;
  expiringContracts?: number;
  occupancyRate?: number;
  /** variation percentage vs. previous month (null = not enough history) */
  trends?: {
    forecast?: number | null;
    received?: number | null;
    pending?: number | null;
    overdue?: number | null;
  };
};

type Tone = "muted" | "primary" | "emerald" | "amber" | "destructive";

function toneClass(t: Tone) {
  switch (t) {
    case "primary":
      return "text-primary";
    case "emerald":
      return "text-emerald-600 dark:text-emerald-500";
    case "amber":
      return "text-amber-600 dark:text-amber-500";
    case "destructive":
      return "text-destructive";
    default:
      return "text-foreground";
  }
}

function Trend({
  value,
  goodWhenUp = true,
}: {
  value?: number | null;
  goodWhenUp?: boolean;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  const Icon = rounded === 0 ? Minus : rounded > 0 ? TrendingUp : TrendingDown;
  const improving = rounded === 0 ? null : rounded > 0 === goodWhenUp;
  const color =
    improving === null
      ? "text-muted-foreground"
      : improving
        ? "text-emerald-600 dark:text-emerald-500"
        : "text-destructive";
  const sign = rounded > 0 ? "+" : rounded < 0 ? "" : "";
  
  // Custom design for the trend pill from the photo
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
      improving ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-destructive/5 text-destructive"
    )}>
      {sign}{rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "muted",
  hint,
  trend,
  goodWhenUp = true,
  progress,
  tooltip,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  trend?: number | null;
  goodWhenUp?: boolean;
  progress?: number;
  tooltip?: string;
}) {

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-full rounded-2xl border border-border/40 bg-card p-5 flex flex-col justify-between gap-3 min-w-0 hover:shadow-md transition-all cursor-default group">
            <div className="flex items-center justify-between gap-2">
              <div className={cn(
                "p-2 rounded-xl transition-colors",
                tone === "primary" ? "bg-primary/10 text-primary" : 
                tone === "emerald" ? "bg-emerald-50 text-emerald-600" :
                tone === "amber" ? "bg-amber-50 text-amber-600" :
                tone === "destructive" ? "bg-destructive/10 text-destructive" :
                "bg-muted/30 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                <Icon className="size-5 shrink-0" />
              </div>
              <Trend value={trend} goodWhenUp={goodWhenUp} />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold leading-tight flex items-center gap-1">
                {label}
                {tooltip && <Info className="size-3 opacity-30" />}
              </div>
              <div className={cn(
                "text-xl sm:text-2xl font-bold tabular-nums truncate",
                toneClass(tone)
              )}>
                {value}
              </div>
            </div>
          </div>
        </TooltipTrigger>
        {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );
}

export function PortfolioSummary({ data }: { data: PortfolioSummaryData }) {
  const t = data.trends ?? {};
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Recebido no período" 
          value={formatBRLCompact(data.receivedRevenue)} 
          icon={Wallet} 
          trend={t.received}
          tone="primary"
          tooltip="Total recebido no período selecionado."
        />
        <StatCard
          label="A Receber"
          value={formatBRLCompact(data.pendingRevenue)}
          icon={Coins}
          tone="emerald"
          trend={t.pending}
          tooltip="Valores faturados aguardando pagamento."
        />
        <StatCard
          label="Inadimplência"
          value={data.forecastRevenue > 0 ? `${((data.overdueAmount / data.forecastRevenue) * 100).toFixed(1)}%` : "0.0%"}
          icon={AlertCircle}
          tone="destructive"
          trend={t.overdue}
          goodWhenUp={false}
          tooltip="Percentual do valor previsto que permanece em atraso."
        />
        <StatCard
          label="A Repassar"
          value={formatBRLCompact(data.receivedRevenue * 0.85)} // Placeholder logic
          icon={TrendingUp}
          tone="amber"
          tooltip="Valores destinados aos proprietários aguardando processamento."
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Contratos ativos"
          value={String(data.activeContracts)}
          icon={FileText}
          tone="primary"
          tooltip="Total de contratos de locação ativos no momento."
        />
        <StatCard
          label="Taxa de ocupação"
          value={`${data.occupancyRate ?? 0}%`}
          icon={Gauge}
          tone="primary"
          tooltip="Percentual de imóveis ocupados em relação ao total da carteira."
        />
        <StatCard
          label="Imóveis disponíveis"
          value={String(data.availableProperties)}
          icon={Building2}
          tone="muted"
          tooltip="Total de imóveis prontos para locação."
        />
        <StatCard
          label="Contratos vencendo"
          value={String(data.expiringContracts ?? 0)}
          icon={DoorOpen}
          tone="muted"
          tooltip="Contratos com data de término nos próximos 30 dias."
        />
      </div>
    </div>
  );
}
