import type { ReactNode } from "react";

/**
 * Design tokens da area do proprietario ("Executive Intelligence"):
 *  bg #0a0a1a | surface #141432 | border #1e1e5a | primary #4f46e5
 *  headings: Urbanist | body: Epilogue
 * Todos os componentes abaixo assumem o container `.landlord-theme` fornecido
 * pelo <LandlordShell />.
 */

export const URBANIST = { fontFamily: "Urbanist, ui-sans-serif, system-ui" } as const;

export function KpiCard({
  label,
  value,
  footer,
  glow = true,
  accent,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  glow?: boolean;
  accent?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-[#141432] p-6 rounded-2xl border border-[#1e1e5a] shadow-2xl transition-colors hover:border-[#4f46e5]/40">
      {glow && (
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#4f46e5]/10 rounded-full blur-2xl pointer-events-none" />
      )}
      {accent && <div className="absolute top-5 right-5">{accent}</div>}
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">{label}</p>
      <div
        className="text-2xl font-extrabold text-white mb-2 tracking-tight tabular-nums"
        style={URBANIST}
      >
        {value}
      </div>
      {footer && <div className="text-[11px] text-slate-400 font-medium">{footer}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight" style={URBANIST}>
        {title}
      </h2>
      {action}
    </div>
  );
}

export function Panel({
  children,
  className = "",
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`bg-[#141432] rounded-2xl border border-[#1e1e5a] shadow-2xl overflow-hidden ${
        padded ? "p-6" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

type PillTone = "emerald" | "amber" | "rose" | "indigo" | "slate" | "blue" | "violet";

export function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: PillTone;
}) {
  const map: Record<PillTone, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    indigo: "bg-[#4f46e5]/10 text-[#4f46e5] border-[#4f46e5]/30",
    slate: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 text-[10px] font-bold rounded-full border ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function LineBar({ value, tone = "indigo" }: { value: number; tone?: "indigo" | "emerald" | "blue" }) {
  const bg = {
    indigo: "bg-[#4f46e5]",
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
  }[tone];
  return (
    <div className="h-1.5 w-full bg-[#1e1e5a] rounded-full overflow-hidden">
      <div
        className={`h-full ${bg} rounded-full transition-[width] duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function LoadingLine() {
  return (
    <div className="p-10 text-center text-slate-500 text-sm">
      Carregando…
    </div>
  );
}

export function EmptyLine({ text }: { text: string }) {
  return (
    <div className="p-10 text-center text-slate-500 text-sm">{text}</div>
  );
}
