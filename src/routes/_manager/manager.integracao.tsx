import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, ShieldCheck, Wallet, Building2, Banknote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAsaasSubaccount, getAsaasAccount, getNexoFeeSetting } from "@/lib/asaas.functions";
import { AsaasBankAndKycPanel } from "@/components/AsaasBankAndKycPanel";
import { formatBRL } from "@/lib/format";
import { maskCpfCnpj, maskPhone } from "@/lib/br-validators";

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
  { code: "623", name: "Banco PAN" },
  { code: "707", name: "Banco Daycoval" },
  { code: "323", name: "Mercado Pago" },
  { code: "380", name: "PicPay" },
  { code: "290", name: "PagSeguro / PagBank" },
  { code: "461", name: "Asaas" },
];

export const Route = createFileRoute("/_manager/manager/integracao")({
  head: () => ({ meta: [{ title: "Integração Financeira — NEXO Imobiliária" }] }),
  component: ManagerIntegracao,
});

// Bank info is NEVER persisted to localStorage — sensitive PII (CPF/CNPJ, phone, account)
// must only travel through the server-side Asaas integration.

type BankInfo = {
  legalName: string;
  email: string;
  document: string;
  phone: string;
  incomeValue: string;
  postalCode: string;
  province: string;
  address: string;
  addressNumber: string;
  bankCode: string;
  bankOwnerCpfCnpj: string;
  agency: string;
  account: string;
  accountDigit: string;
  accountType: "CONTA_CORRENTE" | "CONTA_POUPANCA";
};

const emptyBank: BankInfo = {
  legalName: "", email: "", document: "", phone: "", incomeValue: "",
  postalCode: "", province: "", address: "", addressNumber: "",
  bankCode: "", bankOwnerCpfCnpj: "", agency: "", account: "", accountDigit: "", accountType: "CONTA_CORRENTE",
};

