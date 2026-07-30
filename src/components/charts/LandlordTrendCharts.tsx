import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Legend,
} from "recharts";
import { formatBRL, formatBRLCompact } from "@/lib/format";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

/** Recebido x Pendente nos últimos 12 meses. */
export function RevenueTrendChart({ data }: { data: Array<{ label: string; recebido: number; pendente: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatBRLCompact(v)} />
        <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
        <Legend verticalAlign="top" align="right" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="recebido" name="Recebido" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="pendente" name="Pendente" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Evolução do valor em atraso mês a mês. */
export function DelinquencyAreaChart({ data }: { data: Array<{ label: string; valor: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="delinqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatBRLCompact(v)} />
        <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="valor"
          name="Em atraso"
          stroke="var(--destructive)"
          strokeWidth={2}
          fill="url(#delinqFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
