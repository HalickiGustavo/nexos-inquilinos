import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, ArrowRight, AlertTriangle, Bell, Building2, Calendar,
  ClipboardCheck, FilePlus, FileSearch, Inbox, Home as HomeIcon, KeyRound, Users,
  Wallet, Coins, TrendingUp, CheckCircle2, CircleDollarSign, PlusCircle,
  UserPlus, Database, Info, HelpCircle, MessageSquare, AlertCircle, PlusCircle as PlusCircleIcon
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { NexoLogo } from "@/components/NexoLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL, formatBRLCompact, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PortfolioSummary } from "@/components/owner/PortfolioSummary";
import { calculateComparison, ComparisonResult } from "@/lib/dashboard-utils";
import { TrendBadge } from "@/components/dashboard/TrendBadge";


const DashboardCollectionChart = lazy(() => import("@/components/charts/DashboardCollectionChart"));

type RangeKey = "7d" | "30d" | "90d" | "ano";
const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  ano: "Ano",
};

export const Route = createFileRoute("/_manager/manager/")({
  head: () => ({ meta: [{ title: "Dashboard — NEXO Imobiliária" }] }),
  component: ManagerDashboard,
});

/* ---------- utilities ---------- */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

/* ---------- component ---------- */
function ManagerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    return { from, to };
  });
  const [range, setRange] = useState<RangeKey>("30d");

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        qc.invalidateQueries({ queryKey: ["mgr-dash"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const monthStart = date?.from ? iso(date.from) : iso(startOfMonth());
  const monthEnd = date?.to ? iso(date.to) : iso(endOfMonth());
  
  const prevDateStart = date?.from ? new Date(date.from) : startOfMonth();
  if (!date?.from) prevDateStart.setMonth(prevDateStart.getMonth() - 1);
  else {
    const diff = date.to && date.from ? date.to.getTime() - date.from.getTime() : 30 * 86400000;
    prevDateStart.setTime(prevDateStart.getTime() - diff - 86400000);
  }
  const prevStart = iso(prevDateStart);
  
  const prevDateEnd = date?.to ? new Date(date.to) : endOfMonth();
  if (!date?.to) prevDateEnd.setMonth(prevDateEnd.getMonth() - 1);
  else {
    const diff = date.to && date.from ? date.to.getTime() - date.from.getTime() : 30 * 86400000;
    prevDateEnd.setTime(prevDateEnd.getTime() - diff - 86400000);
  }
  const prevEnd = iso(prevDateEnd);

  const today = iso(new Date());
  const in7 = iso(addDays(new Date(), 7));

  /* ---------- profile ---------- */
  const qProfile = useQuery({
    enabled: !!user?.id,
    queryKey: ["mgr", "profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  /* ---------- parallel dashboard queries ---------- */
  const results = useQueries({
    queries: [
      {
        queryKey: ["mgr-dash", "installments-month", monthStart, monthEnd],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("installments")
            .select("amount, extra_fees, paid_amount, status, due_date, payment_date, management_fee_percent, landlord_payout_status, landlord_payout_amount")
            .gte("due_date", monthStart).lte("due_date", monthEnd);
          if (error) throw error;
          return data ?? [];
        },
      },
      {
        queryKey: ["mgr-dash", "installments-prev-month", prevStart, prevEnd],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("installments")
            .select("amount, extra_fees, paid_amount, status, management_fee_percent")
            .gte("due_date", prevStart).lte("due_date", prevEnd);
          if (error) throw error;
          return data ?? [];
        },
      },
      {
        queryKey: ["mgr-dash", "installments-paid-today", today],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("installments").select("paid_amount")
            .eq("payment_date", today);
          if (error) throw error;
          return (data ?? []).reduce((s: number, i: any) => s + Number(i.paid_amount ?? 0), 0);
        },
      },
      {
        queryKey: ["mgr-dash", "installments-overdue", today],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("installments").select("amount, extra_fees, due_date, contract:contracts(id, tenant:tenants(full_name), property:properties(nickname))")
            .neq("status", "pago").lt("due_date", today)
            .order("due_date", { ascending: true }).limit(50);
          if (error) throw error;
          return data ?? [];
        },
      },
      {
        queryKey: ["mgr-dash", "installments-upcoming", today, in7],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("installments").select("id, amount, extra_fees, due_date, status, contract:contracts(id, tenant:tenants(full_name), property:properties(nickname))")
            .neq("status", "pago").gte("due_date", today).lte("due_date", in7)
            .order("due_date", { ascending: true }).limit(20);
          if (error) throw error;
          return data ?? [];
        },
      },
      {
        queryKey: ["mgr-dash", "counts"],
        queryFn: async () => {
          const [contracts, props, tenants, landlords, leads, insp, maint, occupied] = await Promise.all([
            supabase.from("contracts").select("id", { count: "exact", head: true }).eq("active", true).is("deleted_at", null),
            supabase.from("properties").select("id", { count: "exact", head: true }),
            supabase.from("tenants").select("id", { count: "exact", head: true }).is("deleted_at", null),
            supabase.from("landlord_invites").select("id", { count: "exact", head: true }),
            supabase.from("crm_leads").select("id", { count: "exact", head: true }),
            supabase.from("inspections").select("id", { count: "exact", head: true }),
            supabase.from("maintenances").select("id", { count: "exact", head: true }).neq("status", "concluido"),
            supabase.from("contracts").select("property_id").eq("active", true).is("deleted_at", null),
          ]);
          return {
            contracts: contracts.count ?? 0,
            properties: props.count ?? 0,
            tenants: tenants.count ?? 0,
            landlords: landlords.count ?? 0,
            leads: leads.count ?? 0,
            inspections: insp.count ?? 0,
            maintenancesOpen: maint.count ?? 0,
            rented: new Set((occupied.data ?? []).map((r: any) => r.property_id)).size,
          };
        },
      },
      {
        queryKey: ["mgr-dash", "expiring-contracts", today],
        queryFn: async () => {
          const in30 = iso(addDays(new Date(), 30));
          const { data, error } = await supabase
            .from("contracts")
            .select("id, end_date, rent_amount, tenant:tenants(full_name), property:properties(nickname)")
            .eq("active", true).is("deleted_at", null)
            .gte("end_date", today).lte("end_date", in30)
            .order("end_date", { ascending: true }).limit(10);
          if (error) throw error;
          return data ?? [];
        },
      },
      {
        queryKey: ["mgr-dash", "activity"],
        queryFn: async () => {
          const [contracts, paid, maint, leads] = await Promise.all([
            supabase.from("contracts").select("id, created_at, tenant:tenants(full_name), property:properties(nickname)").order("created_at", { ascending: false }).limit(4),
            supabase.from("installments").select("id, paid_amount, payment_date, contract:contracts(tenant:tenants(full_name))").eq("status", "pago").not("payment_date", "is", null).order("payment_date", { ascending: false }).limit(4),
            supabase.from("maintenances").select("id, status, updated_at, description").order("updated_at", { ascending: false }).limit(4),
            supabase.from("crm_leads").select("id, name, created_at, source").order("created_at", { ascending: false }).limit(4),
          ]);
          return {
            contracts: contracts.data ?? [],
            paid: paid.data ?? [],
            maint: maint.data ?? [],
            leads: leads.data ?? [],
          };
        },
      },
      {
        queryKey: ["mgr-dash", "pendencies"],
        queryFn: async () => {
          const [approvals, sigs, inspPending, leadsNew] = await Promise.all([
            supabase.from("maintenances").select("id", { count: "exact", head: true }).eq("budget_status", "pendente"),
            supabase.from("contracts").select("id", { count: "exact", head: true }).is("contract_pdf_path", null).eq("active", true).is("deleted_at", null),
            supabase.from("inspections").select("id", { count: "exact", head: true }).eq("status", "pendente" as any),
            supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("stage", "novo"),
          ]);
          return {
            approvals: approvals.count ?? 0,
            missingSignature: sigs.count ?? 0,
            inspectionsPending: inspPending.count ?? 0,
            leadsNew: leadsNew.count ?? 0,
          };
        },
      },
      {
        queryKey: ["mgr-dash", "chart", monthStart, monthEnd],
        queryFn: async () => {
          const from = new Date(monthStart);
          const to = new Date(monthEnd);
          const { data, error } = await supabase
            .from("installments")
            .select("paid_amount, amount, extra_fees, due_date, payment_date, status, landlord_payout_status, landlord_payout_amount, landlord_payout_date")
            .gte("due_date", iso(from));
          if (error) throw error;
          return { rows: data ?? [], from };
        },
      },
    ],
  });

  const [
    qMonth, qPrev, qPaidToday, qOverdue, qUpcoming, qCounts, qExpiring, qActivity, qPend, qChart,
  ] = results;

  /* ---------- derived KPIs ---------- */
  const kpis = useMemo(() => {
    const rows = (qMonth.data as any[]) ?? [];
    const paid = rows.filter((r) => r.status === "pago").reduce((s, r) => s + Number(r.paid_amount ?? r.amount), 0);
    const toReceive = rows.filter((r) => r.status !== "pago").reduce((s, r) => s + Number(r.amount) + Number(r.extra_fees ?? 0), 0);
    const overdue = ((qOverdue.data as any[]) ?? []).reduce((s, r) => s + Number(r.amount) + Number(r.extra_fees ?? 0), 0);
    const revenue = paid + toReceive;
    const managementFee = rows
      .filter((r) => r.status === "pago")
      .reduce((s, r) => s + Number(r.paid_amount ?? r.amount) * Number(r.management_fee_percent ?? 0) / 100, 0);
    const payoutsPending = rows
      .filter((r) => r.status === "pago" && r.landlord_payout_status !== "repassado")
      .reduce((s, r) => s + Number(r.landlord_payout_amount ?? 0), 0);

    const prev = (qPrev.data as any[]) ?? [];
    const prevPaid = prev.filter(r => r.status === 'pago').reduce((s, r) => s + Number(r.paid_amount ?? r.amount), 0);
    const prevToReceive = prev.filter(r => r.status !== 'pago').reduce((s, r) => s + Number(r.amount) + Number(r.extra_fees ?? 0), 0);
    const prevRevenue = prevPaid + prevToReceive;
    const prevOverdueTotal = prev.filter(r => r.status !== 'pago').reduce((s, r) => s + Number(r.amount) + Number(r.extra_fees ?? 0), 0);
    
    const prevFee = prev.filter(r => r.status === 'pago').reduce((s, r) => s + Number(r.paid_amount ?? r.amount) * Number(r.management_fee_percent ?? 0) / 100, 0);

    const compPaid = calculateComparison(paid, prevPaid);
    const compFee = calculateComparison(managementFee, prevFee);
    const compForecast = calculateComparison(revenue, prevRevenue);
    const compPending = calculateComparison(toReceive, prevToReceive);
    // Inadimplência comparamos o valor total vencido hoje vs valor total vencido ao fim do mês anterior
    const compOverdue = calculateComparison(overdue, prevOverdueTotal, { goodWhenUp: false });

    return {
      paidToday: (qPaidToday.data as number) ?? 0,
      toReceive,
      revenue,
      overdue,
      managementFee,
      payoutsPending,
      paid,
      deltaPaid: compPaid.percentageChange,
      deltaFee: compFee.percentageChange,
      deltaForecast: compForecast.percentageChange,
      deltaPending: compPending.percentageChange,
      deltaOverdue: compOverdue.percentageChange,
      collected: revenue === 0 ? 0 : Math.round((paid / revenue) * 100),
      comparisons: {
        paid: compPaid,
        fee: compFee,
        forecast: compForecast,
        pending: compPending,
        overdue: compOverdue
      }
    };
  }, [qMonth.data, qOverdue.data, qPaidToday.data, qPrev.data]);


  /* ---------- chart series ---------- */
  const chartData = useMemo(() => {
    const raw = (qChart.data as any) ?? { rows: [], from: new Date() };
    const rows: any[] = raw.rows;
    const from: Date = raw.from;
    const days = Math.round((new Date(monthEnd).getTime() - from.getTime()) / 86400000) + 1;
    // Aggregate by day for most ranges; by month for large ranges (> 90 days).
    if (days > 90) {
      const map = new Map<string, { month: string; pago: number; pendente: number; repassado: number }>();
      const now = new Date();
      for (let m = 0; m <= now.getMonth(); m++) {
        const d = new Date(now.getFullYear(), m, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        map.set(key, { month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), pago: 0, pendente: 0, repassado: 0 });
      }
      for (const r of rows) {
        const key = String(r.due_date).slice(0, 7);
        const bucket = map.get(key);
        if (!bucket) continue;
        if (r.status === "pago") bucket.pago += Number(r.paid_amount ?? r.amount);
        else bucket.pendente += Number(r.amount);
        if (r.landlord_payout_status === "repassado") bucket.repassado += Number(r.landlord_payout_amount ?? 0);
      }
      return [...map.values()];
    }
    // daily buckets
    const buckets: Record<string, { month: string; pago: number; pendente: number; repassado: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = addDays(from, i);
      const key = iso(d);
      buckets[key] = { month: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), pago: 0, pendente: 0, repassado: 0 };
    }
    for (const r of rows) {
      const key = String(r.due_date);
      const bucket = buckets[key];
      if (!bucket) continue;
      if (r.status === "pago") bucket.pago += Number(r.paid_amount ?? r.amount);
      else bucket.pendente += Number(r.amount);
      if (r.landlord_payout_status === "repassado") bucket.repassado += Number(r.landlord_payout_amount ?? 0);
    }
    return Object.values(buckets);
  }, [qChart.data, range]);

  /* ---------- realtime ---------- */
  useEffect(() => {
    const ch = supabase.channel("mgr-dash-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "installments" }, () => {
        results.forEach((r) => r.refetch());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts" }, () => results.forEach((r) => r.refetch()))
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenances" }, () => results.forEach((r) => r.refetch()))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameFull = qProfile.data?.full_name || user?.email?.split("@")[0] || "";

  const counts = (qCounts.data as any) ?? {};
  const pendencies = (qPend.data as any) ?? {};
  const upcoming = (qUpcoming.data as any[]) ?? [];
  const overdueList = (qOverdue.data as any[]) ?? [];
  const expiring = (qExpiring.data as any[]) ?? [];
  const activity = (qActivity.data as any) ?? { contracts: [], paid: [], maint: [], leads: [] };

  if (qCounts.isLoading || qMonth.isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-[#F9FAFE] min-h-screen">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="lg:col-span-2 h-[350px] rounded-2xl" />
          <Skeleton className="h-[350px] rounded-2xl" />
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8 bg-[#F9FAFE] min-h-screen">

        {/* ============ Cabeçalho executivo ============ */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1A1A] flex items-center gap-2">
              {greeting()}, {qProfile.data?.full_name?.split(' ')[0] || "Marina"} 👋
            </h1>

            <p className="text-[#6B7280] mt-1 text-sm max-w-2xl">
              Performance operacional: sua carteira liquidou {kpis.collected}% dos repasses previstos. {pendencies.approvals > 0 ? `${pendencies.approvals} manutenções aguardam aprovação.` : "Tudo sob controle no ecossistema hoje."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker date={date} onDateChange={setDate} />
            <div className="flex items-center gap-2 ml-2">
              <div className="bg-[#7C3AED] hover:bg-[#6D28D9] size-10 rounded-xl text-white font-bold grid place-items-center shadow-sm cursor-pointer transition-colors">
                {qProfile.data?.full_name?.charAt(0) || "N"}
              </div>
            </div>
          </div>
        </header>

        {/* ============ Carteira consolidada ============ */}
        <PortfolioSummary
          data={{
            totalProperties: counts.properties ?? 0,
            rentedProperties: counts.rented ?? 0,
            availableProperties: Math.max(0, (counts.properties ?? 0) - (counts.rented ?? 0)),
            activeContracts: counts.contracts ?? 0,
            forecastRevenue: kpis.revenue,
            receivedRevenue: kpis.paid,
            pendingRevenue: kpis.toReceive,
            overdueAmount: kpis.overdue,
            trends: { 
              received: kpis.deltaPaid,
              forecast: kpis.deltaForecast,
              pending: kpis.deltaPending,
              overdue: kpis.deltaOverdue,
            },
          }}
        />

        {/* ============ Grid principal ============ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Faturamento (Bar Chart Style) */}
          <Card className="lg:col-span-2 p-6 flex flex-col gap-4 rounded-2xl border-none shadow-sm h-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A]">Faturamento</h3>
                <p className="text-xs text-[#6B7280]">Repasses processados.</p>
              </div>
              <Badge variant="secondary" className="bg-[#F3F4F6] text-[#6B7280] border-none text-[10px] font-bold">7 MESES</Badge>
            </div>
            <div className="h-40 mt-4">
              <Suspense fallback={<Skeleton className="w-full h-full rounded-lg" />}>
                <DashboardCollectionChart 
                  data={chartData} 
                />
              </Suspense>
            </div>
          </Card>

          {/* Atividade (Recent Activity) */}
          <Card className="p-6 flex flex-col gap-4 rounded-2xl border-none shadow-sm h-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A]">Atividade</h3>
                <p className="text-xs text-[#6B7280]">Fluxo de ações.</p>
              </div>
              <Badge variant="secondary" className="bg-[#F3F4F6] text-[#6B7280] border-none text-[10px] font-bold uppercase tracking-wider">Hoje</Badge>
            </div>
            <div className="space-y-4 mt-2">
              {activity.paid.length === 0 && activity.contracts.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">Nenhuma atividade recente encontrada.</p>
              )}
              {activity.paid.slice(0, 2).map((p: any, idx: number) => (
                <div key={`paid-${idx}`} className="flex gap-3">
                  <div className="size-8 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0"><CheckCircle2 className="size-4" /></div>
                  <div>
                    <div className="text-xs font-bold text-[#1A1A1A]">{p.contract?.tenant?.full_name} pagou o aluguel</div>
                    <div className="text-[10px] text-[#9CA3AF]">Pagamento repassado — {formatDate(p.payment_date)}</div>
                  </div>
                </div>
              ))}
              {activity.contracts.slice(0, 2).map((c: any, idx: number) => (
                <div key={`contract-${idx}`} className="flex gap-3">
                  <div className="size-8 rounded-full bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center shrink-0"><PlusCircleIcon className="size-4" /></div>
                  <div>
                    <div className="text-xs font-bold text-[#1A1A1A]">Novo contrato assinado</div>
                    <div className="text-[10px] text-[#9CA3AF]">{c.property?.nickname} — {formatDate(c.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Carteira - próximos vencimentos (Large Table Card) */}
          <Card className="lg:col-span-3 p-6 rounded-2xl border-none shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#1A1A1A]">Carteira · próximos vencimentos</h3>
                <p className="text-sm text-[#6B7280]">Listagem de recebimentos futuros.</p>
              </div>
              <Badge className="bg-[#F5F3FF] text-[#7C3AED] hover:bg-[#F5F3FF] border-none font-bold text-xs px-3 py-1">{counts.contracts || 0} CONTRATOS</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-[#9CA3AF] border-b border-[#F3F4F6]">
                    <th className="pb-3 font-bold">Imóvel</th>
                    <th className="pb-3 font-bold">Inquilino</th>
                    <th className="pb-3 font-bold text-right pr-12">Vencimento</th>
                    <th className="pb-3 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {((overdueList.length > 0 ? overdueList : upcoming).slice(0, 4) as any[]).map((i: any, idx) => (
                    <tr key={idx} className="group hover:bg-[#F9FAFE] transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center shrink-0"><HomeIcon className="size-4" /></div>
                          <div>
                            <div className="text-sm font-bold text-[#1A1A1A]">{i.contract?.property?.nickname}</div>
                            <div className="text-[10px] text-[#9CA3AF]">Contrato {i.contract?.id?.slice(0, 8).toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-lg bg-[#7C3AED] text-white text-[10px] font-bold grid place-items-center">{(i.contract?.tenant?.full_name || "T").charAt(0)}</div>
                          <span className="text-sm text-[#374151] font-medium">{i.contract?.tenant?.full_name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right pr-12">
                        <div className="text-sm font-bold text-[#1A1A1A]">{formatBRL(Number(i.amount ?? 0) + Number(i.extra_fees ?? 0))}</div>
                        <div className="text-[10px] text-[#9CA3AF]">{formatDate(i.due_date)}</div>
                      </td>
                      <td className="py-4 text-right">
                        <Badge className={cn(
                          "rounded-full border-none text-[10px] font-bold px-3 py-1",
                          i.status === "pago" ? "bg-[#ECFDF5] text-[#10B981]" : 
                          new Date(i.due_date) < new Date() ? "bg-[#FEF2F2] text-[#EF4444]" : 
                          "bg-[#FFF7ED] text-[#F97316]"
                        )}>
                          • {i.status === "pago" ? "Pago — split ok" : new Date(i.due_date) < new Date() ? "Atrasado" : "Aguardando Pix"}
                        </Badge>

                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-center pt-2">
              <p className="text-[10px] text-[#D1D5DB] font-medium italic">Plataforma sistema em operação · ambiente de alta performance</p>
            </div>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function Kpi({
  title, value, icon, loading, accent, delta, negative, goodWhenUp = true, tooltip
}: {
  title: string; value: string | number; icon: React.ReactNode; loading?: boolean;
  accent?: boolean; delta?: number; negative?: boolean; goodWhenUp?: boolean; tooltip?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className={cn("p-4 flex flex-col gap-2 relative overflow-hidden group transition-all hover:shadow-md", accent && "border-primary/50 bg-primary/5")}>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] uppercase font-bold tracking-wider truncate pr-2">{title}</span>
            <div className={cn("p-1.5 rounded-lg transition-colors", accent ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary")}>
              {icon}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <span className="text-xl font-bold tracking-tight">{value}</span>
            )}
            {!loading && delta !== undefined && (
              <div className={cn(
                "flex items-center text-[10px] font-bold",
                (delta > 0 === goodWhenUp) ? "text-emerald-500" : "text-destructive"
              )}>
                {delta > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {Math.abs(delta)}%
              </div>
            )}
          </div>
        </Card>
      </TooltipTrigger>
      {tooltip && <TooltipContent side="bottom" className="max-w-xs">{tooltip}</TooltipContent>}
    </Tooltip>
  );
}

function Shortcut({

  to, icon: Icon, label, search,
}: { to: string; icon: any; label: string; search?: Record<string, string> }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to={to} search={search as any} className="group flex flex-col items-center gap-2">
          <div className="relative size-12 rounded-xl border border-border bg-card grid place-items-center transition-all group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-md group-active:scale-95">
            <Icon className="size-5 text-foreground group-hover:text-primary transition-colors" strokeWidth={1.6} />
          </div>
          <span className="text-[10.5px] text-muted-foreground group-hover:text-foreground text-center leading-tight transition-colors">
            {label}
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function DueRow({ item, overdue }: { item: any; overdue?: boolean }) {
  const total = Number(item.amount ?? 0) + Number(item.extra_fees ?? 0);
  const name = item.contract?.tenant?.full_name ?? "—";
  const prop = item.contract?.property?.nickname ?? "";
  return (
    <div className="px-5 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition">
      <div className={cn("size-1.5 rounded-full shrink-0", overdue ? "bg-destructive" : "bg-primary")} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate">{name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{prop}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold tabular-nums">{formatBRLCompact(total)}</div>
        <div className={cn("text-[11px]", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
          {overdue ? "Venceu em " : ""}{formatDate(item.due_date)}
        </div>
      </div>
    </div>
  );
}

function PendRow({ label, value, to, tone }: { label: string; value: number; to: string; tone?: "primary" | "destructive" }) {
  const hasValue = (value ?? 0) > 0;
  return (
    <Link to={to} className={cn(
      "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition",
      hasValue ? "hover:bg-muted/60" : "opacity-60 hover:opacity-100",
    )}>
      <span className="truncate">{label}</span>
      <Badge
        variant={hasValue ? (tone === "destructive" ? "destructive" : tone === "primary" ? "default" : "secondary") : "outline"}
        className="tabular-nums shrink-0"
      >
        {value ?? 0}
      </Badge>
    </Link>
  );
}

function MiniStat({ label, value, icon, to }: { label: string; value: number | undefined; icon: React.ReactNode; to: string }) {
  return (
    <Link to={to} className="bg-card p-3.5 flex flex-col gap-1 hover:bg-muted/40 transition">
      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{icon}{label}</span>
      <span className="text-lg font-bold tabular-nums">{value ?? 0}</span>
    </Link>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-5 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-6 text-center text-xs text-muted-foreground">{text}</div>;
}

function buildActivity(a: { contracts: any[]; paid: any[]; maint: any[]; leads: any[] }) {
  const items: { text: string; at: string; color: string }[] = [];
  a.paid.forEach((r) => items.push({
    text: `Pagamento recebido de ${r.contract?.tenant?.full_name ?? "—"} — ${formatBRL(Number(r.paid_amount ?? 0))}`,
    at: r.payment_date, color: "bg-emerald-500",
  }));
  a.contracts.forEach((r) => items.push({
    text: `Contrato criado — ${r.tenant?.full_name ?? "—"}${r.property?.nickname ? ` (${r.property.nickname})` : ""}`,
    at: r.created_at, color: "bg-primary",
  }));
  a.maint.forEach((r) => items.push({
    text: `Manutenção ${r.status === "concluido" ? "concluída" : r.status === "em_andamento" ? "em andamento" : "aberta"}${r.description ? `: ${r.description.slice(0, 60)}` : ""}`,
    at: r.updated_at, color: "bg-amber-500",
  }));
  a.leads.forEach((r) => items.push({
    text: `Novo lead: ${r.name}${r.source ? ` — ${r.source}` : ""}`,
    at: r.created_at, color: "bg-blue-500",
  }));
  return items
    .filter((x) => x.at)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}
