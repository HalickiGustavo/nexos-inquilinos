import { CheckCircle2, AlertTriangle, Info, AlertOctagon, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Insight, InsightSeverity } from "@/lib/owner-insights";

function iconFor(s: InsightSeverity) {
  switch (s) {
    case "success":
      return CheckCircle2;
    case "warning":
      return AlertTriangle;
    case "critical":
      return AlertOctagon;
    default:
      return Info;
  }
}
function toneRing(s: InsightSeverity) {
  switch (s) {
    case "success":
      return "text-emerald-500 bg-emerald-500/10 ring-emerald-500/30";
    case "warning":
      return "text-amber-500 bg-amber-500/10 ring-amber-500/30";
    case "critical":
      return "text-destructive bg-destructive/10 ring-destructive/30";
    default:
      return "text-primary bg-primary/10 ring-primary/30";
  }
}

export function PortfolioInsights({ insights }: { insights: Insight[] }) {
  return (
    <Card className="p-5 lg:p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-4 text-primary" />
        <h3 className="font-semibold">Insights da carteira</h3>
      </div>
      <ul className="space-y-3">
        {insights.map((it) => {
          const Icon = iconFor(it.severity);
          return (
            <li
              key={it.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-3"
            >
              <div className={`p-1.5 rounded-md ring-1 shrink-0 ${toneRing(it.severity)}`}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{it.title}</p>
                {it.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{it.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
