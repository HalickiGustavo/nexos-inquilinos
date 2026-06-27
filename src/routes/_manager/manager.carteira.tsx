import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/format";
import { PropertyFormDialog } from "@/components/PropertyFormDialog";
import { ContractPdfUploader } from "@/components/ContractPdfUploader";
import { useInvalidate, type Property } from "@/lib/queries";
import { useConfirm } from "@/components/ui/confirm";

export const Route = createFileRoute("/_manager/manager/carteira")({
  component: Carteira,
});

function Carteira() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "disponivel" | "alugado">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Property | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("novo")) {
      setOpen(true);
    }
  }, []);

  const q = useQuery({
    queryKey: ["mgr-carteira"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, contracts(id, active, rent_amount, contract_pdf_path, tenant:tenants(full_name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const properties = q.data ?? [];
  const filtered = properties.filter((p: any) => {
    const matchStatus = filter === "all" || p.status === filter;
    const s = search.toLowerCase();
    const matchSearch = !search ||
      (p.nickname ?? "").toLowerCase().includes(s) ||
      (p.address ?? "").toLowerCase().includes(s) ||
      (p.city ?? "").toLowerCase().includes(s) ||
      (p.owner_name ?? "").toLowerCase().includes(s);
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Carteira de Imóveis</h1>
          <p className="text-muted-foreground mt-1 text-sm">Gestão de portfólio e proprietários.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Novo imóvel</Button>
          </DialogTrigger>
          <PropertyFormDialog
            editing={editing}
            mode="manager"
            invalidateKeys={["mgr-carteira", "properties"]}
            onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["mgr-carteira"] }); }}
          />
        </Dialog>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por apelido, endereço, cidade ou proprietário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all" className="flex-1 sm:flex-none">Todos</TabsTrigger>
            <TabsTrigger value="disponivel" className="flex-1 sm:flex-none">Disponíveis</TabsTrigger>
            <TabsTrigger value="alugado" className="flex-1 sm:flex-none">Alugados</TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum imóvel encontrado.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any) => {
            const active = (p.contracts ?? []).find((c: any) => c.active);
            return (
              <Card key={p.id} className="p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{p.nickname}</h3>
                    <p className="text-sm text-muted-foreground truncate">{p.address}</p>
                  </div>
                  <Badge variant={p.status === "alugado" ? "default" : "secondary"} className={`shrink-0 ${p.status === "alugado" ? "bg-primary text-primary-foreground" : ""}`}>
                    {p.status === "alugado" ? "Alugado" : p.status === "disponivel" ? "Disponível" : "Manutenção"}
                  </Badge>
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Aluguel</span><span className="font-semibold text-primary">{formatBRL(Number(p.rent_price))}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Condomínio</span><span>{formatBRL(Number(p.condo_fee))}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">IPTU</span><span>{formatBRL(Number(p.iptu))}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Tipo</span><span className="capitalize truncate">{p.type}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Proprietário</span><span className="truncate max-w-[55%] text-right">{p.owner_name ?? "—"}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Inquilino</span><span className="truncate max-w-[55%] text-right">{active?.tenant?.full_name ?? "—"}</span></div>
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
                {active && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Contrato PDF</p>
                    <ContractPdfUploader contractId={active.id} currentPath={active.contract_pdf_path} />
                  </div>
                )}
              </Card>
            );
          })}
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
        invalidate(["properties", "mgr-carteira"]);
      }}
    >
      <Trash2 className="size-3.5 text-destructive" />
    </Button>
  );
}
