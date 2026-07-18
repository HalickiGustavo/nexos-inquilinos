import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { FileText, Search, Calendar, Home, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { ContractPdfUploader } from "@/components/ContractPdfUploader";
import { ContractFormDialog } from "@/components/ContractFormDialog";

export const Route = createFileRoute("/_manager/manager/contratos")({
  component: ContratosPage,
});

type ContractRow = {
  id: string;
  start_date: string;
  end_date: string;
  due_day: number;
  rent_amount: number;
  active: boolean;
  contract_pdf_path: string | null;
  property: { id: string; nickname: string | null; address: string | null } | null;
  tenant: { id: string; full_name: string | null } | null;
};

function ContratosPage() {
  const [filter, setFilter] = useState<"all" | "ativos" | "encerrados">("ativos");
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);

  const q = useQuery({
    queryKey: ["mgr-contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(
          "id,start_date,end_date,due_day,rent_amount,active,contract_pdf_path,property:properties(id,nickname,address),tenant:tenants(id,full_name)"
        )
        .is("deleted_at", null)
        .order("active", { ascending: false })
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContractRow[];
    },
  });

  const rows = q.data ?? [];
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter((c) => {
      const matchStatus =
        filter === "all" ||
        (filter === "ativos" && c.active) ||
        (filter === "encerrados" && !c.active);
      const matchSearch =
        !s ||
        (c.property?.nickname ?? "").toLowerCase().includes(s) ||
        (c.property?.address ?? "").toLowerCase().includes(s) ||
        (c.tenant?.full_name ?? "").toLowerCase().includes(s);
      return matchStatus && matchSearch;
    });
  }, [rows, filter, search]);

  const today = new Date();
  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Contratos de locação da imobiliária.
          </p>
        </div>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por imóvel, endereço ou inquilino..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="ativos" className="flex-1 sm:flex-none">Ativos</TabsTrigger>
            <TabsTrigger value="encerrados" className="flex-1 sm:flex-none">Encerrados</TabsTrigger>
            <TabsTrigger value="all" className="flex-1 sm:flex-none">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum contrato encontrado.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const end = new Date(c.end_date + "T00:00:00");
            const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000);
            const nearEnd = c.active && daysLeft >= 0 && daysLeft <= 60;
            return (
              <Card key={c.id} className="p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">
                      {c.property?.nickname ?? "Imóvel"}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {c.property?.address ?? "—"}
                    </p>
                  </div>
                  <Badge
                    variant={c.active ? "default" : "secondary"}
                    className={`shrink-0 ${c.active ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {c.active ? "Ativo" : "Encerrado"}
                  </Badge>
                </div>

                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Inquilino</span>
                    <span className="truncate max-w-[60%] text-right">
                      {c.tenant?.full_name ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Aluguel</span>
                    <span className="font-semibold text-primary">
                      {formatBRL(Number(c.rent_amount))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Vencimento</span>
                    <span>Dia {c.due_day}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3.5" /> Vigência
                    </span>
                    <span className="text-right">
                      {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                    </span>
                  </div>
                  {nearEnd && (
                    <div className="mt-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 text-xs">
                      Encerra em {daysLeft} dia{daysLeft === 1 ? "" : "s"}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  {c.property?.id && (
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link
                        to="/manager/carteira"
                        search={{ imovel: c.property.id } as never}
                      >
                        <Home className="size-3.5 mr-1.5" />
                        Ver imóvel
                      </Link>
                    </Button>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                    Contrato PDF
                  </p>
                  <ContractPdfUploader
                    contractId={c.id}
                    currentPath={c.contract_pdf_path}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
