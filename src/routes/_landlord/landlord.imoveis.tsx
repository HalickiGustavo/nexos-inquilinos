import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Building2, Search, MapPin, TrendingUp, Calendar, CheckCircle2, AlertCircle, Wrench,
  ArrowUpDown, MoreHorizontal, Eye, Receipt, FileText, ClipboardList, History,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useLandlordProperties, useLandlordContracts, usePropertyAggregates,
} from "@/lib/landlord-queries";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_landlord/landlord/imoveis")({
  head: () => ({ meta: [{ title: "Imóveis — Proprietário NEXO" }] }),
  component: LandlordImoveis,
});

type Filtro = "todos" | "alugado" | "disponivel" | "manutencao" | "atraso";
type Sort = "recent" | "name" | "receita" | "maior_aluguel" | "menor_aluguel" | "status";

function LandlordImoveis() {
  const { data: properties = [], isLoading } = useLandlordProperties();
  const { data: contracts = [] } = useLandlordContracts();
  const aggregates = usePropertyAggregates();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [sort, setSort] = useState<Sort>("recent");
  const [search, setSearch] = useState("");

  const contractByProp = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of contracts as any[]) {
      if (!c.active) continue;
      map.set(c.property_id, c);
    }
    return map;
  }, [contracts]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (properties as any[])
      .filter((p) => {
        const agg = aggregates.get(p.id);
        const inatraso = (agg?.inadimplencia ?? 0) > 0;
        if (filtro === "alugado" && p.status !== "alugado") return false;
        if (filtro === "disponivel" && p.status !== "disponivel") return false;
        if (filtro === "manutencao" && p.status !== "manutencao") return false;
        if (filtro === "atraso" && !inatraso) return false;
        if (!q) return true;
        return [p.nickname, p.address, p.code, p.neighborhood, p.city].filter(Boolean).some((s: string) => s.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const aa = aggregates.get(a.id); const bb = aggregates.get(b.id);
        switch (sort) {
          case "name": return (a.nickname || a.address).localeCompare(b.nickname || b.address);
          case "receita": return (bb?.receitaTotal ?? 0) - (aa?.receitaTotal ?? 0);
          case "maior_aluguel": return Number(b.rent_price) - Number(a.rent_price);
          case "menor_aluguel": return Number(a.rent_price) - Number(b.rent_price);
          case "status": return String(a.status).localeCompare(String(b.status));
          default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
  }, [properties, aggregates, filtro, sort, search]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80 font-medium mb-2">
            <Building2 className="size-3.5" /> Imóveis
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">Meus imóveis</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Cada card resume performance, contrato e situação do imóvel.
          </p>
        </div>
      </header>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center">
          <div className="relative min-w-0">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar imóvel, endereço ou código…" className="pl-9" />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-[190px]"><ArrowUpDown className="size-3.5 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="name">Nome (A–Z)</SelectItem>
              <SelectItem value="receita">Maior receita</SelectItem>
              <SelectItem value="maior_aluguel">Maior aluguel</SelectItem>
              <SelectItem value="menor_aluguel">Menor aluguel</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="alugado">Alugados</TabsTrigger>
              <TabsTrigger value="disponivel">Disponíveis</TabsTrigger>
              <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
              <TabsTrigger value="atraso">Em atraso</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <Building2 className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Nenhum imóvel neste filtro</p>
          <p className="text-sm text-muted-foreground mt-1">Ajuste o filtro ou aguarde a imobiliária vincular imóveis à sua conta.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              contract={contractByProp.get(p.id)}
              agg={aggregates.get(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyCard({ property: p, contract, agg }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const inatraso = (agg?.inadimplencia ?? 0) > 0;
  const pagStatus = inatraso ? "atraso" : agg?.proximoVencimento && agg.proximoVencimento <= addDaysISO(today, 7) ? "vencendo" : "em_dia";
  const pagDot = pagStatus === "em_dia" ? "bg-emerald-400" : pagStatus === "vencendo" ? "bg-amber-400" : "bg-rose-400";
  const pagLabel = pagStatus === "em_dia" ? "Em dia" : pagStatus === "vencendo" ? "Vence em breve" : "Em atraso";
  const rented = p.status === "alugado";
  // ocupação aproximada: 100% se alugado, 0 se disponível/manut.
  const ocupacaoPct = rented ? 100 : p.status === "manutencao" ? 40 : 0;

  return (
    <Card className="p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
        <div className="min-w-0">
          <Link to="/landlord/imoveis/$id" params={{ id: p.id }} className="font-semibold truncate hover:underline block">
            {p.nickname || p.address}
          </Link>
          <p className="text-xs text-muted-foreground truncate inline-flex items-center gap-1 mt-0.5">
            <MapPin className="size-3 shrink-0" />{p.address}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8 shrink-0"><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link to="/landlord/imoveis/$id" params={{ id: p.id }}><Eye className="size-4 mr-2" />Ver imóvel</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/landlord/imoveis/$id" params={{ id: p.id }} search={{ tab: "contrato" } as any}><FileText className="size-4 mr-2" />Contrato</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/landlord/imoveis/$id" params={{ id: p.id }} search={{ tab: "financeiro" } as any}><Receipt className="size-4 mr-2" />Financeiro</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/landlord/financeiro"><Receipt className="size-4 mr-2" />Conta Corrente</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/landlord/imoveis/$id" params={{ id: p.id }} search={{ tab: "manutencoes" } as any}><Wrench className="size-4 mr-2" />Manutenções</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/landlord/imoveis/$id" params={{ id: p.id }} search={{ tab: "historico" } as any}><History className="size-4 mr-2" />Histórico</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/landlord/imoveis/$id" params={{ id: p.id }} search={{ tab: "documentos" } as any}><ClipboardList className="size-4 mr-2" />Documentos</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={statusColor(p.status)}>{statusLabel(p.status)}</Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground inline-flex items-center gap-1">
          <span className={`size-1.5 rounded-full ${pagDot}`} />{pagLabel}
        </Badge>
        {p.code && <Badge variant="outline" className="border-border/60 text-muted-foreground">#{p.code}</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <MiniField label="Aluguel" value={formatBRL(Number(p.rent_price))} />
        <MiniField label="Condomínio" value={p.condo_fee ? formatBRL(Number(p.condo_fee)) : "—"} />
        <MiniField label="IPTU" value={p.iptu ? formatBRL(Number(p.iptu)) : "—"} />
      </div>

      {contract && (
        <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Inquilino</span>
            <span className="font-medium truncate max-w-[180px]">{contract.tenant?.full_name || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Contrato até</span>
            <span className="font-medium tabular-nums">{formatDate(contract.end_date)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
        <MiniField label="Receita histórica" value={formatBRL(agg?.receitaTotal ?? 0)} tone="emerald" />
        <MiniField label="Receita no ano" value={formatBRL(agg?.receitaAno ?? 0)} tone="violet" />
        <MiniField label="Último pagamento" value={agg?.ultimoPagamento ? formatDate(agg.ultimoPagamento) : "—"} icon={<Calendar className="size-3" />} />
        <MiniField label="Próx. vencimento" value={agg?.proximoVencimento ? formatDate(agg.proximoVencimento) : "—"} icon={<TrendingUp className="size-3" />} />
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
          <span>Ocupação</span><span>{ocupacaoPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${rented ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${ocupacaoPct}%` }} />
        </div>
      </div>

      <Button asChild size="sm" variant="outline" className="mt-1">
        <Link to="/landlord/imoveis/$id" params={{ id: p.id }}><Eye className="size-3.5 mr-2" />Abrir imóvel</Link>
      </Button>
    </Card>
  );
}

function MiniField({ label, value, tone, icon }: { label: string; value: string; tone?: "emerald" | "violet"; icon?: React.ReactNode }) {
  const toneCls = tone === "emerald" ? "text-emerald-400" : tone === "violet" ? "text-violet-400" : "text-foreground";
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate inline-flex items-center gap-1">
        {icon}{label}
      </p>
      <p className={`font-medium tabular-nums truncate ${toneCls}`}>{value}</p>
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "alugado": return "border-emerald-500/40 text-emerald-300";
    case "disponivel": return "border-zinc-700 text-zinc-300";
    case "manutencao": return "border-amber-500/40 text-amber-300";
    default: return "border-border text-muted-foreground";
  }
}
function statusLabel(status: string) {
  return { alugado: "Alugado", disponivel: "Disponível", manutencao: "Em manutenção" }[status] || status;
}
function addDaysISO(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}

export { AlertCircle, CheckCircle2 }; // avoid unused warnings in strict mode
