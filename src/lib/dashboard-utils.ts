export type TrendDirection = "up" | "down" | "neutral" | "unavailable";

export interface ComparisonResult {
  currentValue: number;
  previousValue: number | null;
  percentageChange: number | null;
  absoluteChange: number | null;
  direction: TrendDirection;
  hasComparison: boolean;
}

/**
 * Calcula a variação entre dois valores para fins de dashboard.
 */
export function calculateComparison(
  current: number,
  previous: number | undefined | null,
  options: { goodWhenUp?: boolean; isPercentage?: boolean } = {}
): ComparisonResult {
  const { goodWhenUp = true, isPercentage = false } = options;
  
  if (previous === undefined || previous === null) {
    return {
      currentValue: current,
      previousValue: null,
      percentageChange: null,
      absoluteChange: null,
      direction: "unavailable",
      hasComparison: false,
    };
  }

  const absoluteChange = current - previous;
  let percentageChange: number | null = null;
  let direction: TrendDirection = "neutral";

  if (previous !== 0) {
    percentageChange = (absoluteChange / Math.abs(previous)) * 100;
  }

  if (absoluteChange > 0) {
    direction = "up";
  } else if (absoluteChange < 0) {
    direction = "down";
  }

  return {
    currentValue: current,
    previousValue: previous,
    percentageChange,
    absoluteChange,
    direction,
    hasComparison: true,
  };
}

/**
 * Formata um resultado de comparação para exibição amigável.
 */
export function formatTrendText(
  comparison: ComparisonResult,
  options: { 
    isPercentagePoints?: boolean;
    periodLabel?: string;
  } = {}
) {
  const { isPercentagePoints = false, periodLabel = "mês anterior" } = options;
  
  if (!comparison.hasComparison) return "Sem histórico suficiente";
  
  if (comparison.previousValue === 0 && comparison.currentValue > 0) {
    return "Novo no período";
  }
  
  if (comparison.absoluteChange === 0) {
    return "Sem variação";
  }

  const value = comparison.percentageChange !== null 
    ? Math.abs(comparison.percentageChange).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"
    : Math.abs(comparison.absoluteChange).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  const suffix = isPercentagePoints ? " p.p." : "";
  const label = value + suffix;

  return `${label} vs ${periodLabel}`;
}
