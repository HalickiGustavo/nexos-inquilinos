import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users, Mail, Phone, Handshake, MessageCircle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTenants, useInstallments, useInvalidate, type Tenant } from "@/lib/queries";
import { DebtAgreementDialog } from "@/components/DebtAgreementDialog";
import { today } from "@/lib/format";
import { maskCpfCnpj, maskPhone } from "@/lib/br-validators";
import { generateTenantInviteLink } from "@/lib/asaas.functions";

function waLink(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountry}${text}`;
}

export const Route = createFileRoute("/_authenticated/tenants")({
  head: () => ({ meta: [{ title: "Inquilinos — ImovelPro" }] }),
  component: TenantsPage,
});

function TenantsPage() {
  const { data: tenants = [], isLoading } = useTenants();
  const { data: installments = [] } = useInstallments();
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [open, setOpen] = useState(false);
  const [agreementFor, setAgreementFor] = useState<Tenant | null>(null);

  // Mapa: tenant_id -> parcelas atrasadas
  const overdueByTenant = useMemo(() => {
    const todayStr = today();
    const map = new Map<string, any[]>();
    for (const i of installments as any[]) {
      const tid = i.contract?.tenant?.id;
      if (!tid) continue;
      if (i.status === "pago" || i.status === "acordo_fechado") continue;
      if (i.due_date >= todayStr) continue;
      const arr = map.get(tid) || [];
      arr.push(i);
      map.set(tid, arr);
    }
    return map;
  }, [installments]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inquilinos</h1>
          <p className="text-muted-foreground mt-1">Cadastro e gestão de locatários.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Novo inquilino</Button>
          </DialogTrigger>
          <TenantDialog editing={editing} onDone={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : tenants.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum inquilino cadastrado.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((t) => {
            const overdue = overdueByTenant.get(t.id) || [];
            return (
            <Card key={t.id} className="p-5">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold">
                  {t.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{t.full_name}</h3>
                  {t.document && <p className="text-xs text-muted-foreground">{t.document}</p>}
                </div>
                {overdue.length > 0 && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                    {overdue.length} atrasada{overdue.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <div className="mt-4 space-y-1.5 text-sm">
                {t.email && <p className="flex items-center gap-2 text-muted-foreground truncate"><Mail className="size-3.5 shrink-0" />{t.email}</p>}
                {t.phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-3.5 shrink-0" />{t.phone}</p>}
              </div>
              {overdue.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full border-violet-500/40 bg-violet-500/5 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
                  onClick={() => setAgreementFor(t)}
                >
                  <Handshake className="size-3.5 mr-1.5" /> Criar Acordo de Dívida
                </Button>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(t); setOpen(true); }}>
                      <Pencil className="size-3.5 mr-1.5" />Editar
                    </Button>
                  </DialogTrigger>
                </Dialog>
                {t.phone && <WhatsAppLinkButton tenant={t} />}
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!confirm("Excluir este inquilino?")) return;
                  const { error } = await supabase.from("tenants").delete().eq("id", t.id);
                  if (error) return toast.error(error.message);
                  toast.success("Inquilino excluído");
                }}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {agreementFor && (
        <DebtAgreementDialog
          open={!!agreementFor}
          onOpenChange={(o) => !o && setAgreementFor(null)}
          tenantId={agreementFor.id}
          tenantName={agreementFor.full_name}
          overdue={overdueByTenant.get(agreementFor.id) || []}
        />
      )}
    </div>
  );
}

function TenantDialog({ editing, onDone }: { editing: Tenant | null; onDone: () => void }) {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const [form, setForm] = useState({
    full_name: editing?.full_name ?? "",
    document: editing?.document ?? "",
    email: editing?.email ?? "",
    phone: editing?.phone ?? "",
    emergency_contact: editing?.emergency_contact ?? "",
    notes: editing?.notes ?? "",
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Editar inquilino" : "Novo inquilino"}</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user) return;
          const payload: any = {
            user_id: user.id,
            full_name: form.full_name,
            document: form.document || null,
            email: form.email || null,
            phone: form.phone || null,
            emergency_contact: form.emergency_contact || null,
            notes: form.notes || null,
          };
          const isNew = !editing;
          const { data: saved, error } = editing
            ? await supabase.from("tenants").update(payload).eq("id", editing.id).select().single()
            : await supabase.from("tenants").insert(payload).select().single();
          if (error) return toast.error(error.message);
          toast.success(editing ? "Inquilino atualizado" : "Inquilino cadastrado");
          invalidate(["tenants"]);

          // Convites e mensagens devem ser enviados manualmente pelo botão de WhatsApp do card.
          onDone();
        }}
      >
        <div className="space-y-2"><Label>Nome completo *</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2"><Label>CPF / CNPJ</Label><Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: maskCpfCnpj(e.target.value) })} placeholder="000.000.000-00" inputMode="numeric" /></div>
          <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(41) 99999-9999" inputMode="tel" /></div>
        </div>
        <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-2"><Label>Contato de emergência</Label><Input value={form.emergency_contact ?? ""} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Nome e telefone" /></div>
        <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <DialogFooter><Button type="submit">{editing ? "Salvar" : "Cadastrar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function WhatsAppLinkButton({ tenant }: { tenant: Tenant }) {
  if (!tenant.phone) return null;
  const msg = `Olá, ${tenant.full_name}! Sou da imobiliária e gostaria de falar com você.`;
  return (
    <Button asChild variant="outline" size="sm" title={`Abrir WhatsApp de ${tenant.full_name}`}>
      <a href={waLink(tenant.phone, msg)} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-3.5" />
      </a>
    </Button>
  );
}
