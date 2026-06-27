import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, ShieldAlert, Landmark, FileCheck2, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { linkAsaasBankAccount, getAsaasOnboardingLinks } from "@/lib/asaas.functions";
import { maskCpfCnpj } from "@/lib/br-validators";

// Lista enxuta dos principais bancos brasileiros (código COMPE/ISPB do Asaas)
const BANKS: Array<{ code: string; label: string }> = [
  { code: "001", label: "001 — Banco do Brasil" },
  { code: "033", label: "033 — Santander" },
  { code: "104", label: "104 — Caixa Econômica" },
  { code: "237", label: "237 — Bradesco" },
  { code: "341", label: "341 — Itaú" },
  { code: "260", label: "260 — Nubank" },
  { code: "077", label: "077 — Inter" },
  { code: "212", label: "212 — Banco Original" },
  { code: "336", label: "336 — C6 Bank" },
  { code: "208", label: "208 — BTG Pactual" },
  { code: "748", label: "748 — Sicredi" },
  { code: "756", label: "756 — Sicoob" },
  { code: "422", label: "422 — Safra" },
  { code: "655", label: "655 — Votorantim" },
];

type Account = {
  user_id?: string | null;
  kyc_status?: string | null;
  bank_code?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_digit?: string | null;
  bank_account_type?: string | null;
  auto_transfer_enabled?: boolean | null;
  api_key?: string | null;
  asaas_account_id?: string | null;
  onboarding_url?: string | null;
};