function ManagerIntegracao() {
  const fetchAccount = useServerFn(getAsaasAccount);
  const fetchFee = useServerFn(getNexoFeeSetting);
  const submit = useServerFn(createAsaasSubaccount);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["asaas-account"],
    queryFn: () => fetchAccount(),
  });
  const { data: feeData } = useQuery({
    queryKey: ["nexo-fee-setting"],
    queryFn: () => fetchFee(),
  });
  const account = data?.account;
  const nexoFee = feeData?.fee ?? 24.99;

  const [bank, setBank] = useState<BankInfo>(emptyBank);
  const [saving, setSaving] = useState(false);

  const status = !account
    ? { key: "pendente", label: "Pendente de Configuração", className: "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700", icon: Clock }
    : account.status === "active"
    ? { key: "ativa", label: "Conta Ativa e Pronta para Receber", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400", icon: CheckCircle2 }
    : { key: "analise", label: "Em Análise pelo Asaas", className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400", icon: Clock };
  const StatusIcon = status.icon;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredBank = [bank.bankCode, bank.bankOwnerCpfCnpj, bank.agency, bank.account, bank.accountDigit, bank.accountType];
    if (requiredBank.some((value) => !String(value).trim())) {
      toast.error("Preencha todos os dados bancários antes de enviar.");
      return;
    }
    setSaving(true);
    try {
      if (!account) {
        const res = await submit({
          data: {
            name: bank.legalName,
            email: bank.email,
            cpfCnpj: bank.document,
            mobilePhone: bank.phone,
            incomeValue: Number(bank.incomeValue),
            address: bank.address,
            addressNumber: bank.addressNumber,
            province: bank.province,
            postalCode: bank.postalCode,
            bankCode: bank.bankCode,
            bankOwnerCpfCnpj: bank.bankOwnerCpfCnpj,
            bankAgency: bank.agency,
            bankAccount: bank.account,
            bankAccountDigit: bank.accountDigit,
            bankAccountType: bank.accountType,
          },
        });
        toast.success("Subconta criada com sucesso!");
        if (res.bankWarning) toast.warning(`Conta bancária: ${res.bankWarning}`);
        await refetch();
        setBank(emptyBank);
      } else {
        toast.success("Dados bancários atualizados com sucesso!");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao enviar dados");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configuração da Conta / Split</h1>
        <p className="text-muted-foreground mt-1">
          Ative o gateway financeiro Asaas para emissão de boletos, Pix e split automático.
        </p>
      </header>

      {/* Status Widget */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Wallet className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Asaas — Gateway de Pagamentos</h2>
                <p className="text-sm text-muted-foreground">
                  Subconta dedicada com split automático para a NEXO.
                </p>
              </div>
            </div>
            <Badge variant="outline" className={`border ${status.className} px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5`}>
              <StatusIcon className="size-3.5" /> {status.label}
            </Badge>
          </div>

          {isLoading ? (
            <div className="py-6 grid place-items-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : account ? (
            <div className="mt-5 grid sm:grid-cols-2 gap-3 text-sm">
              <Row label="ID da subconta" value={account.asaas_account_id ?? "—"} mono />
              <Row label="Wallet ID" value={account.wallet_id ?? "—"} mono />
            </div>
          ) : (
            <Alert className="mt-5">
              <ShieldCheck className="size-4" />
              <AlertTitle>Conta ainda não configurada</AlertTitle>
              <AlertDescription>
                Preencha os dados abaixo para iniciar a criação da subconta no Asaas.
                A análise de cadastro é feita pelo Asaas em até 1 dia útil.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Split preview */}
      <Card className="bg-muted/30">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Banknote className="size-4 text-primary" />
            <h3 className="font-semibold">Split Automático Ativo</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            A cada parcela emitida, o valor é distribuído automaticamente entre sua subconta e a NEXO.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sua subconta (Imobiliária)</p>
              <p className="text-lg font-semibold mt-1">Valor do aluguel + taxas</p>
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">NEXO — Taxa de Serviço Digital</p>
              <p className="text-lg font-semibold mt-1">{formatBRL(nexoFee)} <span className="text-xs font-normal text-muted-foreground">por parcela</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Form */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="size-4 text-primary" />
            <h3 className="font-semibold">Dados Cadastrais e Bancários</h3>
          </div>
          <form className="grid sm:grid-cols-2 gap-4" onSubmit={onSubmit}>
            <Field label="Razão Social / Nome" required>
              <Input value={bank.legalName} onChange={(e) => setBank({ ...bank, legalName: e.target.value })} required maxLength={120} />
            </Field>
            <Field label="E-mail" required>
              <Input type="email" value={bank.email} onChange={(e) => setBank({ ...bank, email: e.target.value })} required maxLength={120} />
            </Field>
            <Field label="CNPJ / CPF" required>
              <Input value={bank.document} onChange={(e) => setBank({ ...bank, document: maskCpfCnpj(e.target.value) })} required maxLength={20} placeholder="00.000.000/0000-00" inputMode="numeric" />
            </Field>
            <Field label="Telefone (celular)" required>
              <Input value={bank.phone} onChange={(e) => setBank({ ...bank, phone: maskPhone(e.target.value) })} required maxLength={20} placeholder="(41) 99999-9999" inputMode="tel" />
            </Field>
            <Field label="Faturamento mensal (R$)" required>
              <Input type="number" min="1" step="0.01" value={bank.incomeValue} onChange={(e) => setBank({ ...bank, incomeValue: e.target.value })} placeholder="10000" required />
            </Field>
            <Field label="CEP" required>
              <Input value={bank.postalCode} onChange={(e) => setBank({ ...bank, postalCode: e.target.value })} required maxLength={15} placeholder="00000-000" inputMode="numeric" />
            </Field>
            <Field label="Bairro" required>
              <Input value={bank.province} onChange={(e) => setBank({ ...bank, province: e.target.value })} required maxLength={120} />
            </Field>
            <Field label="Endereço" required>
              <Input value={bank.address} onChange={(e) => setBank({ ...bank, address: e.target.value })} required maxLength={200} />
            </Field>
            <Field label="Número" required>
              <Input value={bank.addressNumber} onChange={(e) => setBank({ ...bank, addressNumber: e.target.value })} required maxLength={20} />
            </Field>

            <div className="sm:col-span-2 mt-2 pt-4 border-t">
              <h4 className="font-semibold mb-1">Conta bancária de recebimento</h4>
              <p className="text-xs text-muted-foreground">
                Para evitar cadastro parcial no Asaas, todos os dados bancários abaixo são obrigatórios.
              </p>
            </div>
            <Field label="Banco" required>
              <Select value={bank.bankCode} onValueChange={(v) => setBank({ ...bank, bankCode: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                <SelectContent>
                  {BR_BANKS.map((b) => (
                    <SelectItem key={b.code} value={b.code}>{b.code} — {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="CPF/CNPJ do titular da conta" required>
              <Input value={bank.bankOwnerCpfCnpj} onChange={(e) => setBank({ ...bank, bankOwnerCpfCnpj: maskCpfCnpj(e.target.value) })} maxLength={20} placeholder="000.000.000-00" inputMode="numeric" required />
            </Field>
            <Field label="Tipo de Conta" required>
              <Select value={bank.accountType} onValueChange={(v) => setBank({ ...bank, accountType: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTA_CORRENTE">Conta Corrente</SelectItem>
                  <SelectItem value="CONTA_POUPANCA">Conta Poupança</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Agência (sem dígito)" required>
              <Input value={bank.agency} onChange={(e) => setBank({ ...bank, agency: e.target.value.replace(/\D/g, "") })} maxLength={10} inputMode="numeric" required />
            </Field>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Field label="Conta" required>
                <Input value={bank.account} onChange={(e) => setBank({ ...bank, account: e.target.value.replace(/\D/g, "") })} maxLength={20} inputMode="numeric" required />
              </Field>
              <Field label="Dígito" required>
                <Input value={bank.accountDigit} onChange={(e) => setBank({ ...bank, accountDigit: e.target.value.replace(/\D/g, "") })} maxLength={2} inputMode="numeric" required />
              </Field>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving || !!account}>
                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                {account ? "Subconta já criada" : "Enviar para análise Asaas"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Conta bancária + KYC pass-through */}
      <AsaasBankAndKycPanel account={account as any} onChanged={() => refetch()} />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value}</span>
    </div>
  );
}
