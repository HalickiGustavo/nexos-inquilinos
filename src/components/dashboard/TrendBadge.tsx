import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComparisonResult } from "@/lib/dashboard-utils";

interface TrendBadgeProps {
  comparison: ComparisonResult;
  goodWhenUp?: boolean;
  isPercentagePoints?: boolean;
  periodLabel?: string;
  className?: string;
}

export function TrendBadge({
  comparison,
  goodWhenUp = true,
  isPercentagePoints = false,
  periodLabel = "período anterior",
  className,
}: TrendBadgeProps) {
  if (!comparison.hasComparison) {
    return (
      <span className={cn("text-[11px] text-muted-foreground/60 font-medium", className)}>
        Sem histórico suficiente
      </span>
    );
  }

  if (comparison.previousValue === 0 && comparison.currentValue > 0) {
    return (
      <span className={cn("text-[11px] text-primary font-medium", className)}>
        Novo no período
      </span>
    );
  }

  if (comparison.direction === "neutral") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium", className)}>
        <Minus className="size-3" />
        Sem variação
      </span>
    );
  }

  const isPositiveChange = comparison.direction === "up";
  const improving = isPositiveChange === goodWhenUp;
  
  const Icon = isPositiveChange ? TrendingUp : TrendingDown;
  
  const value = comparison.percentageChange !== null 
    ? Math.abs(comparison.percentageChange).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"
    : Math.abs(comparison.absoluteChange).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  const suffix = isPercentagePoints ? " p.p." : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium",
        improving ? "text-emerald-600 dark:text-emerald-500" : "text-destructive",
        className
      )}
    >
      <Icon className="size-3" />
      {value}{suffix} vs {periodLabel}
    </span>
  );
}
