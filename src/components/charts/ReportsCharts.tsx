import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { formatBRL, formatBRLCompact } from "@/lib/format";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
];

export function RevenueBarChart({ data }: { data: Array<{ label: string; recebido: number; pendente: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => formatBRLCompact(v)} width={80} />
        <Tooltip formatter={(v: number) => formatBRL(v)} />
        <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 24, bottom: -8 }} />
        <Bar dataKey="recebido" name="Recebido" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="pendente" name="Pendente" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ExpensesPieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => formatBRL(v)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RevenueLineChart({ data }: { data: Array<{ label: string; recebido: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Line type="monotone" dataKey="recebido" stroke={CHART_COLORS[0]} name="Recebido" />
      </LineChart>
    </ResponsiveContainer>
  );
}
