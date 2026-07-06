import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Building2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProperties,
  useContracts,
  useInstallments,
  useMaintenances,
  type Property,
} from "@/lib/queries";
import { useDocuments } from "@/lib/documents";
import { useInspections } from "@/lib/inspections";
import { PropertyFormDialog } from "@/components/PropertyFormDialog";
import { PropertyCard, type PropertyCardData } from "@/components/owner/PropertyCard";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: [{ title: "Imóveis — Nexo" }] }),
  component: PropertiesPage,
});

type StatusFilter = "all" | "alugado" | "disponivel" | "manutencao" | "atraso";
type SortBy = "recent" | "revenue" | "name" | "rent_desc" | "rent_asc" | "status";

function PropertiesPage() {
  const { data: properties = [], isLoading } = useProperties();
  const { data: contracts = [] } = useContracts();
  const { data: installments = [] } = useInstallments();
  const { data: maintenances = [] } = useMaintenances();
  const { data: documents = [] } = useDocuments();
  const { data: inspections = [] } = useInspections();

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [editing, setEditing] = useState<Property | null>(null);
  const [open, setOpen] = useState(false);

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

    // pré-agregações
    const ytdByProp = new Map<string, number>();
    const totalByProp = new Map<string, number>();
    const lastPaidByProp = new Map<string, string>();
    const nextDueByProp = new Map<string, string>();
    const hasOverdue = new Map<string, boolean>();
    const hasDueSoon = new Map<string, boolean>();

    for (const i of installments as any[]) {
      const propId = propByContract.get(i.contract_id);
      if (!propId) continue;
      const paid = Number(i.paid_amount || 0);
      if (i.status === "pago" && paid > 0) {
        totalByProp.set(propId, (totalByProp.get(propId) || 0) + paid);
        if (i.payment_date && i.payment_date >= yearStart) {
          ytdByProp.set(propId, (ytdByProp.get(propId) || 0) + paid);
        }
        const last = lastPaidByProp.get(propId);
        if (i.payment_date && (!last || i.payment_date > last)) {
          lastPaidByProp.set(propId, i.payment_date);
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

    const lastDocByProp = new Map<string, string>();
    for (const d of documents as any[]) {
      if (!d.property_id) continue;
      const cur = lastDocByProp.get(d.property_id);
      if (!cur || d.created_at > cur) lastDocByProp.set(d.property_id, d.created_at);
    }
    const lastInspByProp = new Map<string, string>();
    for (const insp of inspections as any[]) {
      const propId = insp.contract?.property_id ?? propByContract.get(insp.contract_id);
      if (!propId) continue;
      const cur = lastInspByProp.get(propId);
      if (!cur || insp.inspection_date > cur) {
        lastInspByProp.set(propId, insp.inspection_date);
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
        lastInspectionDate: lastInspByProp.get(p.id) ?? null,
        lastDocumentDate: lastDocByProp.get(p.id) ?? null,
      };
    });
  }, [properties, contracts, installments, maintenances, documents, inspections]);

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
      if (filter === "atraso") return c.paymentHealth === "red";
      return c.status === filter;
    });
    const sorted = [...arr];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "revenue":
          return b.ytdRevenue - a.ytdRevenue;
        case "name":
          return a.property.nickname.localeCompare(b.property.nickname);
        case "rent_desc":
          return Number(b.property.rent_price) - Number(a.property.rent_price);
        case "rent_asc":
          return Number(a.property.rent_price) - Number(b.property.rent_price);
        case "status":
          return a.status.localeCompare(b.status);
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
          <p className="text-muted-foreground mt-1">
            {properties.length} imóveis cadastrados — clique em um card para abrir a página completa.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Novo imóvel
            </Button>
          </DialogTrigger>
          <PropertyFormDialog
            editing={editing}
            onDone={() => {
              setOpen(false);
              setEditing(null);
            }}
          />
        </Dialog>
      </div>

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
            <TabsTrigger value="atraso">Em atraso</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="revenue">Maior receita (YTD)</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
            <SelectItem value="rent_desc">Maior aluguel</SelectItem>
            <SelectItem value="rent_asc">Menor aluguel</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 h-64 animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum imóvel encontrado.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <PropertyCard
              key={c.property.id}
              data={c}
              onEdit={(p) => {
                setEditing(p);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
