import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, Calendar, TrendingUp, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLandlordInstallments } from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_landlord/landlord/financeiro")({
  head: () => ({ meta: [{ title: "Finanças — Proprietário NEXO" }] }),
  component: LandlordFinanceiro,
});

type Filtro = "todos" | "pago" | "pendente" | "atrasado";

function LandlordFinanceiro() {
  const { data: installments = [], isLoading } = useLandlordInstallments();
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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Finanças</h1>
        <p className="text-muted-foreground mt-1">Histórico de parcelas e repasses dos seus imóveis.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Total recebido" value={formatBRL(totals.recebido)} tone="emerald" icon={<Wallet className="size-5" />} />
        <SummaryCard label="A receber" value={formatBRL(totals.aReceber)} tone="violet" icon={<TrendingUp className="size-5" />} />
        <SummaryCard label="Em atraso" value={formatBRL(totals.atrasado)} tone={totals.atrasado > 0 ? "rose" : "zinc"} icon={<Calendar className="size-5" />} />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" /> Parcelas
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

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma parcela neste filtro.</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Inquilino</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i: any) => {
                  const overdue = i.status !== "pago" && i.due_date < todayStr;
                  return (
                    <TableRow key={i.id}>
                      <TableCell>{formatDate(i.due_date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {i.contract?.property?.nickname || i.contract?.property?.address || "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">{i.contract?.tenant?.full_name || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatBRL(Number(i.amount))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge(i.status, overdue)}>
                          {overdue ? "Atrasado" : i.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{i.paid_at ? formatDate(i.paid_at) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone }: {
  label: string; value: string; icon: React.ReactNode;
  tone: "emerald" | "violet" | "rose" | "zinc";
}) {
  const map = {
    emerald: "text-emerald-400 bg-emerald-500/10",
    violet: "text-violet-400 bg-violet-500/10",
    rose: "text-rose-400 bg-rose-500/10",
    zinc: "text-zinc-300 bg-zinc-500/10",
  } as const;
  return (
    <Card className="p-5">
      <div className={`size-10 rounded-lg grid place-items-center ${map[tone]} mb-3`}>{icon}</div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
    </Card>
  );
}

function statusBadge(status: string, overdue: boolean) {
  if (overdue) return "border-rose-500/40 text-rose-300";
  if (status === "pago") return "border-emerald-500/40 text-emerald-300";
  if (status === "agendado") return "border-zinc-700 text-zinc-400";
  return "border-violet-500/40 text-violet-300";
}
