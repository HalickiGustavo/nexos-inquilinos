import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Eye } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_manager/manager/carteira")({
  component: Carteira,
});

function Carteira() {
  const qc = useQueryClient();
  const [statusF, setStatusF] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openDetail, setOpenDetail] = useState<any | null>(null);

  const q = useQuery({
    queryKey: ["mgr-carteira"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, contracts(id, active, rent_amount, tenant:tenants(full_name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (q.data ?? []).filter((p: any) => {
    if (statusF !== "todos" && p.status !== statusF) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(p.city ?? "").toLowerCase().includes(s) &&
          !(p.neighborhood ?? "").toLowerCase().includes(s) &&
          !(p.address ?? "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      alugado: "bg-primary/15 text-primary border-primary/30",
      disponivel: "bg-blue-500/15 text-blue-700 border-blue-500/30",
      manutencao: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    };
    return <Badge variant="outline" className={map[s] ?? ""}>{s}</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Carteira de Imóveis</h1>
          <p className="text-sm text-zinc-500">Gestão de portfólio e proprietários</p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="size-4 mr-2" /> Adicionar Novo Imóvel
        </Button>
      </header>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <Input className="pl-9" placeholder="Buscar por cidade, bairro ou endereço..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="alugado">Alugado</SelectItem>
              <SelectItem value="disponivel">Disponível</SelectItem>
              <SelectItem value="manutencao">Em Manutenção</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Inquilino</TableHead>
                <TableHead className="text-right">Aluguel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-zinc-500 py-8">Nenhum imóvel encontrado</TableCell></TableRow>
              )}
              {rows.map((p: any) => {
                const active = (p.contracts ?? []).find((c: any) => c.active);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code ?? "—"}</TableCell>
                    <TableCell className="capitalize">{p.type}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{p.address}{p.neighborhood ? ` — ${p.neighborhood}` : ""}{p.city ? `, ${p.city}` : ""}</TableCell>
                    <TableCell>{p.owner_name ?? "—"}</TableCell>
                    <TableCell>{active?.tenant?.full_name ?? <span className="text-zinc-400">Disponível</span>}</TableCell>
                    <TableCell className="text-right font-medium">{formatBRL(p.rent_price)}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setOpenDetail(p)}>
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NovoImovelDialog open={openNew} onOpenChange={setOpenNew} onSaved={() => qc.invalidateQueries({ queryKey: ["mgr-carteira"] })} />
      <Dialog open={!!openDetail} onOpenChange={(o) => !o && setOpenDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do Imóvel</DialogTitle></DialogHeader>
          {openDetail && (
            <div className="space-y-2 text-sm">
              <div><strong>Código:</strong> {openDetail.code}</div>
              <div><strong>Apelido:</strong> {openDetail.nickname}</div>
              <div><strong>Endereço:</strong> {openDetail.address}</div>
              <div><strong>Cidade/Bairro:</strong> {openDetail.city} / {openDetail.neighborhood ?? "—"}</div>
              <div><strong>Proprietário:</strong> {openDetail.owner_name ?? "—"} ({openDetail.owner_commission_percent}% comissão)</div>
              <div><strong>Aluguel:</strong> {formatBRL(openDetail.rent_price)}</div>
              <div><strong>IPTU:</strong> {formatBRL(openDetail.iptu)}</div>
              <div><strong>Condomínio:</strong> {formatBRL(openDetail.condo_fee)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NovoImovelDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nickname: "", type: "apartamento", address: "", city: "", neighborhood: "", state: "", rent_price: "", owner_name: "", owner_commission_percent: "10" });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("properties").insert({
      user_id: u.user!.id,
      manager_id: u.user!.id,
      nickname: form.nickname,
      type: form.type as any,
      address: form.address,
      city: form.city,
      neighborhood: form.neighborhood,
      state: form.state,
      rent_price: Number(form.rent_price || 0),
      owner_name: form.owner_name,
      owner_commission_percent: Number(form.owner_commission_percent || 10),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Imóvel adicionado");
    onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Adicionar Novo Imóvel</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apelido"><Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></Field>
          <Field label="Tipo">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Endereço" className="col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Bairro"><Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></Field>
          <Field label="Cidade"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="Estado"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
          <Field label="Aluguel (R$)"><Input type="number" value={form.rent_price} onChange={(e) => setForm({ ...form, rent_price: e.target.value })} /></Field>
          <Field label="Nome do Proprietário"><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></Field>
          <Field label="Comissão Proprietário (%)"><Input type="number" step="0.01" value={form.owner_commission_percent} onChange={(e) => setForm({ ...form, owner_commission_percent: e.target.value })} /></Field>
        </div>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">Salvar Imóvel</Button>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
