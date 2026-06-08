import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, TrendingDown, TrendingUp, Wrench, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useProperties, useInstallments, useMaintenances } from "@/lib/queries";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conta-corrente")({
  head: () => ({ meta: [{ title: "Conta Corrente — Nexo" }] }),
  component: ContaCorrente,
});

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function ContaCorrente() {
  const { data: properties = [], isLoading: lp } = useProperties();
  const { data: installments = [], isLoading: li } = useInstallments();
  const { data: maintenances = [], isLoading: lm } = useMaintenances();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ym = monthKey(cursor);

  const rows = useMemo(() => {
    return properties.map((p: any) => {
      // Paid installments this month for this property
      const paid = installments.filter(
        (i: any) =>
          i.contract?.property_id === p.id &&
          i.status === "pago" &&
          (i.payment_date?.slice(0, 7) === ym || i.due_date?.slice(0, 7) === ym),
      );
      const gross = paid.reduce(
        (s: number, i: any) => s + Number(i.paid_amount || i.amount || 0),
        0,
      );
      const mgmtFee = paid.reduce(
        (s: number, i: any) =>
          s + (Number(i.paid_amount || i.amount || 0) * Number(i.management_fee_percent ?? p.default_management_fee_percent ?? 0)) / 100,
        0,
      );
      // Approved maintenance whose owner is responsible, completed this month
      const maint = maintenances
        .filter(
          (m: any) =>
            m.property_id === p.id &&
            m.responsible === "proprietario" &&
            (m.budget_status === "aprovado" || m.status === "concluido") &&
            (m.completed_date?.slice(0, 7) === ym || m.updated_at?.slice(0, 7) === ym),
        )
        .reduce((s: number, m: any) => s + Number(m.budget_amount || m.cost || 0), 0);
      const net = gross - mgmtFee - maint;
      return { property: p, gross, mgmtFee, maint, net };
    }).filter((r) => r.gross > 0 || r.mgmtFee > 0 || r.maint > 0);
  }, [properties, installments, maintenances, ym]);

  const totals = rows.reduce(
    (acc, r) => {
      acc.gross += r.gross;
      acc.mgmtFee += r.mgmtFee;
      acc.maint += r.maint;
      acc.net += r.net;
      return acc;
    },
    { gross: 0, mgmtFee: 0, maint: 0, net: 0 },
  );

  const loading = lp || li || lm;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conta Corrente</h1>
          <p className="text-muted-foreground mt-1">
            Extrato consolidado dos seus imóveis — repasse líquido do mês.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-[140px] text-center">
            {monthLabel(cursor)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Consolidated summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Receita Bruta"
          value={formatBRL(totals.gross)}
          icon={<TrendingUp className="size-5" />}
          tone="emerald"
          subtitle="Soma dos aluguéis pagos"
        />
        <SummaryCard
          title="Taxa de Administração"
          value={`- ${formatBRL(totals.mgmtFee)}`}
          icon={<TrendingDown className="size-5" />}
          tone="muted"
          subtitle="Comissão da imobiliária"
        />
        <SummaryCard
          title="Manutenções Aprovadas"
          value={`- ${formatBRL(totals.maint)}`}
          icon={<Wrench className="size-5" />}
          tone="muted"
          subtitle="Reparos sob sua responsabilidade"
        />
        <SummaryCard
          title="Repasse Líquido"
          value={formatBRL(totals.net)}
          icon={<Wallet className="size-5" />}
          tone="primary"
          subtitle="Total a creditar este mês"
          highlight
        />
      </div>

      {/* Per-property table */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              Detalhamento por imóvel
            </h3>
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "imóvel" : "imóveis"} com movimento no período
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">{monthLabel(cursor)}</Badge>
        </div>

        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando extrato…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhum recebimento registrado neste mês.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead className="text-right">Receita Bruta</TableHead>
                  <TableHead className="text-right">Taxa Admin.</TableHead>
                  <TableHead className="text-right">Manutenção</TableHead>
                  <TableHead className="text-right">Repasse Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ property, gross, mgmtFee, maint, net }) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <div className="font-medium">{property.nickname}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                        {property.address}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-emerald-500 font-medium tabular-nums">
                      {formatBRL(gross)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {mgmtFee > 0 ? `- ${formatBRL(mgmtFee)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {maint > 0 ? `- ${formatBRL(maint)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary tabular-nums">
                      {formatBRL(net)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right text-emerald-500 tabular-nums">
                    {formatBRL(totals.gross)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    - {formatBRL(totals.mgmtFee)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    - {formatBRL(totals.maint)}
                  </TableCell>
                  <TableCell className="text-right text-primary tabular-nums">
                    {formatBRL(totals.net)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({
  title, value, icon, subtitle, tone, highlight,
}: {
  title: string; value: string; icon: React.ReactNode; subtitle?: string;
  tone: "primary" | "emerald" | "muted"; highlight?: boolean;
}) {
  const accent =
    tone === "primary" ? "text-primary"
    : tone === "emerald" ? "text-emerald-500"
    : "text-muted-foreground";
  return (
    <Card
      className={
        "p-5 " +
        (highlight
          ? "border-primary/40 shadow-[0_0_24px_-8px_var(--primary)] bg-primary/[0.03]"
          : "")
      }
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${accent}`}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-muted ${accent}`}>{icon}</div>
      </div>
    </Card>
  );
}
