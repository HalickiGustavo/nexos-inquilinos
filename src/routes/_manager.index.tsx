import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, TrendingUp, PercentCircle, UserPlus } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_manager/")({
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const qProps = useQuery({
    queryKey: ["mgr", "properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id,status,rent_price");
      if (error) throw error; return data ?? [];
    },
  });
  const qInst = useQuery({
    queryKey: ["mgr", "installments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("installments").select("amount,paid_amount,due_date,status,payment_date");
      if (error) throw error; return data ?? [];
    },
  });
  const qLeads = useQuery({
    queryKey: ["mgr", "leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_leads").select("id,stage");
      if (error) throw error; return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel("mgr-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "installments" }, () => qInst.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => qLeads.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, () => qProps.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qInst, qLeads, qProps]);

  const props = qProps.data ?? [];
  const inst = qInst.data ?? [];
  const leads = qLeads.data ?? [];

  const vgv = props.reduce((s, p: any) => s + Number(p.rent_price ?? 0) * 12, 0);
  const totalProps = props.length;
  const disp = props.filter((p: any) => p.status === "disponivel").length;
  const vacancia = totalProps ? (disp / totalProps) * 100 : 0;

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const receitaMes = inst.filter((i: any) => (i.payment_date ?? "").startsWith(ym))
    .reduce((s, i: any) => s + Number(i.paid_amount ?? 0), 0);

  const leadsAtivos = leads.filter((l: any) => l.stage !== "fechado").length;

  // Last 6 months chart
  const months: { mes: string; previsto: number; recebido: number }[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    const previsto = inst.filter((i: any) => (i.due_date ?? "").startsWith(key)).reduce((s, i: any) => s + Number(i.amount ?? 0), 0);
    const recebido = inst.filter((i: any) => (i.payment_date ?? "").startsWith(key)).reduce((s, i: any) => s + Number(i.paid_amount ?? 0), 0);
    months.push({ mes: label, previsto, recebido });
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="text-sm text-zinc-500">Visão geral da imobiliária</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Building2} label="VGV sob gestão" value={formatBRL(vgv)} accent="emerald" />
        <Kpi icon={TrendingUp} label="Receita do mês" value={formatBRL(receitaMes)} accent="emerald" />
        <Kpi icon={PercentCircle} label="Taxa de vacância" value={`${vacancia.toFixed(1)}%`} accent="amber" />
        <Kpi icon={UserPlus} label="Leads ativos" value={String(leadsAtivos)} accent="indigo" />
      </div>

      <Card>
        <CardHeader><CardTitle>Previsto vs Recebido (últimos 6 meses)</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
              <Legend />
              <Bar dataKey="previsto" name="Previsto" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="recebido" name="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    indigo: "bg-indigo-500/10 text-indigo-600",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`size-12 rounded-lg grid place-items-center ${colors[accent]}`}><Icon className="size-6" /></div>
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
