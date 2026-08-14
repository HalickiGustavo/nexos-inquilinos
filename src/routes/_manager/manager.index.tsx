import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, ArrowRight, AlertTriangle, Bell, Building2, Calendar,
  ClipboardCheck, FilePlus, FileSearch, Inbox, Home as HomeIcon, KeyRound, Users,
  Wallet, Coins, TrendingUp, CheckCircle2, CircleDollarSign, PlusCircle,
  UserPlus, Database, Info, HelpCircle, MessageSquare, AlertCircle, PlusCircle as PlusCircleIcon
} from "lucide-react";
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
  const [range, setRange] = useState<RangeKey>("30d");

  const monthStart = iso(startOfMonth());
  const monthEnd = iso(endOfMonth());
  const prevMonth = new Date(); prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevStart = iso(startOfMonth(prevMonth));
  const prevEnd = iso(endOfMonth(prevMonth));
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
            .select("paid_amount, status, management_fee_percent")
            .gte("due_date", prevStart).lte("due_date", prevEnd)
            .eq("status", "pago");
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
        queryKey: ["mgr-dash", "chart", range],
        queryFn: async () => {
          const from = new Date();
          if (range === "7d") from.setDate(from.getDate() - 6);
          else if (range === "30d") from.setDate(from.getDate() - 29);
          else if (range === "90d") from.setDate(from.getDate() - 89);
          else { from.setMonth(0); from.setDate(1); }
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
    const prevPaid = prev.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0);
    const prevFee = prev.reduce((s, r) => s + Number(r.paid_amount ?? 0) * Number(r.management_fee_percent ?? 0) / 100, 0);

    // Adicionando comparativos estendidos
    const compPaid = calculateComparison(paid, prevPaid);
    const compFee = calculateComparison(managementFee, prevFee);
    
    // Para receita prevista, receita pendente e inadimplência (overdue), 
    // idealmente teríamos os dados históricos do período anterior completo.
    // Como qPrev só traz installments pagos no momento, as variações de pendência e inadimplência
    // dependem de uma query mais ampla do período anterior que inclua não pagos.
    // Para esta etapa, vamos focar no que temos dados: Recebido e Taxa Nexo.

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
      // Placeholders para os outros enquanto não expandimos as queries
      deltaForecast: null,
      deltaPending: null,
      deltaOverdue: null,
      collected: revenue === 0 ? 0 : Math.round((paid / revenue) * 100),
      comparisons: {
        paid: compPaid,
        fee: compFee,
      }
    };
  }, [qMonth.data, qOverdue.data, qPaidToday.data, qPrev.data]);


  /* ---------- chart series ---------- */
  const chartData = useMemo(() => {
    const raw = (qChart.data as any) ?? { rows: [], from: new Date() };
    const rows: any[] = raw.rows;
    const from: Date = raw.from;
    const days = Math.round((Date.now() - from.getTime()) / 86400000) + 1;
    // Aggregate by day for 7/30/90; by month for year.
    if (range === "ano") {
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
  const firstName = nameFull.split(" ")[0];

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
              {greeting()}, {firstName || "Marina"} 👋






            </h1>
            <p className="text-[#6B7280] mt-1 text-sm max-w-2xl">
              Sua carteira liquidou 87% dos repasses de hoje. Três pagamentos aguardam confirmação PIX.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-[#374151] shadow-sm">
              <Calendar className="size-4 text-[#9CA3AF]" />
              {new Date().toLocaleDateString("pt-BR", { weekday: 'short', day: '2-digit', month: 'long' })}
            </div>
            <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl px-4 py-2 h-auto text-sm font-semibold shadow-sm flex items-center gap-2">
              <PlusCircleIcon className="size-4" /> Nova cobrança
            </Button>
            <div className="flex items-center gap-2 ml-2">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-[#1A1A1A] leading-tight">{firstName || "Marina"} Alves</div>
                <div className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider leading-tight">Imobiliária Aurora</div>
              </div>
              <div className="bg-[#7C3AED] hover:bg-[#6D28D9] size-10 rounded-xl text-white font-bold grid place-items-center shadow-sm cursor-pointer transition-colors">
                {firstName?.charAt(0) || "M"}
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
        <div className="grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-2 gap-6">
          {/* Split Automático do Aluguel (Bento Card Style) */}
          <Card className="lg:col-span-2 p-6 flex flex-col gap-6 rounded-2xl border-none shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A]">Split automático do aluguel</h3>
                <p className="text-xs text-[#6B7280]">Cada aluguel recebido é dividido e repassado sozinho, em três vias.</p>
              </div>
              <Badge className="bg-[#F5F3FF] text-[#7C3AED] hover:bg-[#F5F3FF] border-none font-bold text-[10px] uppercase tracking-wider">PIX - Tempo Real</Badge>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 items-center">
                <div className="w-full sm:w-1/3 p-6 rounded-2xl bg-[#F5F3FF] flex flex-col items-center justify-center text-center gap-2 border border-[#7C3AED]/10 shadow-inner">
                  <div className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-widest">Recebido Médio</div>
                  <div className="text-2xl font-black text-[#1A1A1A]">{formatBRLCompact(kpis.revenue / (counts.contracts || 1))}</div>

                <div className="size-8 rounded-lg bg-white shadow-sm flex items-center justify-center mt-2">
                  <div className="size-4 grid grid-cols-2 gap-0.5">
                    <div className="bg-[#7C3AED] rounded-[1px]" />
                    <div className="bg-[#7C3AED] rounded-[1px]" />
                    <div className="bg-[#7C3AED] rounded-[1px]" />
                    <div className="bg-[#7C3AED] rounded-[1px]" />
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#F3F4F6] hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center"><HomeIcon className="size-4" /></div>
                    <div>
                      <div className="text-sm font-bold text-[#1A1A1A]">Proprietário</div>
                      <div className="text-[10px] text-[#9CA3AF]">João Meireles — chave CPF</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#1A1A1A]">{formatBRL(kpis.paid * 0.9)}</div>
                    <div className="text-[10px] text-[#9CA3AF]">Estimado (90%)</div>

                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#F3F4F6] hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center"><Building2 className="size-4" /></div>
                    <div>
                      <div className="text-sm font-bold text-[#1A1A1A]">Imobiliária</div>
                      <div className="text-[10px] text-[#9CA3AF]">Aurora — taxa 10% administração</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#1A1A1A]">{formatBRL(kpis.managementFee)}</div>
                    <div className="text-[10px] text-[#9CA3AF]">Taxa de adm</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#F3F4F6] hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-[#F9FAFE] text-[#9CA3AF] flex items-center justify-center"><NexoLogo className="h-3" /></div>
                    <div>
                      <div className="text-sm font-bold text-[#1A1A1A]">Nexo</div>
                      <div className="text-[10px] text-[#9CA3AF]">Taxa de plataforma</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#1A1A1A]">{formatBRL(counts.contracts * 24.99)}</div>
                    <div className="text-[10px] text-[#9CA3AF]">Fixa plataforma</div>
                  </div>

                </div>
              </div>
            </div>
          </Card>

          {/* Faturamento (Bar Chart Style) */}
          <Card className="p-6 flex flex-col gap-4 rounded-2xl border-none shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A]">Faturamento</h3>
                <p className="text-xs text-[#6B7280]">Repasses processados.</p>
              </div>
              <Badge variant="secondary" className="bg-[#F3F4F6] text-[#6B7280] border-none text-[10px] font-bold">7 MESES</Badge>
            </div>
            <div className="h-40 mt-4 flex items-end justify-between gap-2 px-2">
              {/* Mock bar chart to match photo look */}
              {[40, 60, 45, 80, 50, 90, 85].map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div 
                    className={cn(
                      "w-full rounded-t-md transition-all", 
                      i === 6 ? "bg-[#7C3AED]" : "bg-[#A78BFA]/40"
                    )} 
                    style={{ height: `${h}px` }} 
                  />
                  <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">{['Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'][i]}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Atividade (Recent Activity) */}
          <Card className="p-6 flex flex-col gap-4 rounded-2xl border-none shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A]">Atividade</h3>
                <p className="text-xs text-[#6B7280]">Fluxo de ações.</p>
              </div>
              <Badge variant="secondary" className="bg-[#F3F4F6] text-[#6B7280] border-none text-[10px] font-bold uppercase tracking-wider">Hoje</Badge>
            </div>
            <div className="space-y-4 mt-2">
              <div className="flex gap-3">
                <div className="size-8 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0"><CheckCircle2 className="size-4" /></div>
                <div>
                  <div className="text-xs font-bold text-[#1A1A1A]">Camila Rocha pagou o aluguel</div>
                  <div className="text-[10px] text-[#9CA3AF]">Split repassado — há 12 min</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="size-8 rounded-full bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center shrink-0"><PlusCircleIcon className="size-4" /></div>
                <div>
                  <div className="text-xs font-bold text-[#1A1A1A]">Novo contrato C-2310 assinado</div>
                  <div className="text-[10px] text-[#9CA3AF]">Alameda dos Ipês — há 1h</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="size-8 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0"><AlertCircle className="size-4" /></div>
                <div>
                  <div className="text-xs font-bold text-[#1A1A1A]">Cobrança C-2054 venceu</div>
                  <div className="text-[10px] text-[#9CA3AF]">Letícia Prado — há 3 dias</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="size-8 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center shrink-0"><MessageSquare className="size-4" /></div>
                <div>
                  <div className="text-xs font-bold text-[#1A1A1A]">Nova mensagem de Bruno Tavares</div>
                  <div className="text-[10px] text-[#9CA3AF]">Manutenção — há 4 h</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Carteira - próximos vencimentos (Large Table Card) */}
          <Card className="lg:col-span-4 p-6 rounded-2xl border-none shadow-sm space-y-6">
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
                            <div className="text-sm font-bold text-[#1A1A1A]">{i.contract?.property?.nickname || "Ed. Solar - apt 704"}</div>
                            <div className="text-[10px] text-[#9CA3AF]">Contrato C-{2291 - idx}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-lg bg-[#7C3AED] text-white text-[10px] font-bold grid place-items-center">{(i.contract?.tenant?.full_name || "Camila Rocha").charAt(0)}</div>
                          <span className="text-sm text-[#374151] font-medium">{i.contract?.tenant?.full_name || "Camila Rocha"}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right pr-12">
                        <div className="text-sm font-bold text-[#1A1A1A]">{formatBRL(Number(i.amount ?? 0) + Number(i.extra_fees ?? 0))}</div>
                        <div className="text-[10px] text-[#9CA3AF]">{idx === 0 ? "10 ago" : idx === 1 ? "12 ago" : idx === 2 ? "Ontem" : "Há 2 dias"}</div>
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
              <p className="text-[10px] text-[#D1D5DB] font-medium italic">Protótipo <span className="text-[#7C3AED] font-bold">NEXO v2.0</span> · dados ilustrativos · direção visual para apresentação</p>
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
