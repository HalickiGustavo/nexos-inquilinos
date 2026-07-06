import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { formatBRL } from "@/lib/format";

export type ForecastDatum = { month: string; previsto: number; recebido: number };

export default function ForecastVsReceivedChart({ data }: { data: ForecastDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={4}>
        <XAxis dataKey="month" stroke="var(--border)" fontSize={11} tick={{ fill: "#e4e4e7" }} />
        <YAxis
          stroke="var(--border)"
          fontSize={11}
          tick={{ fill: "#e4e4e7" }}
          tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v: number) => formatBRL(v)}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="previsto" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} name="Previsto" />
        <Bar dataKey="recebido" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Recebido" />
      </BarChart>
    </ResponsiveContainer>
  );
}
