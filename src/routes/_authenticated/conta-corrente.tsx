import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Building2,
  Search,
  Download,
  FileText,
  Percent,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useProperties, useInstallments, useMaintenances } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { StatementTimeline } from "@/components/owner/StatementTimeline";
import {
  downloadStatementCsv,
  downloadStatementPdf,
  type StatementEntry,
} from "@/lib/owner-export";

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

type KindFilter = "all" | "receita" | "taxa" | "manutencao" | "repasse";

function ContaCorrente() {
  const { data: properties = [], isLoading: lp } = useProperties();
  const { data: installments = [], isLoading: li } = useInstallments();
  const { data: maintenances = [], isLoading: lm } = useMaintenances();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ym = monthKey(cursor);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");

  const propNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties as any[]) m.set(p.id, p.nickname);
    return m;
  }, [properties]);

  const entries: StatementEntry[] = useMemo(() => {
    const out: StatementEntry[] = [];
    // Installments pagas no mês
    for (const i of installments as any[]) {
      const propId = i.contract?.property_id;
      const propName = propId ? propNameById.get(propId) : undefined;
      if (i.status === "pago" && i.payment_date?.slice(0, 7) === ym) {
        const paid = Number(i.paid_amount || i.amount || 0);
        const method: StatementEntry["method"] =
          i.charge_provider?.toLowerCase().includes("pix") || i.pix_payload
            ? "pix"
            : i.boleto_url || i.barcode
              ? "boleto"
              : null;
        out.push({
          id: `i-${i.id}`,
          date: i.payment_date,
          kind: "receita",
          method,
          description: `Aluguel recebido`,
          propertyName: propName,
          amount: paid,
        });
        const feePct = Number(
          i.management_fee_percent ??
            (propId
              ? (properties as any[]).find((p) => p.id === propId)
                  ?.default_management_fee_percent
              : 0) ??
            0,
        );
        const fee = (paid * feePct) / 100;
        if (fee > 0) {
          out.push({
            id: `f-${i.id}`,
            date: i.payment_date,
            kind: "taxa",
            description: `Taxa administrativa (${feePct}%)`,
            propertyName: propName,
            amount: -fee,
          });
        }
      }
    }
    // Manutenções aprovadas do proprietário no mês
    for (const m of maintenances as any[]) {
      if (m.responsible !== "proprietario") continue;
      if (m.budget_status !== "aprovado" && m.status !== "concluido") continue;
      const date =
        m.completed_date || m.budget_decided_at?.slice(0, 10) || m.updated_at?.slice(0, 10);
      if (!date || date.slice(0, 7) !== ym) continue;
      const cost = Number(m.payment_paid_amount || m.cost || m.budget_amount || 0);
      if (cost <= 0) continue;
      out.push({
        id: `m-${m.id}`,
        date,
        kind: "manutencao",
        description: m.title || "Manutenção aprovada",
        propertyName: propNameById.get(m.property_id),
        amount: -cost,
      });
    }
    // Sort chronologically desc
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    return out;
  }, [installments, maintenances, ym, propNameById, properties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        (e.propertyName ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, kindFilter, search]);

  // Totals do período (filtro NÃO aplicado — resumo é sempre o mês inteiro)
  const totals = useMemo(() => {
    const t = { gross: 0, fee: 0, maint: 0 };
    for (const e of entries) {
      if (e.kind === "receita") t.gross += e.amount;
      else if (e.kind === "taxa") t.fee += -e.amount;
      else if (e.kind === "manutencao") t.maint += -e.amount;
    }
    const net = t.gross - t.fee - t.maint;
    return { ...t, net };
  }, [entries]);

  // Detalhamento por imóvel (mantido)
  const perProperty = useMemo(() => {
    const map = new Map<string, { gross: number; fee: number; maint: number }>();
    for (const e of entries) {
      const key = e.propertyName ?? "—";
      if (!map.has(key)) map.set(key, { gross: 0, fee: 0, maint: 0 });
      const acc = map.get(key)!;
      if (e.kind === "receita") acc.gross += e.amount;
      else if (e.kind === "taxa") acc.fee += -e.amount;
      else if (e.kind === "manutencao") acc.maint += -e.amount;
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, net: v.gross - v.fee - v.maint }))
      .sort((a, b) => b.net - a.net);
  }, [entries]);

  const loading = lp || li || lm;
  const title = `Extrato ${monthLabel(cursor)}`;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conta Corrente</h1>
          <p className="text-muted-foreground mt-1">
            Extrato cronológico do mês — entradas, taxas e manutenções.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
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
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadStatementCsv(`extrato-${ym}.csv`, filtered)
            }
            disabled={filtered.length === 0}
          >
            <Download className="size-4 mr-2" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadStatementPdf(`extrato-${ym}.pdf`, title, filtered)
            }
            disabled={filtered.length === 0}
          >
            <FileText className="size-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {/* Consolidated summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Receita Bruta"
          value={formatBRL(totals.gross)}
          icon={<TrendingUp className="size-5" />}
          tone="emerald"
          subtitle="Aluguéis recebidos"
        />
        <SummaryCard
          title="Taxa de Administração"
          value={`- ${formatBRL(totals.fee)}`}
          icon={<Percent className="size-5" />}
          tone="muted"
          subtitle="Comissão da imobiliária"
        />
        <SummaryCard
          title="Manutenções"
          value={`- ${formatBRL(totals.maint)}`}
          icon={<Wrench className="size-5" />}
          tone="muted"
          subtitle="Reparos do proprietário"
        />
        <SummaryCard
          title="Repasse Líquido"
          value={formatBRL(totals.net)}
          icon={<Wallet className="size-5" />}
          tone="primary"
          subtitle="Total do mês"
          highlight
        />
      </div>

      {/* Filtros */}
      <Card className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou imóvel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="receita">Receitas</TabsTrigger>
            <TabsTrigger value="taxa">Taxas</TabsTrigger>
            <TabsTrigger value="manutencao">Manutenções</TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {/* Timeline */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Lançamentos</h3>
            <p className="text-sm text-muted-foreground">
              {filtered.length}{" "}
              {filtered.length === 1 ? "lançamento" : "lançamentos"} exibidos
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {monthLabel(cursor)}
          </Badge>
        </div>
        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Carregando extrato…
          </div>
        ) : (
          <StatementTimeline entries={filtered} />
        )}
      </Card>

      {/* Detalhamento por imóvel — colapsável */}
      <Collapsible>
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full p-5 border-b flex items-center justify-between text-left hover:bg-muted/20 transition">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Detalhamento por imóvel</h3>
                  <p className="text-sm text-muted-foreground">
                    {perProperty.length}{" "}
                    {perProperty.length === 1 ? "imóvel" : "imóveis"} com movimento
                  </p>
                </div>
              </div>
              <TrendingDown className="size-4 text-muted-foreground" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {perProperty.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Sem movimento no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imóvel</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">
                        Taxa
                      </TableHead>
                      <TableHead className="text-right hidden sm:table-cell">
                        Manut.
                      </TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perProperty.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right text-emerald-500 tabular-nums">
                          {formatBRL(r.gross)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                          {r.fee > 0 ? `- ${formatBRL(r.fee)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                          {r.maint > 0 ? `- ${formatBRL(r.maint)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary tabular-nums">
                          {formatBRL(r.net)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  subtitle,
  tone,
  highlight,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  tone: "primary" | "emerald" | "muted";
  highlight?: boolean;
}) {
  const accent =
    tone === "primary"
      ? "text-primary"
      : tone === "emerald"
        ? "text-emerald-500"
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
          <p className={`text-xl lg:text-2xl font-bold mt-1 tabular-nums ${accent}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-muted ${accent} hidden sm:block`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
