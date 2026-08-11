import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { 
  Building2, 
  Search, 
  LayoutGrid,
  LayoutList
} from "lucide-react";
import { PageHeader, PageShell } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLandlordProperties, useLandlordContracts, useLandlordInstallments, useLandlordMaintenances } from "@/lib/landlord-queries";
import { PropertyCard } from "@/components/owner/PropertyCard";
import { PropertyFormDialog } from "@/components/PropertyFormDialog";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_landlord/landlord/imoveis")({
  component: LandlordImoveis,
});

function LandlordImoveis() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState<Property | null>(null);
  const [open, setOpen] = useState(false);

  const propertiesQuery = useLandlordProperties();
  const contractsQuery = useLandlordContracts();
  const installmentsQuery = useLandlordInstallments();
  const maintenancesQuery = useLandlordMaintenances();

  const isLoading = propertiesQuery.isLoading || contractsQuery.isLoading || installmentsQuery.isLoading || maintenancesQuery.isLoading;

  const filteredProperties = useMemo(() => {
    if (!propertiesQuery.data) return [];

    return (propertiesQuery.data as any[])
      .filter((p) => {
        const matchesSearch = 
          p.nickname?.toLowerCase().includes(search.toLowerCase()) ||
          p.address?.toLowerCase().includes(search.toLowerCase()) ||
          p.code?.toLowerCase().includes(search.toLowerCase());
        
        const activeContract = (contractsQuery.data as any[])?.find(c => c.property_id === p.id && c.active);
        const hasMaintenance = (maintenancesQuery.data as any[])?.some(m => m.property_id === p.id && m.status !== 'concluido');
        
        const status = activeContract ? 'alugado' : (hasMaintenance ? 'manutencao' : 'disponivel');
        const matchesStatus = statusFilter === 'all' || status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .map(p => {
        const activeContract = (contractsQuery.data as any[])?.find(c => c.property_id === p.id && c.active);
        const propertyInstallments = (installmentsQuery.data as any[])?.filter(i => i.contract?.property?.id === p.id) || [];
        const propertyMaintenances = (maintenancesQuery.data as any[])?.filter(m => m.property_id === p.id) || [];
        
        const ytdRevenue = propertyInstallments
          .filter(i => i.status === 'pago' && i.due_date && new Date(i.due_date).getFullYear() === new Date().getFullYear())
          .reduce((sum, i) => sum + Number(i.paid_amount || i.amount || 0), 0);
          
        const totalRevenue = propertyInstallments
          .filter(i => i.status === 'pago')
          .reduce((sum, i) => sum + Number(i.paid_amount || i.amount || 0), 0);

        const lastPayment = propertyInstallments
          .filter(i => i.status === 'pago' && i.paid_at)
          .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())[0];

        const nextDue = propertyInstallments
          .filter(i => i.status === 'pendente' && i.due_date)
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

        const overdueCount = propertyInstallments.filter(i => i.status === 'atrasado').length;

        return {
          property: p,
          status: activeContract ? 'alugado' : (propertyMaintenances.some(m => m.status !== 'concluido') ? 'manutencao' : 'disponivel'),
          tenantName: activeContract?.tenant?.full_name,
          contractEnd: activeContract?.end_date,
          lastPaymentDate: lastPayment?.paid_at,
          nextDueDate: nextDue?.due_date,
          ytdRevenue,
          totalRevenue,
          paymentHealth: activeContract ? (overdueCount > 0 ? 'red' : 'green') : 'neutral',
          openMaintenances: propertyMaintenances.filter(m => m.status !== 'concluido').length,
        };
      });
  }, [propertiesQuery.data, contractsQuery.data, installmentsQuery.data, maintenancesQuery.data, search, statusFilter]);

  return (
    <PageShell>
      <PageHeader 
        title="Meus Imóveis" 
        description="Visualize e acompanhe o status de todo o seu patrimônio imobiliário."
        icon={Building2}
        eyebrow="Patrimônio"
      />

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border/60 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, endereço ou código..." 
            className="pl-9 bg-background/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px] bg-background/50">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="alugado">Alugados</SelectItem>
              <SelectItem value="disponivel">Disponíveis</SelectItem>
              <SelectItem value="manutencao">Em manutenção</SelectItem>
            </SelectContent>
          </Select>

          <div className="h-9 border-l border-border/60 mx-1 hidden sm:block" />

          <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/40 shrink-0">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="size-7 rounded-md"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="size-7 rounded-md"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={cn(
          "grid gap-6",
          viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[380px] w-full rounded-xl" />
          ))}
        </div>
      ) : filteredProperties.length > 0 ? (
        <div className={cn(
          "grid gap-6",
          viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
          "[&_.group]:hover:scale-[1.01] transition-transform duration-200",
          "[&_button:has(svg.pencil)]:hidden [&_button:has(svg.trash-2)]:hidden [&_[role='menuitem']:has(svg.pencil)]:hidden [&_[role='menuitem']:has(svg.trash-2)]:hidden [&_a:has(svg.external-link)]:hidden"
        )}>
          {filteredProperties.map((data) => (
            <PropertyCard 
              key={data.property.id} 
              data={data as any} 
              onEdit={(p) => setEditing(p)} 
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-border/60">
          <div className="size-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
            <Building2 className="size-8 text-muted-foreground/60" />
          </div>
          <h3 className="text-lg font-semibold">Nenhum imóvel encontrado</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2 px-4">
            Não encontramos imóveis que correspondam aos filtros aplicados ou você ainda não possui imóveis vinculados.
          </p>
          {(search || statusFilter !== 'all') && (
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => {
        setOpen(o);
        if (!o) setEditing(null);
      }}>
        <PropertyFormDialog 
          editing={editing} 
          onDone={() => {
            setOpen(false);
            setEditing(null);
          }}
          mode="owner"
          invalidateKeys={["landlord", "properties"]}
        />
      </Dialog>
    </PageShell>
  );
}
