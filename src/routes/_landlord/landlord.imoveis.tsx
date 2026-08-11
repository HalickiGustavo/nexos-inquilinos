import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Search, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useLandlordProperties,
  useLandlordContracts,
  useLandlordInstallments,
  useLandlordMaintenances,
} from "@/lib/landlord-queries";
import { PropertyCard, type PropertyCardData } from "@/components/owner/PropertyCard";
import { PageHeader, PageShell } from "@/components/PageHeader";

export const Route = createFileRoute("/_landlord/landlord/imoveis")({
  head: () => ({ meta: [{ title: "Meus Imóveis — Nexo" }] }),
  component: LandlordPropertiesPage,
});

type StatusFilter = "all" | "alugado" | "disponivel" | "manutencao";
type SortBy = "recent" | "name" | "rent_desc" | "rent_asc";

function LandlordPropertiesPage() {
  const { data: properties = [], isLoading: propLoading } = useLandlordProperties();
  const { data: contracts = [], isLoading: contractLoading } = useLandlordContracts();
  const { data: installments = [], isLoading: instLoading } = useLandlordInstallments();
  const { data: maintenances = [], isLoading: maintLoading } = useLandlordMaintenances();

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  const isLoading = propLoading || contractLoading || instLoading || maintLoading;

  const cards = useMemo<PropertyCardData[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
      .toISOString()
      .slice(0, 10);

    const activeByProp = new Map<string, any>();
    for (const c of contracts as any[]) {
      if (c.active && !c.deleted_at && c.property_id) {
        activeByProp.set(c.property_id, c);
      }
    }

    const propByContract = new Map<string, string>();
    for (const c of contracts as any[]) {
      if (c.property_id) propByContract.set(c.id, c.property_id);
    }

    const ytdByProp = new Map<string, number>();
    const totalByProp = new Map<string, number>();
    const lastPaidByProp = new Map<string, string>();
    const nextDueByProp = new Map<string, string>();
    const hasOverdue = new Map<string, boolean>();
    const hasDueSoon = new Map<string, boolean>();

    for (const i of installments as any[]) {
      const propId = i.contract?.property?.id || propByContract.get(i.contract_id);
      if (!propId) continue;

      const paid = Number(i.paid_amount || 0);
      if (i.status === "pago" && paid > 0) {
        totalByProp.set(propId, (totalByProp.get(propId) || 0) + paid);
        const paymentDate = i.paid_at || i.payment_date;
        if (paymentDate && paymentDate >= yearStart) {
          ytdByProp.set(propId, (ytdByProp.get(propId) || 0) + paid);
        }
        const last = lastPaidByProp.get(propId);
        if (paymentDate && (!last || paymentDate > last)) {
          lastPaidByProp.set(propId, paymentDate);
        }
      }

      if (i.status !== "pago") {
        if (i.due_date < today) hasOverdue.set(propId, true);
        else {
          const diff =
            (new Date(i.due_date).getTime() - new Date(today).getTime()) /
            86400000;
          if (diff <= 5) hasDueSoon.set(propId, true);
          const next = nextDueByProp.get(propId);
          if (!next || i.due_date < next) nextDueByProp.set(propId, i.due_date);
        }
      }
    }

    const openMaintByProp = new Map<string, number>();
    for (const m of maintenances as any[]) {
      if (!m.property_id) continue;
      if (m.status !== "concluido") {
        openMaintByProp.set(
          m.property_id,
          (openMaintByProp.get(m.property_id) || 0) + 1,
        );
      }
    }

    return properties.map((p) => {
      const contract = activeByProp.get(p.id);
      let status: PropertyCardData["status"] = "disponivel";
      if (contract) status = "alugado";
      else if (p.status === "manutencao") status = "manutencao";

      let health: PropertyCardData["paymentHealth"] = "neutral";
      if (contract) {
        if (hasOverdue.get(p.id)) health = "red";
        else if (hasDueSoon.get(p.id)) health = "yellow";
        else health = "green";
      }

      return {
        property: p,
        status,
        tenantName: contract?.tenant?.full_name,
        contractEnd: contract?.end_date ?? null,
        lastPaymentDate: lastPaidByProp.get(p.id) ?? null,
        nextDueDate: nextDueByProp.get(p.id) ?? null,
        ytdRevenue: ytdByProp.get(p.id) || 0,
        totalRevenue: totalByProp.get(p.id) || 0,
        paymentHealth: health,
        openMaintenances: openMaintByProp.get(p.id) || 0,
      };
    });
  }, [properties, contracts, installments, maintenances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = cards.filter((c) => {
      if (q) {
        const hit =
          c.property.nickname.toLowerCase().includes(q) ||
          c.property.address.toLowerCase().includes(q) ||
          (c.tenantName ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filter === "all") return true;
      return c.status === filter;
    });

    const sorted = [...arr];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.property.nickname.localeCompare(b.property.nickname);
        case "rent_desc":
          return Number(b.property.rent_price) - Number(a.property.rent_price);
        case "rent_asc":
          return Number(a.property.rent_price) - Number(b.property.rent_price);
        default:
          return (
            new Date(b.property.created_at).getTime() -
            new Date(a.property.created_at).getTime()
          );
      }
    });
    return sorted;
  }, [cards, filter, search, sortBy]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Meus Imóveis"
        subtitle={`${properties.length} imóveis vinculados à sua conta.`}
      />

      <Card className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por apelido, endereço ou inquilino..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="alugado">Alugados</TabsTrigger>
            <TabsTrigger value="disponivel">Disponíveis</TabsTrigger>
            <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
            <SelectItem value="rent_desc">Maior aluguel</SelectItem>
            <SelectItem value="rent_asc">Menor aluguel</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Carregando seus imóveis...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum imóvel encontrado.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.property.id} className="[&_button[aria-label='Ações do imóvel']]:hidden [&_button:has(svg.pencil)]:hidden [&_button:has(svg.trash-2)]:hidden">
              <PropertyCard data={c} onEdit={() => {}} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
