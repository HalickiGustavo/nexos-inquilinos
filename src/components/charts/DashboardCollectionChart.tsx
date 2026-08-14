import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid } from "recharts";
import { formatBRL, formatBRLCompact } from "@/lib/format";

export type DashboardChartDatum = { month: string; pago: number; pendente: number };

export default function DashboardCollectionChart({ data }: { data: DashboardChartDatum[] }) {
  // Se estivermos no modo diário (30 dias), mostramos apenas alguns labels para não poluir
  const interval = data.length > 15 ? Math.floor(data.length / 6) : 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart 
        data={data} 
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        barGap={0}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis 
          dataKey="month" 
          axisLine={false}
          tickLine={false}
          fontSize={10} 
          tick={{ fill: "#9CA3AF", fontWeight: 600 }} 
          interval={interval}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          fontSize={10}
          tick={{ fill: "#9CA3AF", fontWeight: 600 }}
          tickFormatter={(v) => formatBRLCompact(v)}
        />
        <Tooltip
          cursor={{ fill: '#F5F3FF', opacity: 0.4 }}
          formatter={(v: number) => [formatBRL(v), ""]}
          contentStyle={{ 
            background: "#fff", 
            border: "none", 
            borderRadius: "12px",
            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            padding: "8px 12px"
          }}
          itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1A1A1A' }}
          labelStyle={{ fontSize: '10px', color: '#6B7280', marginBottom: '4px', fontWeight: 'bold' }}
        />
        <Bar 
          dataKey="pago" 
          stackId="a" 
          fill="#7C3AED" 
          radius={[4, 4, 0, 0]} 
          barSize={data.length > 15 ? 12 : 30}
        />
        <Bar 
          dataKey="pendente" 
          stackId="a" 
          fill="#A78BFA" 
          fillOpacity={0.3}
          radius={[4, 4, 0, 0]}
          barSize={data.length > 15 ? 12 : 30}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
