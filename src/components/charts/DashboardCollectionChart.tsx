import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { formatBRL } from "@/lib/format";

export type DashboardChartDatum = { month: string; pago: number; pendente: number };

export default function DashboardCollectionChart({ data }: { data: DashboardChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="month" stroke="var(--border)" fontSize={12} tick={{ fill: "#e4e4e7" }} />
        <YAxis
          stroke="var(--border)"
          fontSize={12}
          tick={{ fill: "#e4e4e7" }}
          tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v: number) => formatBRL(v)}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
        />
        <Bar dataKey="pago" stackId="a" fill="var(--primary)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="pendente" stackId="a" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
