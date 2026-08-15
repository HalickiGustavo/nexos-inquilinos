import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Copy, Mail, Loader2, CheckCircle2, X, Users } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { onlyDigits } from "@/lib/br-validators";
import { PageHeader, PageShell } from "@/components/PageHeader";

export const Route = createFileRoute("/_manager/manager/proprietarios")({
  head: () => ({ meta: [{ title: "Proprietários — NEXO" }] }),
  component: ManagerProprietariosPage,
});

function ManagerProprietariosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [document, setDocument] = useState("");

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["landlord-invites", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landlord_invites").select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada.");
      if (!email.trim()) throw new Error("Informe o e-mail.");

      const cleanEmail = email.trim().toLowerCase();
      const cleanDoc = document ? onlyDigits(document) : null;
      const cleanName = fullName.trim() || null;

      // Usamos upsert para evitar erro de "user já cadastrado" (email único no landlord_invites)
      // e atualizar as informações caso o manager mude de ideia ou corrija dados.
      const { data, error } = await supabase.from("landlord_invites")
        .upsert({
          manager_user_id: user.id,
          email: cleanEmail,
          full_name: cleanName,
          document: cleanDoc,
          status: "pendente", // Reseta para pendente se for reenviado
        }, { 
          onConflict: "email" 
        })
        .select("*").single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Convite criado! Copie o link abaixo e envie ao proprietário.");
      qc.invalidateQueries({ queryKey: ["landlord-invites"] });
      setOpen(false); setEmail(""); setFullName(""); setDocument("");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar convite."),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landlord_invites")
        .update({ status: "cancelado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite cancelado.");
      qc.invalidateQueries({ queryKey: ["landlord-invites"] });
    },
    onError: (err: any) => toast.error(err?.message),
  });

  function copyLink(token: string) {
    const url = `${window.location.origin}/cadastro-landlord?invite=${token}&email=${encodeURIComponent(email || "")}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  return (
    <PageShell>
      <PageHeader
        icon={Users}
        eyebrow="Carteira"
        title="Proprietários"
        description="Convide os donos dos imóveis para acompanharem painel, finanças e saldo direto na NEXO."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="size-4 mr-2" /> Novo convite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar proprietário</DialogTitle>
                <DialogDescription>
                  Geramos um link único. O CPF/CNPJ liga automaticamente os imóveis dele.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>E-mail *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="proprietario@exemplo.com" />
                </div>
                <div>
                  <Label>Nome completo</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="Maria Souza" />
                </div>
                <div>
                  <Label>CPF ou CNPJ (recomendado)</Label>
                  <Input value={document} onChange={(e) => setDocument(e.target.value)}
                    placeholder="000.000.000-00" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quando informado, os imóveis cujo CPF/CNPJ do proprietário bate com este são vinculados no aceite.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => createInvite.mutate()} disabled={createInvite.isPending}>
                  {createInvite.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Mail className="size-4 mr-2" />}
                  Criar convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : invites.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="size-10 mx-auto text-muted-foreground/60 mb-3" />
            <p className="font-medium">Nenhum convite ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Novo convite" para começar.</p>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invites as any[]).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="max-w-[220px] truncate">{inv.email}</TableCell>
                    <TableCell>{inv.full_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.document || "—"}</TableCell>
                    <TableCell><InviteStatus status={inv.status} /></TableCell>
                    <TableCell>{formatDate(inv.created_at)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {inv.status === "pendente" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => copyLink(inv.invite_token)}>
                            <Copy className="size-3.5 mr-1" /> Copiar link
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => cancelInvite.mutate(inv.id)}
                            disabled={cancelInvite.isPending}>
                            <X className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}

function InviteStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cn: string; icon: React.ReactNode }> = {
    pendente: { label: "Pendente", cn: "border-violet-500/40 text-violet-300", icon: null },
    aceito: { label: "Aceito", cn: "border-emerald-500/40 text-emerald-300", icon: <CheckCircle2 className="size-3" /> },
    cancelado: { label: "Cancelado", cn: "border-zinc-700 text-zinc-400", icon: null },
    expirado: { label: "Expirado", cn: "border-rose-500/40 text-rose-300", icon: null },
  };
  const cfg = map[status] ?? { label: status, cn: "border-zinc-700 text-zinc-300", icon: null };
  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1 ${cfg.cn}`}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}
