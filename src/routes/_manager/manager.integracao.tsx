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
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_manager/manager/integracao")({
  head: () => ({ meta: [{ title: "Integração Financeira — NEXO Imobiliária" }] }),
  component: ManagerIntegracao,
});

const NEXO_FEE = 24.99; // R$ por boleto/Pix gerado
const STORAGE_KEY = "nexo:manager:bank-info";

type BankInfo = {
  legalName: string;
  document: string;
  phone: string;
  bank: string;
  agency: string;
  account: string;
  accountType: "corrente" | "poupanca" | "";
};

const emptyBank: BankInfo = {
  legalName: "", document: "", phone: "",
  bank: "", agency: "", account: "", accountType: "",
};

function ManagerIntegracao() {
  const fetchAccount = useServerFn(getAsaasAccount);
  const submit = useServerFn(createAsaasSubaccount);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["asaas-account"],
    queryFn: () => fetchAccount(),
  });
  const account = data?.account;

  const [bank, setBank] = useState<BankInfo>(emptyBank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setBank({ ...emptyBank, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const status = !account
    ? { key: "pendente", label: "Pendente de Configuração", className: "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700", icon: Clock }
    : account.status === "active"
    ? { key: "ativa", label: "Conta Ativa e Pronta para Receber", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400", icon: CheckCircle2 }
    : { key: "analise", label: "Em Análise pelo Asaas", className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400", icon: Clock };
  const StatusIcon = status.icon;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Persistir dados bancários localmente (Asaas usa endpoint próprio para conta)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));

      if (!account) {
        await submit({
          data: {
            name: bank.legalName,
            email: "",
            cpfCnpj: bank.document,
            mobilePhone: bank.phone,
          } as any,
        });
        toast.success("Dados enviados com sucesso! Sua subconta está sendo criada.");
        await refetch();
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
              <p className="text-lg font-semibold mt-1">{formatBRL(NEXO_FEE)} <span className="text-xs font-normal text-muted-foreground">por parcela</span></p>
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
            <Field label="CNPJ / CPF" required>
              <Input value={bank.document} onChange={(e) => setBank({ ...bank, document: e.target.value })} required maxLength={20} placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Telefone" required>
              <Input value={bank.phone} onChange={(e) => setBank({ ...bank, phone: e.target.value })} required maxLength={20} placeholder="(11) 99999-9999" />
            </Field>
            <Field label="Banco" required>
              <Input value={bank.bank} onChange={(e) => setBank({ ...bank, bank: e.target.value })} required maxLength={80} placeholder="Ex.: Banco do Brasil" />
            </Field>
            <Field label="Agência" required>
              <Input value={bank.agency} onChange={(e) => setBank({ ...bank, agency: e.target.value })} required maxLength={10} />
            </Field>
            <Field label="Número da Conta" required>
              <Input value={bank.account} onChange={(e) => setBank({ ...bank, account: e.target.value })} required maxLength={20} />
            </Field>
            <Field label="Tipo de Conta" required>
              <Select value={bank.accountType} onValueChange={(v) => setBank({ ...bank, accountType: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Conta Corrente</SelectItem>
                  <SelectItem value="poupanca">Conta Poupança</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                {account ? "Atualizar dados bancários" : "Enviar para análise Asaas"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
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
