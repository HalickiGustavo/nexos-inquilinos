import { useState } from "react";
import { Bell, ArrowRight, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MaintenanceBudgetPanel } from "@/components/MaintenanceBudgetPanel";
import { formatBRL } from "@/lib/format";

export function PendingApprovalsPanel({ items }: { items: any[] }) {
  const [open, setOpen] = useState<any | null>(null);

  if (!items || items.length === 0) return null;

  const total = items.reduce((s, m) => s + Number(m.budget_amount || 0), 0);

  return (
    <Card
      className="p-5 lg:p-6 border-primary/40 relative overflow-hidden"
      style={{
        boxShadow: "0 0 40px -20px color-mix(in oklab, var(--primary) 60%, transparent)",
      }}
    >
      <div className="absolute inset-0 -z-10 opacity-40 blur-2xl bg-primary/10" aria-hidden />
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-full bg-primary/15 grid place-items-center text-primary ring-1 ring-primary/40 shrink-0">
            <Bell className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold flex items-center gap-2 truncate">
              Aprovações pendentes
              <Badge className="bg-primary text-primary-foreground shrink-0">{items.length}</Badge>
            </h3>
            <p className="text-sm text-muted-foreground">
              Total {formatBRL(total)} aguardando sua decisão
            </p>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
        {items.slice(0, 4).map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 px-4 py-3 bg-background/40 flex-wrap sm:flex-nowrap"
          >
            <Wrench className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{m.title || "Manutenção"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {m.property?.nickname || "Imóvel"}
              </div>
            </div>
            <div className="text-sm font-semibold tabular-nums shrink-0">
              {formatBRL(Number(m.budget_amount || 0))}
            </div>
            <div className="flex gap-2 shrink-0 w-full sm:w-auto">
              <Dialog
                open={open?.id === m.id}
                onOpenChange={(o) => setOpen(o ? m : null)}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    Ver orçamento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Orçamento — {m.title || "Manutenção"}</DialogTitle>
                  </DialogHeader>
                  <MaintenanceBudgetPanel item={m} />
                </DialogContent>
              </Dialog>
            </div>
          </li>
        ))}
      </ul>

      {items.length > 4 && (
        <div className="mt-3 text-right">
          <a
            href="/maintenances"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Ver todos ({items.length})
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      )}
    </Card>
  );
}
