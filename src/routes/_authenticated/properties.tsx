import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { maskCEP } from "@/lib/br-validators";
import { useAuth } from "@/lib/auth";
import { useProperties, useInvalidate, type Property } from "@/lib/queries";
import { formatBRL, parseNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: [{ title: "Imóveis — ImovelPro" }] }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const { data: properties = [], isLoading } = useProperties();
  const [filter, setFilter] = useState<"all" | "disponivel" | "alugado">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Property | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = properties.filter((p) => {
    const matchStatus = filter === "all" || p.status === filter;
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
          <PropertyDialog editing={editing} onDone={() => { setOpen(false); setEditing(null); }} />
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

function PropertyDialog({ editing, onDone }: { editing: Property | null; onDone: () => void }) {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const [form, setForm] = useState({
    nickname: editing?.nickname ?? "",
    address: editing?.address ?? "",
    city: editing?.city ?? "",
    state: editing?.state ?? "",
    zip_code: editing?.zip_code ?? "",
    type: editing?.type ?? "apartamento",
    rent_price: editing ? String(editing.rent_price) : "0",
    condo_fee: editing ? String(editing.condo_fee) : "0",
    iptu: editing ? String(editing.iptu) : "0",
    status: editing?.status ?? "disponivel",
    notes: editing?.notes ?? "",
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? "Editar imóvel" : "Novo imóvel"}</DialogTitle>
      </DialogHeader>
      <form
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user) return;
          const payload = {
            user_id: user.id,
            nickname: form.nickname,
            address: form.address,
            city: form.city || null,
            state: form.state || null,
            zip_code: form.zip_code || null,
            type: form.type as Property["type"],
            rent_price: parseNumber(form.rent_price),
            condo_fee: parseNumber(form.condo_fee),
            iptu: parseNumber(form.iptu),
            status: form.status as Property["status"],
            notes: form.notes || null,
          };
          const { error } = editing
            ? await supabase.from("properties").update(payload).eq("id", editing.id)
            : await supabase.from("properties").insert(payload);
          if (error) return toast.error(error.message);
          toast.success(editing ? "Imóvel atualizado" : "Imóvel cadastrado");
          invalidate(["properties"]);
          onDone();
        }}
      >
        <div className="sm:col-span-2 space-y-2">
          <Label>Apelido / Identificação *</Label>
          <Input required value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Ex: Apto 302 - Centro" />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Endereço completo *</Label>
          <Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2"><Label>Estado</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} placeholder="PR" /></div>
          <div className="space-y-2"><Label>CEP</Label><Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: maskCEP(e.target.value) })} placeholder="00000-000" inputMode="numeric" /></div>
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Property["type"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apartamento">Apartamento</SelectItem>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="terreno">Terreno</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Property["status"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="disponivel">Disponível</SelectItem>
              <SelectItem value="alugado">Alugado</SelectItem>
              <SelectItem value="manutencao">Manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Aluguel (R$)</Label><Input type="number" step="0.01" value={form.rent_price} onChange={(e) => setForm({ ...form, rent_price: e.target.value })} /></div>
        <div className="space-y-2"><Label>Condomínio (R$)</Label><Input type="number" step="0.01" value={form.condo_fee} onChange={(e) => setForm({ ...form, condo_fee: e.target.value })} /></div>
        <div className="space-y-2"><Label>IPTU (R$)</Label><Input type="number" step="0.01" value={form.iptu} onChange={(e) => setForm({ ...form, iptu: e.target.value })} /></div>
        <div className="sm:col-span-2 space-y-2"><Label>Observações</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <DialogFooter className="sm:col-span-2">
          <Button type="submit">{editing ? "Salvar alterações" : "Cadastrar imóvel"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
