import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type OccupancyDatum = { month: string; ocupacao: number };

export default function OccupancyChart({ data }: { data: OccupancyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" stroke="var(--border)" fontSize={11} tick={{ fill: "#e4e4e7" }} />
        <YAxis
          domain={[0, 100]}
          stroke="var(--border)"
          fontSize={11}
          tick={{ fill: "#e4e4e7" }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(v: number) => `${v}%`}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        />
        <Area
          type="monotone"
          dataKey="ocupacao"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#occGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
