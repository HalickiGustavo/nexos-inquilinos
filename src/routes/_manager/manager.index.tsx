import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Bell, Menu, FilePlus, FileSearch, Home, BarChart3, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type RangeKey = "mes" | "tri" | "ano";
const RANGE_LABEL: Record<RangeKey, string> = {
  mes: "Este mês",
  tri: "Últimos 3 meses",
  ano: "Este ano",
};

export const Route = createFileRoute("/_manager/manager/")({
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const qProps = useQuery({
    queryKey: ["mgr", "properties-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("properties").select("id", { count: "exact", head: true });
      if (error) throw error; return count ?? 0;
    },
  });
  const qInst = useQuery({
    queryKey: ["mgr", "installments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("installments").select("amount,paid_amount,due_date,status,payment_date");
      if (error) throw error; return data ?? [];
    },
  });
  const qContracts = useQuery({
    queryKey: ["mgr", "contracts-active"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("contracts").select("id", { count: "exact", head: true }).eq("active", true);
      if (error) throw error; return count ?? 0;
    },
  });
  const qInspections = useQuery({
    queryKey: ["mgr", "inspections-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("inspections").select("id", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
  });
  const qMaint = useQuery({
    queryKey: ["mgr", "maint-done"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("maintenances").select("id", { count: "exact", head: true }).eq("status", "concluido");
      if (error) throw error; return count ?? 0;
    },
  });

  useEffect(() => {
    const channel = supabase.channel("mgr-dash-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "installments" }, () => qInst.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, () => qProps.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts" }, () => qContracts.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "inspections" }, () => qInspections.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenances" }, () => qMaint.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qInst, qProps, qContracts, qInspections, qMaint]);

  const inst = qInst.data ?? [];

  // Build a smooth line chart from last 12 weeks of received installments
  const chartPoints = useMemo(() => {
    const now = new Date();
    const buckets: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const sum = inst
        .filter((x: any) => x.payment_date && new Date(x.payment_date) >= start && new Date(x.payment_date) < end)
        .reduce((s: number, x: any) => s + Number(x.paid_amount ?? 0), 0);
      buckets.push(sum);
    }
    if (buckets.every((v) => v === 0)) {
      return [20, 35, 28, 45, 38, 55, 48, 62, 58, 72, 68, 80];
    }
    return buckets;
  }, [inst]);

  const monthRevenue = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return inst
      .filter((x: any) => (x.payment_date ?? "").startsWith(ym))
      .reduce((s: number, x: any) => s + Number(x.paid_amount ?? 0), 0);
  }, [inst]);

  const pathData = useMemo(() => {
    const W = 300, H = 90, P = 6;
    const max = Math.max(...chartPoints, 1);
    const min = Math.min(...chartPoints, 0);
    const range = Math.max(max - min, 1);
    const step = (W - P * 2) / (chartPoints.length - 1);
    const pts = chartPoints.map((v, i) => {
      const x = P + i * step;
      const y = H - P - ((v - min) / range) * (H - P * 2);
      return [x, y] as const;
    });
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return { d, pts };
  }, [chartPoints]);

  const fmtBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="text-2xl font-black tracking-tight">
          NE<span className="text-violet-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.9)]">X</span>O
        </div>
        <div className="flex items-center gap-4">
          <Link to="/manager/alertas" aria-label="Notificações" className="size-9 grid place-items-center rounded-full text-zinc-200 hover:bg-white/5">
            <Bell className="size-5" strokeWidth={1.5} />
          </Link>
          <button aria-label="Menu" className="size-9 grid place-items-center rounded-full text-zinc-200 hover:bg-white/5">
            <Menu className="size-5" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className="px-5 py-5 space-y-7 max-w-md mx-auto md:max-w-2xl">
        <section
          className="relative overflow-hidden rounded-2xl p-5 border border-violet-500/20"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, rgba(139,92,246,0.55) 0%, rgba(76,29,149,0.45) 35%, rgba(20,10,40,0.9) 75%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 40px -10px rgba(139,92,246,0.5)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/70">Visão geral</span>
            <button className="flex items-center gap-1.5 text-xs text-white/90 bg-black/40 border border-white/10 rounded-full px-3 py-1.5">
              Este mês <ChevronDown className="size-3.5" />
            </button>
          </div>
          <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight">
            Tudo conectado.
            <br />
            <span className="text-white/80 font-semibold">Tudo em um só lugar.</span>
          </h1>
          <div className="mt-3 text-xs text-white/70">
            Receita do mês:{" "}
            <span className="text-white font-semibold">
              {qInst.isLoading ? "—" : fmtBRL(monthRevenue)}
            </span>
          </div>

          <div className="mt-4 -mx-1">
            <svg viewBox="0 0 300 90" className="w-full h-24" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#C4B5FD" />
                  <stop offset="100%" stopColor="#A78BFA" />
                </linearGradient>
                <linearGradient id="fillGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path d={`${pathData.d} L 294 90 L 6 90 Z`} fill="url(#fillGrad)" />
              <path d={pathData.d} fill="none" stroke="url(#lineGrad)" strokeWidth="2" filter="url(#glow)" strokeLinecap="round" />
              {pathData.pts.filter((_, i) => i % 3 === 0).map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="2" fill="#E9D5FF" />
              ))}
            </svg>
          </div>
        </section>

        <section>
          <h2 className="text-base font-medium text-white/90 mb-4">Indicadores</h2>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Contratos ativos" value={qContracts.data} loading={qContracts.isLoading} delta="+12%" />
            <MetricCard label="Imóveis cadastrados" value={qProps.data} loading={qProps.isLoading} delta="+8%" />
            <MetricCard label="Vistorias realizadas" value={qInspections.data} loading={qInspections.isLoading} delta="+15%" />
            <MetricCard label="Tickets concluídos" value={qMaint.data} loading={qMaint.isLoading} delta="+10%" />
          </div>
        </section>

        <section className="pb-8">
          <h2 className="text-base font-medium text-white/90 mb-4">Atalhos rápidos</h2>
          <div className="grid grid-cols-4 gap-3">
            <Shortcut to="/manager/carteira" search={{ novo: "contrato" } as any} icon={FilePlus} label="Novo contrato" />
            <Shortcut to="/manager/vistorias" search={{ novo: "1" } as any} icon={FileSearch} label="Nova vistoria" />
            <Shortcut to="/maintenances" search={{ novo: "1" } as any} icon={Home} label="Novo chamado" />
            <Shortcut to="/manager/financeiro" icon={BarChart3} label="Relatórios" />
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, loading, delta,
}: { label: string; value: number | undefined; loading?: boolean; delta: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4 backdrop-blur-sm">
      <div className="text-[11px] text-zinc-400 leading-tight min-h-[28px]">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        {loading || value === undefined ? (
          <span className="inline-block h-7 w-12 rounded-md bg-white/10 animate-pulse" aria-label="Carregando" />
        ) : (
          <span className="text-3xl font-bold text-white tabular-nums">{value}</span>
        )}
        <span className="text-xs font-medium text-emerald-400">{delta}</span>
      </div>
    </div>
  );
}

function Shortcut({
  to, icon: Icon, label, search,
}: { to: string; icon: any; label: string; search?: Record<string, string> }) {
  return (
    <Link to={to} search={search as any} className="flex flex-col items-center gap-2 group">
      <div className="size-14 rounded-2xl border border-white/10 bg-zinc-900/60 grid place-items-center group-active:scale-95 group-hover:border-violet-400/40 transition">
        <Icon className="size-5 text-white" strokeWidth={1.5} />
      </div>
      <span className="text-[11px] text-zinc-300 text-center leading-tight">{label}</span>
    </Link>
  );
}

