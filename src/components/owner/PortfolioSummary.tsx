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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
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
  /** variação percentual vs. mês anterior (null = sem histórico suficiente) */
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
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${color}`}>
      <Icon className="size-3 shrink-0" />
      {sign}
      {rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
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
          <div className="h-full rounded-xl border border-border/60 bg-muted/15 px-4 py-4 flex flex-col justify-between gap-3 min-w-0 hover:border-primary/30 transition-colors cursor-default">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground leading-tight flex items-center gap-1">
                {label}
                {tooltip && <Info className="size-3 opacity-40" />}
              </span>
              <Icon className={`size-4 shrink-0 ${toneClass(tone)}`} />
            </div>

      <div className="min-w-0">
        <div className={`text-lg sm:text-xl font-bold tabular-nums truncate ${toneClass(tone)}`}>
          {value}
        </div>
        <div className="mt-1 flex items-center gap-2 min-h-[16px]">
          <Trend value={trend} goodWhenUp={goodWhenUp} />
          {hint && (
            <span className="text-[11px] text-muted-foreground truncate">{hint}</span>
          )}
        </div>
        {progress !== undefined && (
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full bg-emerald-500/80",
                progress > 100 && "bg-emerald-600"
              )}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
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
  const occupancy =
    data.totalProperties > 0
      ? Math.round((data.rentedProperties / data.totalProperties) * 100)
      : 0;
  const receivedPct =
    data.forecastRevenue > 0
      ? Math.round((data.receivedRevenue / data.forecastRevenue) * 100)
      : 0;
  const overduePct =
    data.forecastRevenue > 0 ? (data.overdueAmount / data.forecastRevenue) * 100 : 0;

  return (
    <Card className="p-6 lg:p-7 relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 60%, transparent), transparent)",
        }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Minha Carteira</h2>
          <p className="text-sm text-muted-foreground">
            Panorama consolidado — atualizado agora
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard label="Imóveis" value={String(data.totalProperties)} icon={Building2} />
        <StatCard
          label="Alugados"
          value={String(data.rentedProperties)}
          icon={CheckCircle2}
          tone="primary"
        />
        <StatCard
          label="Disponíveis"
          value={String(data.availableProperties)}
          icon={DoorOpen}
        />
        <StatCard
          label="Contratos ativos"
          value={String(data.activeContracts)}
          icon={FileText}
        />
        <StatCard
          label="Receita prevista"
          value={formatBRL(data.forecastRevenue)}
          icon={Wallet}
          trend={t.forecast}
          tooltip="Soma dos valores previstos para recebimento no período selecionado."
        />

      </div>

      <div className="mt-4 grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Receita recebida"
          value={formatBRL(data.receivedRevenue)}
          icon={ArrowDownCircle}
          tone="emerald"
          trend={t.received}
          hint={`${receivedPct}% do previsto`}
          progress={receivedPct}
          tooltip="Total efetivamente recebido no período selecionado."

        />
        <StatCard
          label="Receita pendente"
          value={formatBRL(data.pendingRevenue)}
          icon={ArrowUpCircle}
          tone="amber"
          trend={t.pending}
          goodWhenUp={false}
          tooltip="Valores previstos que ainda não foram recebidos."
        />

        <StatCard
          label="Inadimplência"
          value={formatBRL(data.overdueAmount)}
          icon={AlertCircle}
          tone="destructive"
          trend={t.overdue}
          goodWhenUp={false}
          hint={`${overduePct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da carteira`}
          tooltip="Valores vencidos e não pagos dentro do período considerado."
        />
        <StatCard
          label="Taxa de ocupação"
          value={`${occupancy}%`}
          icon={Gauge}
          tone="primary"
          hint={`${data.rentedProperties} de ${data.totalProperties} imóveis alugados`}
          progress={occupancy}
          tooltip="Percentual de imóveis alugados em relação aos imóveis disponíveis para locação."
        />

      </div>
    </Card>
  );
}