export function AsaasBankAndKycPanel({
  account,
  onChanged,
}: {
  account: Account | null | undefined;
  onChanged?: () => Promise<unknown> | void;
}) {
  const hasSubaccount = !!account?.asaas_account_id;
  return (
    <div className="space-y-6">
      <KycStatusBadge status={account?.kyc_status ?? "PENDENTE"} />
      {!hasSubaccount ? (
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>Conclua o cadastro Asaas primeiro</AlertTitle>
          <AlertDescription>
            Use o botão "Abrir cadastro Asaas" para finalizar dados, banco, documentos e selfie no painel oficial.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertTitle>Dados bancários gerenciados no Asaas</AlertTitle>
          <AlertDescription>
            A conta bancária de liquidação é cadastrada e mantida diretamente no painel hospedado do Asaas (cadastro.io).
            Use o botão "Abrir cadastro Asaas" / "Abrir painel Asaas" acima para revisar ou alterar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}


function KycStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; Icon: typeof Clock }> = {
    PENDENTE: { label: "Verificação Pendente", className: "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700", Icon: Clock },
    EM_ANALISE: { label: "Verificação em Análise", className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400", Icon: Clock },
    APROVADO: { label: "Verificação Aprovada", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400", Icon: CheckCircle2 },
    REJEITADO: { label: "Verificação Rejeitada", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: ShieldAlert },
  };
  const s = map[status] ?? map.PENDENTE;
  const Icon = s.Icon;
  return (
    <Badge variant="outline" className={`border ${s.className} px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5`}>
      <Icon className="size-3.5" /> {s.label}
    </Badge>
  );
}

function BankSection({ account, onChanged }: { account: Account; onChanged?: () => Promise<unknown> | void }) {
  const link = useServerFn(linkAsaasBankAccount);
  const [saving, setSaving] = useState(false);
  const isLocked = !!(account.bank_code && account.bank_account && account.bank_agency);
  const [form, setForm] = useState({
    ownerCpfCnpj: "",
    bankCode: account.bank_code ?? "",
    agency: account.bank_agency ?? "",
    account: account.bank_account ?? "",
    accountDigit: account.bank_account_digit ?? "",
    accountType: (account.bank_account_type as "CONTA_CORRENTE" | "CONTA_POUPANCA" | "") ?? "",
    enableAutoTransfer: account.auto_transfer_enabled ?? true,
  });

  useEffect(() => {
    setForm({
      ownerCpfCnpj: "",
      bankCode: account.bank_code ?? "",
      agency: account.bank_agency ?? "",
      account: account.bank_account ?? "",
      accountDigit: account.bank_account_digit ?? "",
      accountType: (account.bank_account_type as "CONTA_CORRENTE" | "CONTA_POUPANCA" | "") ?? "",
      enableAutoTransfer: account.auto_transfer_enabled ?? true,
    });
  }, [account.user_id, account.asaas_account_id, account.bank_code, account.bank_agency, account.bank_account, account.bank_account_digit, account.bank_account_type, account.auto_transfer_enabled]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="size-4 text-primary" />
          <h3 className="font-semibold">Conta Bancária de Liquidação</h3>
          {isLocked && (
            <Badge variant="outline" className="ml-auto border-emerald-500/40 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Validada
            </Badge>
          )}
        </div>
        {isLocked && (
          <Alert className="mb-4 border-emerald-500/30 bg-emerald-500/5">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertTitle>Dados bancários confirmados</AlertTitle>
            <AlertDescription>
              Por segurança, os dados bancários não podem ser editados após validação. Para alterar a conta, entre em contato com o suporte.
            </AlertDescription>
          </Alert>
        )}
        <form
          className="grid sm:grid-cols-2 gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!form.ownerCpfCnpj || !form.bankCode || !form.accountType) {
              toast.error("Informe o CPF/CNPJ do titular, banco e tipo de conta.");
              return;
            }
            setSaving(true);
            try {
              await link({
                data: {
                  ownerCpfCnpj: form.ownerCpfCnpj,
                  bankCode: form.bankCode,
                  agency: form.agency,
                  account: form.account,
                  accountDigit: form.accountDigit,
                  accountType: form.accountType as "CONTA_CORRENTE" | "CONTA_POUPANCA",
                  enableAutoTransfer: form.enableAutoTransfer,
                },
              });
              toast.success("Conta bancária vinculada com sucesso!");
              await onChanged?.();
            } catch (err: any) {
              toast.error(`Erro ao vincular conta: ${err?.message ?? "falha desconhecida"}`);
            } finally {
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={isLocked} className="contents">
          <div className="space-y-2 sm:col-span-2">
            <Label>CPF/CNPJ do titular da conta</Label>
            <Input
              value={form.ownerCpfCnpj}
              onChange={(e) => setForm({ ...form, ownerCpfCnpj: maskCpfCnpj(e.target.value) })}
              required
              maxLength={20}
              placeholder="000.000.000-00"
              inputMode="numeric"
              disabled={isLocked}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Banco</Label>
            <Select value={form.bankCode} onValueChange={(v) => setForm({ ...form, bankCode: v })} disabled={isLocked}>
              <SelectTrigger className="focus-visible:ring-primary focus-visible:ring-2"><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => <SelectItem key={b.code} value={b.code}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Agência</Label>
            <Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} required maxLength={10} inputMode="numeric" disabled={isLocked} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Conta</Label>
            <Select value={form.accountType} onValueChange={(v) => setForm({ ...form, accountType: v as any })} disabled={isLocked}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTA_CORRENTE">Conta Corrente</SelectItem>
                <SelectItem value="CONTA_POUPANCA">Conta Poupança</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Conta</Label>
            <Input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} required maxLength={20} inputMode="numeric" disabled={isLocked} />
          </div>
          <div className="space-y-2">
            <Label>Dígito</Label>
            <Input value={form.accountDigit} onChange={(e) => setForm({ ...form, accountDigit: e.target.value })} required maxLength={3} inputMode="numeric" disabled={isLocked} />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Transferência automática diária</p>
              <p className="text-xs text-muted-foreground">Fundos liberados são enviados automaticamente para sua conta bancária.</p>
            </div>
            <Switch checked={form.enableAutoTransfer} onCheckedChange={(v) => setForm({ ...form, enableAutoTransfer: v })} disabled={isLocked} />
          </div>
          {!isLocked && (
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving} className="focus-visible:ring-primary focus-visible:ring-2">
                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                Salvar dados bancários
              </Button>
            </div>
          )}
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function KycPanelSection({ account }: { account: Account; onChanged?: () => Promise<unknown> | void }) {
  const status = (account.kyc_status ?? "PENDENTE").toUpperCase();
  const approved = status === "APROVADO";
  const fetchLinks = useServerFn(getAsaasOnboardingLinks);
  const [items, setItems] = useState<Array<{ id: string; type: string; title: string; status: string; onboardingUrl: string | null }>>([]);
  const [generalUrl, setGeneralUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await fetchLinks();
      setItems(res?.items ?? []);
      setGeneralUrl(res?.generalOnboardingUrl ?? null);
      setLoaded(true);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao consultar documentos pendentes no Asaas.");
    } finally {
      setLoading(false);
    }
  }, [fetchLinks]);

  useEffect(() => {
    if (!approved) load();
  }, [approved, load]);

  const pending = items.filter((i) => (i.status ?? "").toUpperCase() !== "APPROVED");
  const withLinks = pending.filter((i) => !!i.onboardingUrl);

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      IDENTIFICATION: "Documento de identificação (RG/CNH)",
      IDENTIFICATION_SELFIE: "Selfie de identificação",
      SOCIAL_CONTRACT: "Contrato social",
      ENTREPRENEUR_REQUIREMENT: "Requerimento do empresário",
      MINUTES_OF_ELECTION: "Ata de eleição",
      CUSTOM: "Documento adicional",
    };
    return map[t] ?? t;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h3 className="font-semibold">Verificação de Identidade (KYC)</h3>
          </div>
          {!approved && (
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              <span className="ml-1.5 text-xs">Atualizar</span>
            </Button>
          )}
        </div>


        {approved ? (
          <Alert className="border-emerald-500/30 bg-emerald-500/5">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertTitle>Conta verificada</AlertTitle>
            <AlertDescription>
              Seus documentos foram aprovados pelo Asaas. Os repasses automáticos estão liberados.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              O envio de selfie e documento é feito em uma página segura do Asaas. Cada documento
              tem um link único — clique para abrir, fazer o upload e a prova de vida.
            </p>

            {loading && !loaded && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando links no Asaas...
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <ShieldAlert className="size-4" />
                <AlertTitle>Erro ao gerar links</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loaded && !error && pending.length === 0 && (
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertTitle>Documentos enviados</AlertTitle>
                <AlertDescription>
                  Todos os documentos foram enviados e estão em análise pelo Asaas (até 48h úteis).
                </AlertDescription>
              </Alert>
            )}

            {withLinks.length > 0 && (
              <div className="space-y-2">
                {withLinks.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{typeLabel(it.type)}</p>
                      <p className="text-xs text-muted-foreground">Status: {it.status}</p>
                    </div>
                    <Button asChild size="sm">
                      <a href={it.onboardingUrl!} target="_blank" rel="noreferrer noopener">
                        Abrir <ExternalLink className="size-3.5 ml-1.5" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {loaded && !error && pending.length > 0 && withLinks.length === 0 && generalUrl && (
              <Alert>
                <ShieldAlert className="size-4" />
                <AlertTitle>Use o painel geral do Asaas</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Esta subconta foi criada antes do recurso de link por documento. Use o
                    painel geral do Asaas abaixo para enviar a selfie e o documento de
                    identificação. Após a aprovação (até 48h úteis), o status será
                    atualizado aqui automaticamente.
                  </p>
                  <Button asChild size="sm">
                    <a href={generalUrl} target="_blank" rel="noreferrer noopener">
                      Abrir painel do Asaas <ExternalLink className="size-3.5 ml-1.5" />
                    </a>
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {loaded && !error && pending.length > 0 && withLinks.length === 0 && !generalUrl && (
              <Alert>
                <ShieldAlert className="size-4" />
                <AlertTitle>Sem links disponíveis no momento</AlertTitle>
                <AlertDescription>
                  O Asaas ainda não disponibilizou links de upload para esta conta.
                  Aguarde alguns minutos e clique em "Atualizar". Se persistir, contate
                  o suporte do Asaas.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}



      </CardContent>
    </Card>
  );
}


