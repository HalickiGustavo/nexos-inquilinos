import { useMemo, useState, Suspense, lazy } from "react";
import { Download, FileText, TrendingUp, Users, Home, AlertCircle, CheckCircle2, Wallet, Printer } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProperties, useInstallments, useTenants } from "@/lib/queries";
import { formatBRL, formatDate } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";
import { parseExpenses, expensesTotals } from "@/lib/variable-expenses";
import { PageHeader, PageShell } from "@/components/PageHeader";

const ChartFallback = () => <div className="h-[300px] w-full animate-pulse rounded-md bg-muted/40" />;

export function AgencyReportsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: properties = [] } = useProperties();
  const { data: installments = [] } = useInstallments({ from, to, limit: 1000 });

  const [propertyId, setPropertyId] = useState("all");

  const metrics = useMemo(() => {
    const filtered = (installments as any[]).filter(i => {
      const inDate = i.due_date >= from && i.due_date <= to;
      const inProp = propertyId === "all" || i.contract?.property?.id === propertyId;
      return inDate && inProp;
    });

    const totalRecebido = filtered
      .filter(i => i.status === 'pago')
      .reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0);
      
    const totalPendente = filtered
      .filter(i => ['pendente', 'atrasado'].includes(i.status))
      .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    
    const repasses = filtered.filter(i => i.status === 'pago').reduce((acc: Record<string, number>, i: any) => {
      const fee = Number(i.management_fee_percent ?? 10);
      const paid = Number(i.paid_amount ?? 0);
      const taxa = (paid * fee) / 100;
      const exps = parseExpenses(i.variable_expenses);
      const t = expensesTotals(exps);
      const valorRepasse = paid - taxa - t.owner;
      
      const ownerName = i.contract?.property?.owner_name || "Desconhecido";
      acc[ownerName] = (acc[ownerName] || 0) + valorRepasse;
      return acc;
    }, {} as Record<string, number>);

    const yieldRanking = properties.map((p: any) => {
      const pInstallments = filtered.filter(i => i.contract?.property?.id === p.id && i.status === 'pago');
      const revenue = pInstallments.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0);
      return { nickname: p.nickname, revenue };
    }).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);

    const arrears = filtered.filter(i => i.status === 'atrasado').map(i => ({
      tenant: i.contract?.tenant?.full_name || "N/A",
      property: i.contract?.property?.nickname || "N/A",
      due_date: i.due_date,
      amount: Number(i.amount || 0)
    }));

    return { totalRecebido, totalPendente, repasses, yieldRanking, arrears };
  }, [installments, properties, from, to, propertyId]);

  async function handleExportPdf() {
    const lines = [
      "RELATÓRIO ADMINISTRATIVO NEXO",
      `Período: ${formatDate(from)} até ${formatDate(to)}`,
      "",
      `Receita Total (Paga): ${formatBRL(metrics.totalRecebido)}`,
      `Total Pendente/Atrasado: ${formatBRL(metrics.totalPendente)}`,
      "",
      "--- Repasses por Proprietário ---",
      ...Object.entries(metrics.repasses).map(([name, val]) => `${name}: ${formatBRL(val)}`),
      "",
      "--- Ranking de Faturamento (Top 5) ---",
      ...metrics.yieldRanking.map(r => `${r.nickname}: ${formatBRL(r.revenue)}`),
      "",
      "--- Inadimplência ---",
      ...metrics.arrears.map(a => `${formatDate(a.due_date)} - ${a.tenant} (${a.property}): ${formatBRL(a.amount)}`)
    ];
    await downloadPdf(`relatorio-nexo-${from}-a-${to}.pdf`, lines);
    toast.success("PDF gerado com sucesso");
  }

  const totalRepasses = Object.values(metrics.repasses).reduce((a: number, b: number) => a + b, 0);

  return (
    <PageShell>
      <PageHeader 
        title="Relatórios Estratégicos" 
        description="Visão executiva de repasses, faturamento e inadimplência."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()} className="print:hidden">
              <Printer className="size-4 mr-2" /> Imprimir
            </Button>
            <Button onClick={handleExportPdf} className="print:hidden">
              <Download className="size-4 mr-2" /> Exportar PDF
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-6 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Início</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fim</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Imóvel</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os imóveis</SelectItem>
                {properties.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Wallet} label="Receita Recebida" value={formatBRL(metrics.totalRecebido)} tone="emerald" />
        <MetricCard icon={AlertCircle} label="Pendente/Atrasado" value={formatBRL(metrics.totalPendente)} tone="amber" />
        <MetricCard icon={Users} label="Total Repasses" value={formatBRL(totalRepasses)} tone="indigo" />
        <MetricCard icon={TrendingUp} label="Taxa Ocupação" value={`${properties.length > 0 ? Math.round((properties.filter((p: any) => p.status === 'alugado').length / properties.length) * 100) : 0}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Users className="size-5 text-indigo-500" /> Repasses a Proprietários
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics.repasses).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum repasse identificado no período.</p>
            ) : (
              Object.entries(metrics.repasses).map(([name, val]) => (
                <div key={name} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="font-bold text-indigo-600">{formatBRL(val)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="size-5 text-emerald-500" /> Top Imóveis (Faturamento)
          </h3>
          <div className="space-y-3">
            {metrics.yieldRanking.map((r, idx) => (
              <div key={r.nickname} className="flex justify-between items-center border-b pb-2 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                  <span className="text-sm font-medium">{r.nickname}</span>
                </div>
                <span className="font-bold text-emerald-600">{formatBRL(r.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-rose-500">
            <AlertCircle className="size-5" /> Inadimplência Detalhada
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2">Inquilino</th>
                  <th className="py-2">Imóvel</th>
                  <th className="py-2">Vencimento</th>
                  <th className="py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {metrics.arrears.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhuma parcela em atraso no período.</td></tr>
                ) : (
                  metrics.arrears.map((a, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 font-medium">{a.tenant}</td>
                      <td className="py-2">{a.property}</td>
                      <td className="py-2 text-rose-500 font-medium">{formatDate(a.due_date)}</td>
                      <td className="py-2 text-right font-bold">{formatBRL(a.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function MetricCard({ icon: Icon, label, value, tone = "muted" }: { icon: any; label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    indigo: "bg-indigo-500/10 text-indigo-600",
    muted: "bg-muted text-muted-foreground"
  };
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${tones[tone]}`}>
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
