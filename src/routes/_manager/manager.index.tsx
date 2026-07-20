import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, ArrowRight, AlertTriangle, Bell, Building2, Calendar,
  ClipboardCheck, FilePlus, FileSearch, Inbox, Home as HomeIcon, KeyRound, Users,
  Wallet, Wrench, Coins, TrendingUp, CheckCircle2, CircleDollarSign, PlusCircle,
  UserPlus, Database,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL, formatBRLCompact, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

    const delta = (curr: number, base: number) => base === 0 ? null : Math.round(((curr - base) / base) * 100);

    return {
      paidToday: (qPaidToday.data as number) ?? 0,
      toReceive,
      revenue,
      overdue,
      managementFee,
      payoutsPending,
      paid,
      deltaPaid: delta(paid, prevPaid),
      deltaFee: delta(managementFee, prevFee),
      collected: revenue === 0 ? 0 : Math.round((paid / revenue) * 100),
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

  const heroBullets = [
    { label: "contratos ativos", value: counts.contracts, to: "/manager/carteira" },
    { label: "cobranças pendentes", value: (qMonth.data as any[] ?? []).filter((r: any) => r.status !== "pago").length, to: "/manager/financeiro" },
    { label: "manutenções abertas", value: counts.maintenancesOpen, to: "/manager/vistorias" },
    { label: "contratos vencendo (30d)", value: expiring.length, to: "/manager/carteira" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
        {/* ============ HERO ============ */}
        <section
          className="relative overflow-hidden rounded-2xl border border-primary/25 p-5 sm:p-6"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--primary) 30%, transparent) 0%, color-mix(in oklab, var(--primary) 12%, transparent) 45%, transparent 90%)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {greeting()}, {firstName || "gestor"} <span aria-hidden>👋</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pendencies.approvals > 0 && (
                <Link to="/maintenances" className="inline-flex items-center gap-2 rounded-full bg-primary/15 border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition">
                  <Bell className="size-3.5" /> {pendencies.approvals} aprovação{pendencies.approvals > 1 ? "ões" : ""} pendente{pendencies.approvals > 1 ? "s" : ""}
                </Link>
              )}
              {kpis.overdue > 0 && (
                <Link to="/manager/financeiro" className="inline-flex items-center gap-2 rounded-full bg-destructive/15 border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25 transition">
                  <AlertTriangle className="size-3.5" /> {formatBRLCompact(kpis.overdue)} em atraso
                </Link>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {heroBullets.map((b) => (
              <Link key={b.label} to={b.to} className="group inline-flex items-baseline gap-1.5 text-muted-foreground hover:text-foreground transition">
                <span className="text-base font-bold text-foreground tabular-nums">{qCounts.isLoading ? "—" : (b.value ?? 0)}</span>
                <span>{b.label}</span>
                <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition" />
              </Link>
            ))}
          </div>
        </section>

        {/* ============ KPIs ============ */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi title="Recebido hoje" value={formatBRL(kpis.paidToday)} icon={<CheckCircle2 className="size-4" />} loading={qPaidToday.isLoading} accent />
          <Kpi title="A receber (mês)" value={formatBRL(kpis.toReceive)} icon={<Wallet className="size-4" />} loading={qMonth.isLoading} />
          <Kpi title="Receita do mês" value={formatBRL(kpis.revenue)} icon={<TrendingUp className="size-4" />} loading={qMonth.isLoading} delta={kpis.deltaPaid} />
          <Kpi title="Em atraso" value={formatBRL(kpis.overdue)} icon={<AlertTriangle className="size-4" />} loading={qOverdue.isLoading} negative={kpis.overdue > 0} />
          <Kpi title="Taxa NEXO" value={formatBRL(kpis.managementFee)} icon={<Coins className="size-4" />} loading={qMonth.isLoading} delta={kpis.deltaFee} />
          <Kpi title="Repasses pendentes" value={formatBRL(kpis.payoutsPending)} icon={<CircleDollarSign className="size-4" />} loading={qMonth.isLoading} />
        </section>

        {/* ============ Atalhos rápidos ============ */}
        <section>
          <SectionHeader title="Atalhos rápidos" />
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-3">
            <Shortcut to="/manager/carteira" search={{ novo: "contrato" }} icon={FilePlus} label="Novo contrato" />
            <Shortcut to="/manager/carteira" search={{ novo: "imovel" }} icon={Building2} label="Novo imóvel" />
            <Shortcut to="/manager/financeiro" search={{ novo: "cobranca" }} icon={PlusCircle} label="Nova cobrança" />
            <Shortcut to="/manager/vistorias" search={{ novo: "1" }} icon={FileSearch} label="Nova vistoria" />
            
            <Shortcut to="/manager/proprietarios" search={{ novo: "1" }} icon={HomeIcon} label="Proprietário" />
            <Shortcut to="/manager/inquilinos" search={{ novo: "1" }} icon={KeyRound} label="Inquilino" />
            <Shortcut to="/manager/leads" search={{ novo: "1" }} icon={Inbox} label="Novo lead" />
            <Shortcut to="/manager/equipe" search={{ novo: "1" }} icon={UserPlus} label="Membro" />
            <Shortcut to="/manager/migrar-dados" icon={Database} label="Importar" />
          </div>
        </section>

        {/* ============ Grid principal ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* --- coluna esquerda --- */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <div className="p-5 pb-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold">Fluxo financeiro</h3>
                  <p className="text-xs text-muted-foreground">Recebimentos, pendências e repasses</p>
                </div>
                <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
                  {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setRange(k)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] rounded-md transition",
                        range === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {RANGE_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-3 pb-4 h-64">
                {qChart.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <Suspense fallback={<Skeleton className="h-full w-full" />}>
                    <DashboardCollectionChart data={chartData} />
                  </Suspense>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-5 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" /> Próximos vencimentos
                  </h3>
                  <p className="text-xs text-muted-foreground">Próximos 7 dias + atrasos</p>
                </div>
                <Link to="/manager/financeiro" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  Ver tudo <ArrowRight className="size-3" />
                </Link>
              </div>
              <div className="divide-y divide-border/60">
                {qUpcoming.isLoading ? (
                  <ListSkeleton />
                ) : overdueList.length === 0 && upcoming.length === 0 ? (
                  <Empty text="Nenhum vencimento próximo. Tudo em dia por aqui." />
                ) : (
                  <>
                    {overdueList.slice(0, 4).map((i: any) => (
                      <DueRow key={i.id ?? `${i.due_date}-${i.contract?.id}`} item={i} overdue />
                    ))}
                    {upcoming.slice(0, 6).map((i: any) => (
                      <DueRow key={i.id} item={i} />
                    ))}
                  </>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-5 pb-3">
                <h3 className="text-sm font-semibold">Atividade recente</h3>
                <p className="text-xs text-muted-foreground">Últimos eventos do sistema</p>
              </div>
              <ol className="p-4 pt-1 space-y-3">
                {qActivity.isLoading ? (
                  <ListSkeleton rows={5} />
                ) : (
                  buildActivity(activity).slice(0, 8).map((ev, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <span className={cn("mt-1 size-1.5 rounded-full shrink-0", ev.color)} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{ev.text}</div>
                        <div className="text-[11px] text-muted-foreground">{formatDate(ev.at)}</div>
                      </div>
                    </li>
                  ))
                )}
                {!qActivity.isLoading && buildActivity(activity).length === 0 && <Empty text="Sem atividades recentes." />}
              </ol>
            </Card>
          </div>

          {/* --- coluna direita --- */}
          <div className="space-y-4">
            <Card>
              <div className="p-5 pb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-primary" /> Pendências
                </h3>
                <p className="text-xs text-muted-foreground">Tarefas que exigem sua atenção</p>
              </div>
              <div className="p-2 space-y-1">
                <PendRow to="/manager/financeiro" label="Boletos vencidos" value={overdueList.length} tone="destructive" />
                <PendRow to="/maintenances" label="Aprovações de orçamento" value={pendencies.approvals} tone="primary" />
                <PendRow to="/manager/carteira" label="Contratos sem PDF assinado" value={pendencies.missingSignature} />
                <PendRow to="/manager/vistorias" label="Vistorias pendentes" value={pendencies.inspectionsPending} />
                <PendRow to="/manager/leads" label="Leads sem atendimento" value={pendencies.leadsNew} tone="primary" />
                <PendRow to="/manager/carteira" label="Contratos vencendo (30d)" value={expiring.length} />
              </div>
            </Card>

            <Card>
              <div className="p-5 pb-3">
                <h3 className="text-sm font-semibold">Panorama operacional</h3>
                <p className="text-xs text-muted-foreground">Números da carteira</p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border/60 rounded-b-xl overflow-hidden">
                <MiniStat icon={<Building2 className="size-3.5" />} label="Imóveis" value={counts.properties} to="/manager/carteira" />
                <MiniStat icon={<CheckCircle2 className="size-3.5" />} label="Alugados" value={counts.rented} to="/manager/carteira" />
                <MiniStat icon={<HomeIcon className="size-3.5" />} label="Proprietários" value={counts.landlords} to="/manager/proprietarios" />
                <MiniStat icon={<KeyRound className="size-3.5" />} label="Inquilinos" value={counts.tenants} to="/manager/inquilinos" />
                <MiniStat icon={<Inbox className="size-3.5" />} label="Leads" value={counts.leads} to="/manager/leads" />
                <MiniStat icon={<ClipboardCheck className="size-3.5" />} label="Vistorias" value={counts.inspections} to="/manager/vistorias" />
              </div>
            </Card>

            <Card>
              <div className="p-5 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Progresso do mês</h3>
                  <p className="text-xs text-muted-foreground">Recebido vs previsto</p>
                </div>
                <span className="text-lg font-bold text-primary tabular-nums">{kpis.collected}%</span>
              </div>
              <div className="px-5 pb-5">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${kpis.collected}%` }} />
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Recebido</span><span className="font-medium tabular-nums">{formatBRL(kpis.paid)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">A receber</span><span className="font-medium tabular-nums">{formatBRL(kpis.toReceive)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Previsto total</span><span className="font-medium tabular-nums">{formatBRL(kpis.revenue)}</span></div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}

/* ---------- subcomponents ---------- */
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>{children}</div>
  );
}

function Kpi({
  title, value, icon, loading, delta, accent, negative,
}: {
  title: string; value: string; icon?: React.ReactNode; loading?: boolean;
  delta?: number | null; accent?: boolean; negative?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-3.5 relative overflow-hidden transition hover:border-primary/40",
      accent ? "border-primary/30" : "border-border",
    )}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] uppercase tracking-wide font-medium">{title}</span>
        <span className={cn(negative && kpiValueNumber(value) > 0 ? "text-destructive" : accent ? "text-primary" : "")}>{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-24" />
      ) : (
        <div className={cn("mt-1.5 text-xl font-bold tabular-nums tracking-tight", negative && kpiValueNumber(value) > 0 ? "text-destructive" : "")}>
          {value}
        </div>
      )}
      {typeof delta === "number" && (
        <div className={cn(
          "mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium",
          delta >= 0 ? "text-emerald-500" : "text-destructive",
        )}>
          {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(delta)}% vs mês anterior
        </div>
      )}
    </div>
  );
}

function kpiValueNumber(v: string) {
  const n = Number(v.replace(/[^0-9,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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
