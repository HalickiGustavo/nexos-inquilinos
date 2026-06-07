import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createAsaasSubaccount,
  getAsaasAccount,
} from "@/lib/asaas.functions";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrações — Nexo" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const fetchAccount = useServerFn(getAsaasAccount);
  const submit = useServerFn(createAsaasSubaccount);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["asaas-account"],
    queryFn: () => fetchAccount(),
  });

  const account = data?.account;

  const [form, setForm] = useState({
    name: "",
    email: "",
    cpfCnpj: "",
    mobilePhone: "",
    address: "",
    addressNumber: "",
    province: "",
    postalCode: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) setSaving(false);
  }, [account]);

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground mt-1">
          Conecte sua conta Asaas para emitir boletos e Pix automaticamente.
        </p>
      </header>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Wallet className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Asaas (Sandbox)</h2>
              <p className="text-sm text-muted-foreground">
                Gerador de boletos, Pix e split automático para o Nexo.
              </p>
            </div>
          </div>
          {account?.status === "active" ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">
              <CheckCircle2 className="size-3 mr-1" /> Conectado
            </Badge>
          ) : account ? (
            <Badge variant="secondary">Pendente</Badge>
          ) : null}
        </div>

        {isLoading ? (
          <div className="py-8 grid place-items-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : account?.asaas_account_id ? (
          <div className="mt-5 space-y-3 text-sm">
            <Row label="ID da subconta" value={account.asaas_account_id} mono />
            <Row label="Wallet ID" value={account.wallet_id ?? "—"} mono />
            <Row label="Status" value={account.status} />
            {account.onboarding_url && (
              <Button asChild variant="outline" className="mt-2">
                <a href={account.onboarding_url} target="_blank" rel="noreferrer">
                  Completar onboarding KYC <ExternalLink className="size-3.5 ml-2" />
                </a>
              </Button>
            )}
          </div>
        ) : (
          <form
            className="mt-6 grid sm:grid-cols-2 gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                const res = await submit({ data: form });
                toast.success("Subconta criada!");
                if (res.onboardingUrl) {
                  toast.info("Complete o onboarding KYC no Asaas.");
                }
                await refetch();
              } catch (err: any) {
                toast.error(err?.message ?? "Falha ao criar subconta");
                setSaving(false);
              }
            }}
          >
            <Field label="Razão social / Nome" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="E-mail" required>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field label="CPF / CNPJ" required>
              <Input value={form.cpfCnpj} onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })} required />
            </Field>
            <Field label="Celular">
              <Input value={form.mobilePhone} onChange={(e) => setForm({ ...form, mobilePhone: e.target.value })} placeholder="(11) 99999-9999" />
            </Field>
            <Field label="CEP" required>
              <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} required />
            </Field>
            <Field label="Bairro" required>
              <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} required />
            </Field>
            <Field label="Endereço" required>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </Field>
            <Field label="Número" required>
              <Input value={form.addressNumber} onChange={(e) => setForm({ ...form, addressNumber: e.target.value })} required />
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                Conectar Asaas
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="p-6 bg-muted/30">
        <h3 className="font-semibold mb-2">Configuração do Webhook</h3>
        <p className="text-sm text-muted-foreground mb-3">
          No painel Asaas → Configurações → Notificações → Webhooks, cadastre a URL abaixo
          e cole o token salvo nos secrets (ASAAS_WEBHOOK_TOKEN) no campo Token.
        </p>
        <code className="block text-xs bg-background p-3 rounded border break-all">
          {typeof window !== "undefined" ? window.location.origin : ""}/api/public/asaas-webhook
        </code>
      </Card>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs break-all" : ""}>{value}</span>
    </div>
  );
}
