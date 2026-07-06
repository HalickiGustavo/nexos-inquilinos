import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wrench,
  Percent,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";
import type { StatementEntry } from "@/lib/owner-export";

function kindMeta(k: StatementEntry["kind"]) {
  switch (k) {
    case "receita":
      return { icon: ArrowDownCircle, tone: "text-emerald-500", label: "Receita" };
    case "taxa":
      return { icon: Percent, tone: "text-muted-foreground", label: "Taxa admin" };
    case "manutencao":
      return { icon: Wrench, tone: "text-amber-500", label: "Manutenção" };
    case "repasse":
      return { icon: Wallet, tone: "text-primary", label: "Repasse" };
    default:
      return { icon: ArrowUpCircle, tone: "text-muted-foreground", label: "—" };
  }
}

export function StatementTimeline({ entries }: { entries: StatementEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        Nenhum lançamento no período com os filtros atuais.
      </div>
    );
  }

  // group by date
  const groups = new Map<string, StatementEntry[]>();
  for (const e of entries) {
    const k = e.date;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  const sortedDates = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="divide-y divide-border/40">
      {sortedDates.map((d) => {
        const items = groups.get(d)!;
        const dayTotal = items.reduce((s, e) => s + e.amount, 0);
        return (
          <div key={d} className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-semibold text-muted-foreground">
                {formatDate(d)}
              </div>
              <div
                className={`text-sm font-semibold tabular-nums ${
                  dayTotal >= 0 ? "text-emerald-500" : "text-destructive"
                }`}
              >
                {dayTotal >= 0 ? "+ " : "- "}
                {formatBRL(Math.abs(dayTotal))}
              </div>
            </div>
            <div className="space-y-2">
              {items.map((e) => {
                const { icon: Icon, tone, label } = kindMeta(e.kind);
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-md border border-border/50 bg-muted/10 px-3 py-2"
                  >
                    <div
                      className={`shrink-0 size-8 rounded-md bg-background border border-border/60 grid place-items-center ${tone}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">
                        <span className="font-medium">{e.description}</span>
                        {e.propertyName ? (
                          <span className="text-muted-foreground">
                            {" · "}
                            {e.propertyName}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {label}
                        </span>
                        {e.method ? (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 uppercase">
                            {e.method}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-semibold tabular-nums shrink-0 ${
                        e.amount >= 0 ? "text-emerald-500" : "text-destructive"
                      }`}
                    >
                      {e.amount >= 0 ? "+ " : "- "}
                      {formatBRL(Math.abs(e.amount))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
