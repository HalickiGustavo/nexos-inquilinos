import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Copy, Users as UsersIcon, Briefcase, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_manager/manager/equipe")({
  component: Equipe,
});

function Equipe() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["mgr-team"],
    queryFn: async () => {
      const { data, error } = await supabase.from("manager_members").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const qContracts = useQuery({
    queryKey: ["mgr-team-contracts"],
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("assigned_member_id, contracts(active, rent_amount)");
      const counts: Record<string, number> = {};
      const values: Record<string, number> = {};
      (data ?? []).forEach((p: any) => {
        if (!p.assigned_member_id) return;
        (p.contracts ?? []).filter((c: any) => c.active).forEach((c: any) => {
          counts[p.assigned_member_id] = (counts[p.assigned_member_id] ?? 0) + 1;
          values[p.assigned_member_id] = (values[p.assigned_member_id] ?? 0) + Number(c.rent_amount ?? 0);
        });
      });
      return { counts, values };
    },
  });

  const roleBadge = (r: string) => {
    const map: Record<string, string> = {
      corretor: "bg-blue-500/15 text-blue-700 border-blue-500/30",
      admin: "bg-purple-500/15 text-purple-700 border-purple-500/30",
      financeiro: "bg-primary/15 text-primary border-primary/30",
    };
    return <Badge variant="outline" className={map[r] ?? ""}>{r}</Badge>;
  };

  const removeMember = async (id: string) => {
    await supabase.from("manager_members").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["mgr-team"] });
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-sm text-zinc-500">Corretores, administrativo e financeiro</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90">
          <UserPlus className="size-4 mr-2" /> Convidar Novo Membro
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard icon={UsersIcon} label="Membros ativos" value={String((q.data ?? []).filter((m: any) => m.status === "ativo").length)} />
        <MetricCard icon={Briefcase} label="Locações sob gestão" value={String(Object.values(qContracts.data?.counts ?? {}).reduce((a, b) => a + b, 0))} />
        <MetricCard icon={TrendingUp} label="Valor mensal sob gestão" value={formatBRL(Object.values(qContracts.data?.values ?? {}).reduce((a, b) => a + b, 0))} />
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Locações</TableHead>
            <TableHead className="text-right">Valor mensal</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-zinc-500">Nenhum membro cadastrado</TableCell></TableRow>}
            {(q.data ?? []).map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-sm">{m.email}</TableCell>
                <TableCell>{roleBadge(m.role_label)}</TableCell>
                <TableCell>
                  <Badge variant={m.status === "ativo" ? "default" : "secondary"}>{m.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{qContracts.data?.counts?.[m.id] ?? 0}</TableCell>
                <TableCell className="text-right font-medium">{formatBRL(qContracts.data?.values?.[m.id] ?? 0)}</TableCell>
                <TableCell className="text-right space-x-2">
                  {m.status === "pendente" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      const link = `${window.location.origin}/manager-invite?token=${m.invite_token}`;
                      navigator.clipboard.writeText(link);
                      toast.success("Link copiado");
                    }}><Copy className="size-3.5 mr-1" /> Link</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}>Remover</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <ConvidarDialog open={open} onOpenChange={setOpen} onSaved={(link) => { setInviteLink(link); qc.invalidateQueries({ queryKey: ["mgr-team"] }); }} />
      <Dialog open={!!inviteLink} onOpenChange={(o) => !o && setInviteLink(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convite criado</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-500">Envie este link ao membro para ele completar o cadastro:</p>
          <div className="flex gap-2">
            <Input readOnly value={inviteLink ?? ""} />
            <Button onClick={() => { navigator.clipboard.writeText(inviteLink ?? ""); toast.success("Copiado"); }}>Copiar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConvidarDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: (link: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", role_label: "corretor" });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("manager_members").insert({
      manager_user_id: u.user!.id,
      name: form.name, email: form.email, role_label: form.role_label, status: "pendente",
    }).select().single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const link = `${window.location.origin}/manager-invite?token=${(data as any).invite_token}`;
    onOpenChange(false);
    setForm({ name: "", email: "", role_label: "corretor" });
    onSaved(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Convidar Novo Membro da Equipe</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Função</Label>
            <Select value={form.role_label} onValueChange={(v) => setForm({ ...form, role_label: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corretor">Corretor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={busy || !form.name || !form.email} className="w-full bg-primary hover:bg-primary/90">Enviar Convite</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="size-10 rounded-md bg-primary/10 grid place-items-center text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-zinc-500">{label}</div>
          <div className="font-semibold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
