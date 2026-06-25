import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, ShieldAlert, Upload, Landmark, FileCheck2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { linkAsaasBankAccount, uploadAsaasKycDocument } from "@/lib/asaas.functions";
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

const ACCEPTED_MIME = ["image/jpeg", "image/jpg", "application/pdf"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

type DocType = "IDENTIFICATION" | "SELFIE";

type Account = {
  kyc_status?: string | null;
  bank_code?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_digit?: string | null;
  bank_account_type?: string | null;
  auto_transfer_enabled?: boolean | null;
  api_key?: string | null;
  asaas_account_id?: string | null;
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
            Antes de enviar dados bancários ou documentos de identidade, preencha o formulário acima
            para criar sua subconta Asaas.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <BankSection account={account!} onChanged={onChanged} />
          <KycUploadSection onChanged={onChanged} />
        </>
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

function KycUploadSection({ onChanged }: { onChanged?: () => Promise<unknown> | void }) {
  const [dryRun, setDryRun] = useState(false);
  const [lastResponse, setLastResponse] = useState<unknown>(null);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h3 className="font-semibold">Verificação de Identidade</h3>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Switch checked={dryRun} onCheckedChange={(v) => { setDryRun(v); setLastResponse(null); }} />
            <span>Modo teste (não atualiza KYC)</span>
          </label>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {dryRun
            ? "Modo teste ativo: o arquivo é enviado ao Asaas para validar o upload, mas o status do KYC NÃO é alterado. A resposta crua aparece abaixo."
            : "Os arquivos são transmitidos em memória diretamente para o Asaas. Nada é salvo em nossos servidores ou banco de dados (conformidade LGPD). Aceitos: JPG/JPEG ou PDF (PNG não é aceito pelo Asaas) (máx. 5MB)."}
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <KycDropzone label="Documento (RG / CNH)" docType="IDENTIFICATION" dryRun={dryRun} onChanged={onChanged} onResponse={setLastResponse} />
          <KycDropzone label="Selfie de Verificação" docType="SELFIE" dryRun={dryRun} onChanged={onChanged} onResponse={setLastResponse} />
        </div>
        {dryRun && lastResponse != null && (
          <div className="mt-4 rounded-md border bg-muted/40 p-3">
            <div className="text-xs font-medium mb-2 text-muted-foreground">Resposta do Asaas (modo teste)</div>
            <pre className="text-xs whitespace-pre-wrap break-words max-h-72 overflow-auto">
{JSON.stringify(lastResponse, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KycDropzone({
  label,
  docType,
  dryRun,
  onChanged,
  onResponse,
}: {
  label: string;
  docType: DocType;
  dryRun: boolean;
  onChanged?: () => Promise<unknown> | void;
  onResponse?: (r: unknown) => void;
}) {
  const upload = useServerFn(uploadAsaasKycDocument);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className={`mt-2 rounded-lg border-2 border-dashed p-4 grid place-items-center text-center transition focus-within:ring-2 focus-within:ring-primary ${done ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:border-primary/60"}`}>
        {busy ? (
          <Loader2 className="size-6 animate-spin text-primary" />
        ) : done ? (
          <div className="flex flex-col items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-6" />
            <span className="text-xs font-medium">{dryRun ? "Upload OK (teste)" : "Enviado"}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="size-6" />
            <span className="text-xs">JPG/JPEG ou PDF (máx. 5MB)</span>
          </div>
        )}
        <input
          type="file"
          accept=".jpg,.jpeg,.pdf"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (!ACCEPTED_MIME.includes(file.type as any)) {
              toast.error("Formato inválido. Envie JPG/JPEG ou PDF (PNG não é aceito pelo Asaas).");
              return;
            }
            if (file.size > MAX_BYTES) {
              toast.error("Arquivo excede 5MB.");
              return;
            }
            setBusy(true);
            try {
              const base64 = await fileToBase64(file);
              const result: any = await upload({
                data: {
                  documentType: docType,
                  filename: file.name,
                  mimeType: file.type as any,
                  base64,
                  dryRun,
                },
              });
              if (dryRun) {
                onResponse?.(result);
                if (result?.ok) {
                  setDone(true);
                  toast.success(`Upload validado (HTTP ${result.httpStatus}). KYC não foi alterado.`);
                } else {
                  toast.error(`Asaas rejeitou o upload: ${result?.error ?? "erro desconhecido"}`);
                }
              } else {
                setDone(true);
                toast.success("Documento enviado para análise!");
                await onChanged?.();
              }
            } catch (err: any) {
              toast.error(`Erro ao enviar documento: ${err?.message ?? "falha desconhecida"}`);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </label>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
