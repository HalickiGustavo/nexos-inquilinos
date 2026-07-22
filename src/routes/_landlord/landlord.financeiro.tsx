import { createFileRoute } from "@tanstack/react-router";
import { memo, useMemo, useState } from "react";
import { Wallet, Calendar, TrendingUp, Filter, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell } from "@/components/PageHeader";
import { useLandlordInstallments } from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_landlord/landlord/financeiro")({
  head: () => ({ meta: [{ title: "Finanças — Proprietário NEXO" }] }),
  component: LandlordFinanceiro,
});

type Filtro = "todos" | "pago" | "pendente" | "atrasado";

function LandlordFinanceiro() {
  const { data: installments = [], isPending } = useLandlordInstallments();
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return (installments as any[]).filter((i) => {
      if (filtro === "todos") return true;
      if (filtro === "pago") return i.status === "pago";
      if (filtro === "pendente") return i.status !== "pago" && i.due_date >= todayStr;
      if (filtro === "atrasado") return i.status !== "pago" && i.due_date < todayStr;
      return true;
    });
  }, [installments, filtro, todayStr]);

  const totals = useMemo(() => {
    const recebido = (installments as any[])
      .filter((i) => i.status === "pago")
      .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
    const aReceber = (installments as any[])
      .filter((i) => i.status !== "pago" && i.due_date >= todayStr)
      .reduce((s, i) => s + Number(i.amount), 0);
    const atrasado = (installments as any[])
      .filter((i) => i.status !== "pago" && i.due_date < todayStr)
      .reduce((s, i) => s + Number(i.amount), 0);
    return { recebido, aReceber, atrasado };
  }, [installments, todayStr]);

  return (
    <PageShell>
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Finanças</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Histórico de parcelas e repasses dos seus imóveis.
        </p>
      </header>

      {isPending ? (
        <FinanceiroSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <SummaryCard label="Total recebido" value={formatBRL(totals.recebido)} tone="emerald" icon={<Wallet className="size-5" />} />
            <SummaryCard label="A receber" value={formatBRL(totals.aReceber)} tone="violet" icon={<TrendingUp className="size-5" />} />
            <SummaryCard label="Em atraso" value={formatBRL(totals.atrasado)} tone={totals.atrasado > 0 ? "rose" : "zinc"} icon={<Calendar className="size-5" />} />
          </div>

          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold inline-flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" /> Parcelas
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  ({filtered.length})
                </span>
              </h2>
              <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                <TabsList>
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="pago">Pagos</TabsTrigger>
                  <TabsTrigger value="pendente">Pendentes</TabsTrigger>
                  <TabsTrigger value="atrasado">Atrasados</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto size-12 rounded-full bg-muted/50 grid place-items-center text-muted-foreground mb-3">
                  <Inbox className="size-6" />
                </div>
                <p className="text-sm font-medium">Nenhuma parcela neste filtro</p>
                <p className="text-xs text-muted-foreground mt-1">Ajuste o filtro acima para ver outros períodos.</p>
              </div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Vencimento</TableHead>
                        <TableHead>Imóvel</TableHead>
                        <TableHead>Inquilino</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="whitespace-nowrap">Pago em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((i: any) => {
                        const overdue = i.status !== "pago" && i.due_date < todayStr;
                        return (
                          <TableRow key={i.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="tabular-nums whitespace-nowrap">{formatDate(i.due_date)}</TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {i.contract?.property?.nickname || i.contract?.property?.address || "—"}
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate">{i.contract?.tenant?.full_name || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{formatBRL(Number(i.amount))}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("capitalize", statusBadge(i.status, overdue))}>
                                {overdue ? "Atrasado" : i.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                              {i.paid_at ? formatDate(i.paid_at) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}

const SummaryCard = memo(function SummaryCard({ label, value, icon, tone }: {
  label: string; value: string; icon: React.ReactNode;
  tone: "emerald" | "violet" | "rose" | "zinc";
}) {
  const map = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10 ring-violet-500/30",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10 ring-rose-500/30",
    zinc: "text-muted-foreground bg-muted/60 ring-border",
  } as const;
  return (
    <Card className="p-5 transition-all hover:border-primary/30 hover:shadow-card">
      <div className={cn("size-10 rounded-lg grid place-items-center ring-1 mb-3", map[tone])}>{icon}</div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1 leading-tight">{value}</p>
    </Card>
  );
});

function FinanceiroSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </Card>
        ))}
      </div>
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-72" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </Card>
    </>
  );
}

function statusBadge(status: string, overdue: boolean) {
  if (overdue) return "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5";
  if (status === "pago") return "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5";
  if (status === "agendado") return "border-border text-muted-foreground";
  return "border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/5";
}
