import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Wallet, TrendingUp, TrendingDown, Filter, Search, Download, Receipt, Wrench, ArrowDownToLine, ArrowUpFromLine,
  Calendar, FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useLandlordInstallments, useLandlordMaintenances, useLandlordWithdrawals,
} from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_landlord/landlord/financeiro")({
  head: () => ({ meta: [{ title: "Conta Corrente — Proprietário NEXO" }] }),
  component: LandlordContaCorrente,
});

type Categoria = "todos" | "receita" | "taxa" | "manutencao" | "repasse";
type EntryKind = "receita" | "taxa" | "manutencao" | "repasse";
type PeriodOpt = "30d" | "90d" | "ytd" | "12m" | "all";

type Entry = {
  id: string;
  date: string;
  kind: EntryKind;
  title: string;
  subtitle?: string;
  property?: string;
  amount: number; // positivo = entrada, negativo = saída (para o proprietário)
};

function LandlordContaCorrente() {
  const { data: installments = [], isLoading } = useLandlordInstallments();
  const { data: maintenances = [] } = useLandlordMaintenances();
  const { data: withdrawals = [] } = useLandlordWithdrawals();
  const [categoria, setCategoria] = useState<Categoria>("todos");
  const [period, setPeriod] = useState<PeriodOpt>("90d");
  const [search, setSearch] = useState("");

  const cutoff = useMemo(() => {
    const d = new Date();
    if (period === "30d") d.setDate(d.getDate() - 30);
    else if (period === "90d") d.setDate(d.getDate() - 90);
    else if (period === "ytd") return `${new Date().getFullYear()}-01-01`;
    else if (period === "12m") d.setMonth(d.getMonth() - 12);
    else return "1970-01-01";
    return d.toISOString().slice(0, 10);
  }, [period]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];

    for (const i of installments as any[]) {
      if (i.status !== "pago") continue;
      const date = i.paid_at || i.payment_date || i.due_date;
      const amount = Number(i.paid_amount || i.amount);
      const feePct = Number(i.management_fee_percent || 0);
      const propName = i.contract?.property?.nickname || i.contract?.property?.address || "";
      const tenant = i.contract?.tenant?.full_name || "";

      list.push({
        id: `rec-${i.id}`,
        date, kind: "receita",
        title: `Aluguel recebido${tenant ? ` · ${tenant}` : ""}`,
        subtitle: i.charge_provider ? `via ${String(i.charge_provider).toUpperCase()}` : undefined,
        property: propName,
        amount,
      });
      if (feePct > 0) {
        list.push({
          id: `fee-${i.id}`,
          date, kind: "taxa",
          title: `Taxa administrativa (${feePct.toFixed(1)}%)`,
          subtitle: "Retida no repasse",
          property: propName,
          amount: -((amount * feePct) / 100),
        });
      }
      // Repasse líquido (informativo)
      if (i.landlord_payout_status === "pago" && i.landlord_payout_amount) {
        list.push({
          id: `pay-${i.id}`,
          date: i.landlord_payout_date || date,
          kind: "repasse",
          title: "Repasse líquido creditado",
          property: propName,
          amount: Number(i.landlord_payout_amount),
        });
      }
    }

    for (const m of maintenances as any[]) {
      if (!m.budget_amount) continue;
      const propName = m.property?.nickname || m.property?.address || "";
      list.push({
        id: `maint-${m.id}`,
        date: m.updated_at || m.created_at,
        kind: "manutencao",
        title: m.title || "Manutenção",
        subtitle: m.status === "concluida" ? "Concluída" : "Retida em aberto",
        property: propName,
        amount: -Number(m.budget_amount),
      });
    }

    for (const w of withdrawals as any[]) {
      if (!["pago", "processando", "solicitado"].includes(w.status)) continue;
      list.push({
        id: `wd-${w.id}`,
        date: w.paid_at || w.requested_at,
        kind: "repasse",
        title: `Saque PIX ${w.status === "pago" ? "confirmado" : "solicitado"}`,
        subtitle: `${w.pix_key_type?.toUpperCase()} · ${w.pix_key}`,
        amount: -Number(w.amount),
      });
    }

    return list
      .filter((e) => String(e.date).slice(0, 10) >= cutoff)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [installments, maintenances, withdrawals, cutoff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (categoria !== "todos" && e.kind !== categoria) return false;
      if (!q) return true;
      return [e.title, e.subtitle, e.property].filter(Boolean).some((s) => s!.toLowerCase().includes(q));
    });
  }, [entries, categoria, search]);

  const resumo = useMemo(() => {
    const acc = { bruta: 0, taxas: 0, manut: 0, repasses: 0 };
    for (const e of filtered) {
      if (e.kind === "receita") acc.bruta += e.amount;
      if (e.kind === "taxa") acc.taxas += -e.amount;
      if (e.kind === "manutencao") acc.manut += -e.amount;
      if (e.kind === "repasse") acc.repasses += e.amount;
    }
    const liquida = acc.bruta - acc.taxas - acc.manut;
    return { ...acc, liquida };
  }, [filtered]);

  // Receita acumulada por imóvel
  const porImovel = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      if (e.kind !== "receita" || !e.property) continue;
      map.set(e.property, (map.get(e.property) ?? 0) + e.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filtered]);

  function download(kind: "csv" | "excel") {
    // Exporta CSV (Excel abre CSV sem plugins) — mantém regra de negócio intacta.
    const header = ["Data", "Categoria", "Descrição", "Detalhe", "Imóvel", "Valor"];
    const rows = filtered.map((e) => [
      formatDate(e.date), e.kind, e.title, e.subtitle ?? "", e.property ?? "",
      e.amount.toFixed(2).replace(".", ","),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: kind === "csv" ? "text/csv;charset=utf-8" : "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conta-corrente-${new Date().toISOString().slice(0, 10)}.${kind === "excel" ? "xls" : "csv"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPDF() {
    // Impressão amigável — evita dependência extra.
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Conta Corrente NEXO</title>
      <style>body{font-family:system-ui;padding:24px;color:#111}h1{margin:0 0 4px}p{margin:0 0 16px;color:#555;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}
      .r{text-align:right;font-variant-numeric:tabular-nums}</style></head><body>
      <h1>Conta Corrente — Proprietário</h1><p>Período: ${period.toUpperCase()} · Emitido em ${formatDate(new Date())}</p>
      <table><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Imóvel</th><th class="r">Valor</th></tr></thead><tbody>
      ${filtered.map((e) => `<tr><td>${formatDate(e.date)}</td><td>${e.kind}</td><td>${escapeHtml(e.title)}${e.subtitle ? ` — <small>${escapeHtml(e.subtitle)}</small>` : ""}</td><td>${escapeHtml(e.property ?? "")}</td><td class="r">${formatBRL(e.amount)}</td></tr>`).join("")}
      </tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus(); w.print();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80 font-medium mb-2">
            <Receipt className="size-3.5" /> Conta Corrente
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">Extrato financeiro</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Movimentações da sua carteira. Filtre por categoria, imóvel ou período.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="shrink-0">
              <Download className="size-4 mr-2" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={downloadPDF}><FileText className="size-4 mr-2" />PDF (imprimir)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => download("excel")}><FileText className="size-4 mr-2" />Excel (.xls)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => download("csv")}><FileText className="size-4 mr-2" />CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Resumo do período */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard label="Receita bruta" value={formatBRL(resumo.bruta)} tone="emerald" icon={<TrendingUp className="size-4" />} />
        <SummaryCard label="Taxas adm." value={formatBRL(resumo.taxas)} tone="amber" icon={<TrendingDown className="size-4" />} />
        <SummaryCard label="Manutenções" value={formatBRL(resumo.manut)} tone="rose" icon={<Wrench className="size-4" />} />
        <SummaryCard label="Repasses / saques" value={formatBRL(resumo.repasses)} tone="violet" icon={<ArrowDownToLine className="size-4" />} />
        <SummaryCard label="Receita líquida" value={formatBRL(resumo.liquida)} tone="emerald" icon={<Wallet className="size-4" />} />
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center">
          <div className="relative min-w-0">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição ou imóvel…"
              className="pl-9"
            />
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOpt)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="ytd">Ano atual</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="todos"><Filter className="size-3 mr-1" />Todos</TabsTrigger>
              <TabsTrigger value="receita">Receitas</TabsTrigger>
              <TabsTrigger value="taxa">Taxas</TabsTrigger>
              <TabsTrigger value="manutencao">Manutenções</TabsTrigger>
              <TabsTrigger value="repasse">Repasses</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Extrato cronológico */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="font-semibold inline-flex items-center gap-2 mb-3">
            <Calendar className="size-4 text-primary" /> Extrato cronológico
          </h2>
          {isLoading ? (
            <ul className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <li key={i} className="h-14 rounded-md bg-muted/40 animate-pulse" />)}</ul>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lançamento neste filtro.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((e) => (
                <li key={e.id} className="py-3 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
                  <div className={`size-9 rounded-lg grid place-items-center ring-1 shrink-0 ${entryToneClass(e.kind)}`}>
                    {entryIcon(e.kind)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDate(e.date)}{e.property ? ` · ${e.property}` : ""}{e.subtitle ? ` · ${e.subtitle}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${e.amount >= 0 ? "text-emerald-400" : "text-rose-300"}`}>
                      {e.amount >= 0 ? "+" : "−"}{formatBRL(Math.abs(e.amount))}
                    </p>
                    <Badge variant="outline" className="mt-1 text-[10px] font-normal capitalize">{e.kind}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Ranking receita por imóvel */}
        <Card className="p-4">
          <h2 className="font-semibold inline-flex items-center gap-2 mb-3">
            <ArrowUpFromLine className="size-4 text-primary" /> Receita por imóvel
          </h2>
          {porImovel.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem receita no período.</p>
          ) : (
            <ul className="space-y-3">
              {porImovel.map(([name, value]) => {
                const max = porImovel[0][1] || 1;
                const pct = Math.round((value / max) * 100);
                return (
                  <li key={name}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{name}</span>
                      <span className="font-semibold tabular-nums text-emerald-400 shrink-0">{formatBRL(value)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-emerald-400" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------ helpers ------ */

function SummaryCard({ label, value, tone, icon }: {
  label: string; value: string; tone: "emerald" | "amber" | "rose" | "violet"; icon: React.ReactNode;
}) {
  const map = {
    emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
    rose: "text-rose-400 bg-rose-500/10 ring-rose-500/30",
    violet: "text-violet-400 bg-violet-500/10 ring-violet-500/30",
  } as const;
  return (
    <Card className="p-4">
      <div className={`size-8 rounded-md grid place-items-center ring-1 ${map[tone]} mb-2`}>{icon}</div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className="text-lg font-bold tabular-nums truncate mt-0.5">{value}</p>
    </Card>
  );
}

function entryIcon(k: EntryKind) {
  if (k === "receita") return <TrendingUp className="size-4" />;
  if (k === "taxa") return <TrendingDown className="size-4" />;
  if (k === "manutencao") return <Wrench className="size-4" />;
  return <ArrowDownToLine className="size-4" />;
}

function entryToneClass(k: EntryKind) {
  return {
    receita: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    taxa: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
    manutencao: "text-rose-400 bg-rose-500/10 ring-rose-500/30",
    repasse: "text-violet-400 bg-violet-500/10 ring-violet-500/30",
  }[k];
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
