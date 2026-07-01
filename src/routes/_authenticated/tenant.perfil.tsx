import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Save, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentTenant } from "@/lib/tenant-queries";
import { useAuth } from "@/lib/auth";
import { updateTenantProfile } from "@/lib/tenant-profile.functions";
import { maskCpfCnpj, maskPhone, onlyDigits } from "@/lib/br-validators";

export const Route = createFileRoute("/_authenticated/tenant/perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — Nexo Inquilino" }] }),
  component: TenantPerfil,
});

function TenantPerfil() {
  const { user } = useAuth();
  const { data: tenant, isLoading } = useCurrentTenant();
  const qc = useQueryClient();
  const update = useServerFn(updateTenantProfile);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    document: "",
    emergency_contact: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setForm({
      full_name: tenant.full_name ?? "",
      email: tenant.email ?? "",
      phone: tenant.phone ? maskPhone(tenant.phone) : "",
      document: tenant.document ? maskCpfCnpj(tenant.document) : "",
      emergency_contact: tenant.emergency_contact ?? "",
    });
  }, [tenant?.id]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await update({
        data: {
          full_name: form.full_name,
          email: form.email,
          phone: onlyDigits(form.phone),
          document: onlyDigits(form.document),
          emergency_contact: form.emergency_contact,
        },
      });
      await qc.invalidateQueries({ queryKey: ["tenant-self"] });
      toast.success("Perfil atualizado com sucesso.");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary/10 grid place-items-center">
          <User className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Meu Perfil</h1>
          <p className="text-xs text-muted-foreground">
            Mantenha seus dados atualizados. Eles são usados para cobrança e contato.
          </p>
        </div>
      </header>

      <Card className="p-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : !tenant ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cadastro de inquilino vinculado à sua conta ({user?.email}). Contate a imobiliária.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                required
                minLength={3}
                maxLength={120}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="document">CPF / CNPJ</Label>
                <Input
                  id="document"
                  value={form.document}
                  onChange={(e) => setForm((f) => ({ ...f, document: maskCpfCnpj(e.target.value) }))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
                <p className="text-[11px] text-muted-foreground">
                  Usado para emissão de boleto. Precisa ser válido.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone (com DDD)</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="voce@exemplo.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="emergency_contact">Contato de emergência</Label>
              <Textarea
                id="emergency_contact"
                value={form.emergency_contact}
                onChange={(e) => setForm((f) => ({ ...f, emergency_contact: e.target.value }))}
                placeholder="Nome e telefone de alguém para contato em emergências."
                rows={3}
                maxLength={200}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                Salvar alterações
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
