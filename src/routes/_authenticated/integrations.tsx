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
import { AsaasBankAndKycPanel } from "@/components/AsaasBankAndKycPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maskCpfCnpj, maskPhone, maskCEP } from "@/lib/br-validators";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Saldo e Saque — Nexo" }] }),
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
    companyType: "" as "" | "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION",
    birthDate: "",
    address: "",
    addressNumber: "",
    province: "",
    postalCode: "",
    incomeValue: "",
    bankCode: "",
    bankAgency: "",
    bankAccount: "",
    bankAccountDigit: "",
    bankAccountType: "CONTA_CORRENTE" as "CONTA_CORRENTE" | "CONTA_POUPANCA",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) setSaving(false);
  }, [account]);

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Saldo e Saque</h1>
        <p className="text-muted-foreground mt-1">
          Conecte sua conta de recebimento para emitir boletos e Pix e configurar os repasses automáticos.
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
                const payload: any = { ...form };
                if (!payload.companyType) delete payload.companyType;
                if (!payload.birthDate) delete payload.birthDate;
                payload.incomeValue = Number(form.incomeValue);
                const res = await submit({ data: payload });
                toast.success("Subconta criada!");
                if (res.bankWarning) {
                  toast.warning(`Conta bancária: ${res.bankWarning}`);
                }
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
              <Input value={form.cpfCnpj} onChange={(e) => setForm({ ...form, cpfCnpj: maskCpfCnpj(e.target.value) })} required placeholder="000.000.000-00" inputMode="numeric" />
            </Field>
            <Field label="Tipo de empresa" required>
              <Select
                value={form.companyType}
                onValueChange={(v) => setForm({ ...form, companyType: v as any })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDUAL">Pessoa Física</SelectItem>
                  <SelectItem value="MEI">MEI</SelectItem>
                  <SelectItem value="LIMITED">LTDA / Limitada</SelectItem>
                  <SelectItem value="ASSOCIATION">Associação</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Celular" required>
              <Input value={form.mobilePhone} onChange={(e) => setForm({ ...form, mobilePhone: maskPhone(e.target.value) })} placeholder="(41) 99999-9999" inputMode="tel" required />
            </Field>
            <Field label="Renda / Faturamento mensal (R$)" required>
              <Input type="number" min="1" step="0.01" value={form.incomeValue} onChange={(e) => setForm({ ...form, incomeValue: e.target.value })} placeholder="5000" required />
            </Field>
            <Field label="Data de nascimento (PF)">
              <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </Field>
            <Field label="CEP" required>
              <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: maskCEP(e.target.value) })} required placeholder="00000-000" inputMode="numeric" />
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
            <div className="sm:col-span-2 mt-2 pt-4 border-t">
              <h3 className="font-semibold mb-1">Conta bancária para recebimento</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Para onde o Asaas vai transferir o saldo automaticamente todo dia útil.
              </p>
            </div>
            <Field label="Código do banco (Febraban)" required>
              <Input value={form.bankCode} onChange={(e) => setForm({ ...form, bankCode: e.target.value.replace(/\D/g, "") })} placeholder="Ex.: 341 (Itaú), 001 (BB)" inputMode="numeric" maxLength={4} required />
            </Field>
            <Field label="Tipo de conta" required>
              <Select value={form.bankAccountType} onValueChange={(v) => setForm({ ...form, bankAccountType: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTA_CORRENTE">Conta Corrente</SelectItem>
                  <SelectItem value="CONTA_POUPANCA">Conta Poupança</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Agência (sem dígito)" required>
              <Input value={form.bankAgency} onChange={(e) => setForm({ ...form, bankAgency: e.target.value.replace(/\D/g, "") })} inputMode="numeric" maxLength={10} required />
            </Field>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Field label="Conta" required>
                <Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value.replace(/\D/g, "") })} inputMode="numeric" maxLength={20} required />
              </Field>
              <Field label="Dígito" required>
                <Input value={form.bankAccountDigit} onChange={(e) => setForm({ ...form, bankAccountDigit: e.target.value.replace(/\D/g, "") })} inputMode="numeric" maxLength={2} required />
              </Field>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                Conectar Asaas
              </Button>
            </div>
          </form>
        )}
      </Card>

      <AsaasBankAndKycPanel account={account as any} onChanged={() => refetch()} />


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
