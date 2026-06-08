import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Download, FileDigit, Calculator } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useInstallments, useProperties } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { aggregateDimob, downloadDimobFile } from "@/lib/dimob";

export const Route = createFileRoute("/_manager/manager/dimob")({
  head: () => ({ meta: [{ title: "Fiscal / DIMOB — NEXO" }] }),
  component: DimobPage,
});

function DimobPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear - 1);
  const [declarantDoc, setDeclarantDoc] = useState("");
  const [declarantName, setDeclarantName] = useState("");

  const { data: installments = [], isLoading: li } = useInstallments();
  const { data: properties = [], isLoading: lp } = useProperties();
  const loading = li || lp;

  const agg = useMemo(
    () =>
      aggregateDimob({
        year,
        declarant: { doc: declarantDoc, name: declarantName },
        installments,
        properties,
      }),
    [year, declarantDoc, declarantName, installments, properties],
  );

  // Resumo por proprietário
  const ownerSummary = useMemo(() => {
    const map = new Map<string, { name: string; rent: number; tax: number; commission: number }>();
    for (const r of agg.rows) {
      const key = (r.owner_doc || r.owner_name || "—").trim();
      const cur = map.get(key) || { name: r.owner_name || "—", rent: 0, tax: 0, commission: 0 };
      cur.rent += r.monthly_rent.reduce((s, v) => s + v, 0);
      cur.tax += r.monthly_tax.reduce((s, v) => s + v, 0);
      cur.commission += r.monthly_commission.reduce((s, v) => s + v, 0);
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([doc, v]) => ({ doc, ...v }));
  }, [agg]);

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  function handleGenerate() {
    if (!declarantDoc.trim() || !declarantName.trim()) {
      toast.error("Informe CNPJ e razão social da imobiliária declarante.");
      return;
    }
    if (agg.rows.length === 0) {
      toast.error("Nenhuma locação paga encontrada no ano selecionado.");
      return;
    }
    downloadDimobFile(agg);
    toast.success(`Arquivo DIMOB_${year}.txt gerado com sucesso.`);
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-violet-400 mb-2">
          <FileDigit className="size-3.5" /> Fiscal
        </div>
        <h1 className="text-3xl font-bold tracking-tight">DIMOB</h1>
        <p className="text-muted-foreground mt-1">
          Declaração de Informações sobre Atividades Imobiliárias — Receita Federal.
          Selecione o ano-base, confira os dados consolidados e baixe o arquivo .txt para importação no PVA.
        </p>
      </div>

      {/* Filtros */}
      <Card className="p-5 border-violet-500/20 shadow-[0_0_24px_-12px_rgb(168_85_247)]">
        <div className="grid gap-4 md:grid-cols-[180px_1fr_1fr]">
          <div className="space-y-2">
            <Label>Ano-base</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>CNPJ da imobiliária declarante</Label>
            <Input
              value={declarantDoc}
              onChange={(e) => setDeclarantDoc(e.target.value)}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label>Razão social</Label>
            <Input
              value={declarantName}
              onChange={(e) => setDeclarantName(e.target.value)}
              placeholder="NEXO IMOBILIÁRIA LTDA"
            />
          </div>
        </div>
      </Card>

      {/* Totais consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric title="Contratos" value={String(agg.totals.contractCount)} />
        <Metric title="Aluguéis recebidos" value={formatBRL(agg.totals.rentSum)} accent="emerald" />
        <Metric title="Comissões" value={formatBRL(agg.totals.commissionSum)} accent="violet" />
        <Metric title="IRRF retido" value={formatBRL(agg.totals.taxSum)} />
      </div>

      {/* Prévia por proprietário */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Calculator className="size-4 text-muted-foreground" />
              Prévia por proprietário — Ano {year}
            </h3>
            <p className="text-sm text-muted-foreground">
              Totais agregados que serão exportados no R02 do arquivo DIMOB.
            </p>
          </div>
          <Badge variant="secondary">{agg.rows.length} registro(s) R02</Badge>
        </div>

        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando dados…</div>
        ) : ownerSummary.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhuma parcela paga encontrada em {year}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proprietário</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead className="text-right">Aluguéis</TableHead>
                  <TableHead className="text-right">Comissões</TableHead>
                  <TableHead className="text-right">IRRF retido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ownerSummary.map((o) => (
                  <TableRow key={o.doc}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {o.doc || <span className="text-destructive">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-emerald-500 tabular-nums">
                      {formatBRL(o.rent)}
                    </TableCell>
                    <TableCell className="text-right text-violet-400 tabular-nums">
                      {formatBRL(o.commission)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(o.tax)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right text-emerald-500 tabular-nums">
                    {formatBRL(agg.totals.rentSum)}
                  </TableCell>
                  <TableCell className="text-right text-violet-400 tabular-nums">
                    {formatBRL(agg.totals.commissionSum)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(agg.totals.taxSum)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Ação principal */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-xl border border-violet-500/30 bg-violet-500/5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
            <FileText className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Pronto para exportar?</p>
            <p className="text-sm text-muted-foreground">
              O arquivo segue o layout pipe-delimited aceito pelo PVA DIMOB (R01 / R02 / T9).
            </p>
          </div>
        </div>
        <Button
          size="lg"
          onClick={handleGenerate}
          className="bg-violet-500 hover:bg-violet-400 text-white shadow-[0_0_24px_-6px_rgb(168_85_247)]"
        >
          <Download className="size-4 mr-2" />
          Gerar Arquivo DIMOB
        </Button>
      </div>
    </div>
  );
}

function Metric({
  title, value, accent,
}: { title: string; value: string; accent?: "emerald" | "violet" }) {
  const tone =
    accent === "emerald" ? "text-emerald-500"
    : accent === "violet" ? "text-violet-400"
    : "text-foreground";
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${tone}`}>{value}</p>
    </Card>
  );
}
