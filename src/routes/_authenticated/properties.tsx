import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useProperties, useContracts, useInvalidate, type Property } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { PropertyFormDialog } from "@/components/PropertyFormDialog";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: [{ title: "Imóveis — Nexo" }] }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const { data: properties = [], isLoading } = useProperties();
  const { data: contracts = [] } = useContracts();
  const [filter, setFilter] = useState<"all" | "disponivel" | "alugado">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Property | null>(null);
  const [open, setOpen] = useState(false);

  // Occupancy derivada do contrato ativo (única fonte da verdade).
  const occupiedIds = new Set<string>(
    (contracts as any[])
      .filter((c) => c.active && !c.deleted_at && c.property_id)
      .map((c) => c.property_id as string),
  );
  const effectiveStatus = (p: Property): "alugado" | "disponivel" | "manutencao" => {
    if (occupiedIds.has(p.id)) return "alugado";
    if (p.status === "manutencao") return "manutencao";
    return "disponivel";
  };

  const filtered = properties.filter((p) => {
    const matchStatus = filter === "all" || effectiveStatus(p) === filter;
    const matchSearch = !search ||
      p.nickname.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas propriedades cadastradas.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Novo imóvel</Button>
          </DialogTrigger>
          <PropertyFormDialog editing={editing} onDone={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por apelido ou endereço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="disponivel">Disponíveis</TabsTrigger>
            <TabsTrigger value="alugado">Alugados</TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum imóvel encontrado.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="p-5 hover:shadow-md transition group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{p.nickname}</h3>
                  <p className="text-sm text-muted-foreground truncate">{p.address}</p>
                </div>
                <Badge variant={p.status === "alugado" ? "default" : "secondary"} className={p.status === "alugado" ? "bg-primary text-primary-foreground" : ""}>
                  {p.status === "alugado" ? "Alugado" : p.status === "disponivel" ? "Disponível" : "Manutenção"}
                </Badge>
              </div>
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Aluguel</span><span className="font-semibold text-primary">{formatBRL(Number(p.rent_price))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Condomínio</span><span>{formatBRL(Number(p.condo_fee))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">IPTU</span><span>{formatBRL(Number(p.iptu))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="capitalize">{p.type}</span></div>
              </div>
              <div className="mt-4 flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="size-3.5 mr-1.5" />Editar
                    </Button>
                  </DialogTrigger>
                </Dialog>
                <DeleteButton id={p.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const invalidate = useInvalidate();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        if (!confirm("Excluir este imóvel?")) return;
        const { error } = await supabase.from("properties").delete().eq("id", id);
        if (error) return toast.error(error.message);
        toast.success("Imóvel excluído");
        invalidate(["properties"]);
      }}
    >
      <Trash2 className="size-3.5 text-destructive" />
    </Button>
  );
}

