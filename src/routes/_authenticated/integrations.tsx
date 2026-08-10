import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, Wallet, ShieldCheck, Sparkles, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getAsaasAccount,
  startAsaasCadastro,
} from "@/lib/asaas.functions";
import { AsaasBankAndKycPanel } from "@/components/AsaasBankAndKycPanel";
import { PixSplitConfigPanel } from "@/components/PixSplitConfigPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

const BR_BANKS: Array<{ code: string; name: string }> = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú Unibanco" },
  { code: "260", name: "Nubank" },
  { code: "077", name: "Banco Inter" },
  { code: "212", name: "Banco Original" },
  { code: "336", name: "C6 Bank" },
  { code: "208", name: "BTG Pactual" },
  { code: "748", name: "Sicredi" },
  { code: "756", name: "Sicoob" },
  { code: "422", name: "Safra" },
  { code: "655", name: "Votorantim" },
  { code: "070", name: "BRB" },
  { code: "041", name: "Banrisul" },
  { code: "389", name: "Banco Mercantil do Brasil" },
  { code: "246", name: "Banco ABC Brasil" },
  { code: "623", name: "Banco PAN" },
  { code: "707", name: "Banco Daycoval" },
  { code: "136", name: "Unicred" },
  { code: "197", name: "Stone" },
  { code: "323", name: "Mercado Pago" },
  { code: "380", name: "PicPay" },
  { code: "335", name: "Banco Digio" },
  { code: "290", name: "PagSeguro / PagBank" },
  { code: "364", name: "Gerencianet (Efí)" },
  { code: "461", name: "Asaas" },
];

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Saldo e Saque — Nexo" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { user } = useAuth();
  const fetchAccount = useServerFn(getAsaasAccount);
  const startCadastro = useServerFn(startAsaasCadastro);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["asaas-account", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchAccount(),
  });

  const account = data?.account as any;
  const hasAccount = !!account?.asaas_account_id;
  const [opening, setOpening] = useState(false);

  async function handleOpenCadastro() {
    setOpening(true);
    try {
      const res: any = await startCadastro();
      if (!res?.onboardingUrl) throw new Error("URL do cadastro indisponível.");
      window.open(res.onboardingUrl, "_blank", "noopener,noreferrer");
      if (res.sandboxFallback) {
        toast.info("Sandbox do Asaas aprovou a subconta automaticamente. Abrindo o painel Sandbox para simular o fluxo.", { duration: 7000 });
      } else if (!res.reused) {
        toast.success("Subconta criada! Complete o cadastro no painel Asaas que abrimos em uma nova aba.");
      } else {
        toast.success("Abrindo seu cadastro Asaas em uma nova aba.");
      }
      await refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao abrir o cadastro Asaas.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Saldo e Saque</h1>
        <p className="text-muted-foreground mt-1">
          Conecte sua conta de recebimento Asaas para emitir boletos, Pix e configurar os repasses automáticos.
        </p>
      </header>

      <Card className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Wallet className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Asaas</h2>
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

        {/* Botão Cadastro Asaas no topo */}
        <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-violet-500/20 text-violet-700 dark:text-violet-300">
              <Sparkles className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">
                  {hasAccount ? "Continuar cadastro no Asaas" : "Cadastro 100% no Asaas"}
                </h3>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 text-[10px]">
                  <Lock className="size-2.5" /> Seguro
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {hasAccount
                  ? "Reabra o painel hospedado do Asaas para revisar dados, banco, documentos e selfie."
                  : "Endereço, dados bancários, contrato social, documentos e selfie são preenchidos diretamente no painel hospedado do Asaas. Sem upload no Nexo."}
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenCadastro}
            disabled={opening}
            className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_28px_-8px_rgb(139_92_246)]"
          >
            {opening ? <Loader2 className="size-4 mr-2 animate-spin" /> : <ShieldCheck className="size-4 mr-2" />}
            {hasAccount ? "Abrir painel Asaas" : "Abrir cadastro Asaas"}
            <ExternalLink className="size-3.5 ml-2" />
          </Button>
        </div>

        {isLoading ? (
          <div className="py-8 grid place-items-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            {hasAccount && (
              <div className="grid sm:grid-cols-2 gap-3 text-sm rounded-lg border bg-muted/30 p-4">
                <Row label="ID da subconta" value={account.asaas_account_id} mono />
                <Row label="Wallet ID" value={account.wallet_id ?? "—"} mono />
                <Row label="Status" value={account.status ?? "—"} />
                <Row label="KYC" value={account.kyc_status ?? "PENDENTE"} />
              </div>
            )}

            <Alert className="border-dashed">
              <AlertTitle className="text-sm">Os campos abaixo são informativos</AlertTitle>
              <AlertDescription className="text-xs">
                Toda edição é feita no painel hospedado do Asaas (botão acima). Quando o cadastro for concluído,
                os dados aparecerão aqui automaticamente.
              </AlertDescription>
            </Alert>

            <fieldset disabled className="grid sm:grid-cols-2 gap-4 opacity-70">
              <Field label="Razão social / Nome">
                <Input value={account?.name ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>
              <Field label="E-mail">
                <Input value={account?.email ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>
              <Field label="CPF / CNPJ">
                <Input value={account?.cpf_cnpj ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>
              <Field label="Celular">
                <Input value={account?.mobile_phone ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>
              <Field label="Renda / Faturamento mensal (R$)">
                <Input value={account?.income_value ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>
              <Field label="Data de nascimento (PF)">
                <Input value={account?.birth_date ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>
              <Field label="CEP">
                <Input value={account?.postal_code ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>
              <Field label="Bairro">
                <Input value={account?.province ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>
              <Field label="Endereço">
                <Input value={account?.address ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>
              <Field label="Número">
                <Input value={account?.address_number ?? ""} readOnly disabled placeholder="Preenchido no Asaas" />
              </Field>

              <div className="sm:col-span-2 mt-2 pt-4 border-t">
                <h3 className="font-semibold mb-1">Conta bancária para recebimento</h3>
                <p className="text-xs text-muted-foreground">
                  Cadastrada e validada no painel Asaas.
                </p>
              </div>
              <Field label="Banco">
                <Select value={account?.bank_code ?? ""} disabled>
                  <SelectTrigger><SelectValue placeholder="Cadastrado no Asaas" /></SelectTrigger>
                  <SelectContent>
                    {BR_BANKS.map((b) => (
                      <SelectItem key={b.code} value={b.code}>{b.code} — {b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="CPF/CNPJ do titular da conta">
                <Input value={account?.bank_owner_cpf_cnpj ?? ""} readOnly disabled placeholder="Cadastrado no Asaas" />
              </Field>
              <Field label="Tipo de conta">
                <Select value={account?.bank_account_type ?? ""} disabled>
                  <SelectTrigger><SelectValue placeholder="Cadastrado no Asaas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTA_CORRENTE">Conta Corrente</SelectItem>
                    <SelectItem value="CONTA_POUPANCA">Conta Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Agência (sem dígito)">
                <Input value={account?.bank_agency ?? ""} readOnly disabled placeholder="Cadastrado no Asaas" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <Field label="Conta">
                  <Input value={account?.bank_account ?? ""} readOnly disabled placeholder="Cadastrado no Asaas" />
                </Field>
                <Field label="Dígito">
                  <Input className="sm:w-24" value={account?.bank_account_digit ?? ""} readOnly disabled placeholder="—" />
                </Field>
              </div>
            </fieldset>
          </>
        )}
      </Card>

      <AsaasBankAndKycPanel account={account as any} onChanged={() => refetch()} />

      <PixSplitConfigPanel />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={mono ? "font-mono text-xs break-all text-right" : "text-xs text-right"}>{value}</span>
    </div>
  );
}
