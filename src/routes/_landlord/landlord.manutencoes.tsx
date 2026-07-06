import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Wrench, AlertCircle, Clock, CheckCircle2, Search, Filter, TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLandlordMaintenances } from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_landlord/landlord/manutencoes")({
  head: () => ({ meta: [{ title: "Manutenções — Proprietário NEXO" }] }),
  component: LandlordMaintenances,
});

type Filtro = "todos" | "aberta" | "em_andamento" | "concluida" | "aprovar";

function LandlordMaintenances() {
  const { data: maintenances = [], isLoading } = useLandlordMaintenances();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const list = maintenances as any[];
    const abertas = list.filter((m) => m.status !== "concluida").length;
    const concluidas = list.filter((m) => m.status === "concluida").length;
    const totalGasto = list.filter((m) => m.status === "concluida" && m.budget_amount)
      .reduce((s, m) => s + Number(m.budget_amount), 0);
    const medio = concluidas > 0 ? totalGasto / concluidas : 0;
    const tempos = list
      .filter((m) => m.status === "concluida" && m.created_at && m.updated_at)
      .map((m) => (new Date(m.updated_at).getTime() - new Date(m.created_at).getTime()) / 86400000);
    const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
    return { abertas, concluidas, totalGasto, medio, tempoMedio };
  }, [maintenances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (maintenances as any[]).filter((m) => {
      if (filtro === "aberta" && m.status !== "aberta") return false;
      if (filtro === "em_andamento" && m.status !== "em_andamento") return false;
      if (filtro === "concluida" && m.status !== "concluida") return false;
      if (filtro === "aprovar" && !["aguardando_aprovacao", "pendente"].includes(m.budget_status)) return false;
      if (!q) return true;
      return [m.title, m.description, m.property?.nickname, m.property?.address]
        .filter(Boolean).some((s: string) => s.toLowerCase().includes(q));
    });
  }, [maintenances, filtro, search]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80 font-medium mb-2">
          <Wrench className="size-3.5" /> Manutenções
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Chamados nos seus imóveis</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Acompanhe os orçamentos e a evolução das manutenções — a imobiliária executa; você aprova.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="Abertas" value={stats.abertas} tone={stats.abertas > 0 ? "amber" : "emerald"} icon={<AlertCircle className="size-4" />} />
        <StatTile label="Concluídas" value={stats.concluidas} tone="emerald" icon={<CheckCircle2 className="size-4" />} />
        <StatTile label="Total gasto" value={formatBRL(stats.totalGasto)} tone="rose" icon={<TrendingUp className="size-4" />} money />
        <StatTile label="Valor médio" value={formatBRL(stats.medio)} tone="violet" icon={<TrendingUp className="size-4" />} money />
        <StatTile label="Tempo médio (dias)" value={stats.tempoMedio.toFixed(1)} tone="fuchsia" icon={<Clock className="size-4" />} />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
          <div className="relative min-w-0">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar manutenção ou imóvel…" className="pl-9" />
          </div>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="todos"><Filter className="size-3 mr-1" />Todos</TabsTrigger>
              <TabsTrigger value="aprovar">A aprovar</TabsTrigger>
              <TabsTrigger value="aberta">Abertas</TabsTrigger>
              <TabsTrigger value="em_andamento">Em andamento</TabsTrigger>
              <TabsTrigger value="concluida">Concluídas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Wrench className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Nenhuma manutenção neste filtro</p>
          <p className="text-sm text-muted-foreground mt-1">Quando sua imobiliária abrir um chamado ele aparece aqui.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((m: any) => (
            <Card key={m.id} className="p-5 space-y-3 hover:border-primary/40 transition-colors">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{m.title}</h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {m.property?.nickname || m.property?.address || "—"}
                  </p>
                  {m.contract && (
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Contrato · {m.contract.tenant?.full_name ?? "inquilino"}
                      </Badge>
                      {m.contract.active && (
                        <Badge variant="outline" className="text-[10px] font-normal border-emerald-500/40 text-emerald-400">vigente</Badge>
                      )}
                    </div>
                  )}
                </div>
                <StatusBadge status={m.status} />
              </div>

              {m.description && <p className="text-sm text-muted-foreground line-clamp-3">{m.description}</p>}

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                <Field label="Aberto em" value={formatDate(m.created_at)} />
                <Field label="Prioridade" value={m.priority || "—"} />
                {m.budget_amount && <Field label="Orçamento" value={formatBRL(Number(m.budget_amount))} />}
                {m.budget_status && <Field label="Status do orçamento" value={m.budget_status} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground uppercase text-[10px] tracking-wider truncate">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}

function StatTile({ label, value, tone, icon, money }: {
  label: string; value: number | string; tone: "emerald" | "amber" | "rose" | "violet" | "fuchsia"; icon: React.ReactNode; money?: boolean;
}) {
  const map = {
    emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
    rose: "text-rose-400 bg-rose-500/10 ring-rose-500/30",
    violet: "text-violet-400 bg-violet-500/10 ring-violet-500/30",
    fuchsia: "text-fuchsia-400 bg-fuchsia-500/10 ring-fuchsia-500/30",
  } as const;
  return (
    <Card className="p-4">
      <div className={`size-8 rounded-md grid place-items-center ring-1 ${map[tone]} mb-2`}>{icon}</div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={`font-bold tabular-nums truncate mt-0.5 ${money ? "text-base" : "text-lg"}`}>{value}</p>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cn: string; icon: React.ReactNode }> = {
    aberta: { label: "Aberta", cn: "border-rose-500/40 text-rose-300", icon: <AlertCircle className="size-3" /> },
    em_andamento: { label: "Em andamento", cn: "border-violet-500/40 text-violet-300", icon: <Clock className="size-3" /> },
    concluida: { label: "Concluída", cn: "border-emerald-500/40 text-emerald-300", icon: <CheckCircle2 className="size-3" /> },
  };
  const cfg = map[status] ?? { label: status, cn: "border-zinc-700 text-zinc-300", icon: null };
  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1 shrink-0 ${cfg.cn}`}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}
