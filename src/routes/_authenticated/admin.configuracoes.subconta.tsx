import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  Lock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
  getAsaasAccount,
  setupSubaccountOnboarding,
} from "@/lib/asaas.functions";
import { maskCpfCnpj, maskPhone, maskCEP } from "@/lib/br-validators";

const BANKS: Array<{ code: string; name: string }> = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú" },
  { code: "260", name: "Nubank" },
  { code: "077", name: "Inter" },
  { code: "212", name: "Banco Original" },
  { code: "336", name: "C6 Bank" },
  { code: "208", name: "BTG Pactual" },
  { code: "748", name: "Sicredi" },
  { code: "756", name: "Sicoob" },
  { code: "422", name: "Safra" },
];

export const Route = createFileRoute(
  "/_authenticated/admin/configuracoes/subconta",
)({
  head: () => ({ meta: [{ title: "Homologação Bancária — NEXO" }] }),
  component: SubcontaOnboardingPage,
});

const PROGRESS_MESSAGES = [
  "Enviando dados ao gateway homologado…",
  "Criando ambiente bancário seguro…",
  "Aguardando provisionamento da trilha KYC (15s)…",
  "Solicitando painel de verificação ao Asaas…",
  "Carregando ambiente embarcado…",
];

function SubcontaOnboardingPage() {
  const { user } = useAuth();
  const fetchAccount = useServerFn(getAsaasAccount);
  const setup = useServerFn(setupSubaccountOnboarding);

  const { data, refetch } = useQuery({
    queryKey: ["asaas-account", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchAccount(),
  });
  const account = data?.account as any;

  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(
    account?.onboarding_url ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    if (account?.onboarding_url && !onboardingUrl) {
      setOnboardingUrl(account.onboarding_url);
    }
  }, [account?.onboarding_url, onboardingUrl]);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => {
      setProgressIdx((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1));
    }, 3500);
    return () => clearInterval(t);
  }, [loading]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    cpfCnpj: "",
    mobilePhone: "",
    birthDate: "",
    address: "",
    addressNumber: "",
    province: "",
    postalCode: "",
    incomeValue: "",
    bankCode: "",
    bankOwnerCpfCnpj: "",
    bankAgency: "",
    bankAccount: "",
    bankAccountDigit: "",
    bankAccountType: "CONTA_CORRENTE" as "CONTA_CORRENTE" | "CONTA_POUPANCA",
  });

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setProgressIdx(0);
    setIframeReady(false);
    try {
      const res: any = await setup({
        data: { ...form, incomeValue: Number(form.incomeValue) } as any,
      });
      if (!res?.onboardingUrl) throw new Error("URL de onboarding indisponível.");
      setOnboardingUrl(res.onboardingUrl);
      if (res.sandboxFallback) {
        toast.info(
          "Sandbox do Asaas aprovou a subconta automaticamente. Abrindo o painel Sandbox para você simular o fluxo de homologação.",
          { duration: 8000 },
        );
      }
      await refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao iniciar a homologação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
      {loading && <LoadingOverlay message={PROGRESS_MESSAGES[progressIdx]} />}

      <div className="max-w-6xl mx-auto p-6 lg:p-10 space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30 border">
              <Sparkles className="size-3 mr-1" /> Homologação Bancária
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
            >
              <Lock className="size-3 mr-1" /> Criptografado fim-a-fim
            </Badge>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
            Verificação de Subconta da Imobiliária
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            O processo de homologação acontece em ambiente seguro do Asaas,
            embarcado diretamente no seu painel. Selfie, RG/CNH e contrato
            social são enviados sem sair desta página.
          </p>
        </header>

        {!onboardingUrl ? (
          <Card className="p-6 lg:p-8 bg-zinc-900/60 border-zinc-800 backdrop-blur">
            <form onSubmit={handleStart} className="grid sm:grid-cols-2 gap-4">
              <Field label="Razão social / Nome" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="E-mail" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="CPF / CNPJ" required>
                <Input
                  value={form.cpfCnpj}
                  onChange={(e) =>
                    setForm({ ...form, cpfCnpj: maskCpfCnpj(e.target.value) })
                  }
                  required
                  inputMode="numeric"
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="Celular" required>
                <Input
                  value={form.mobilePhone}
                  onChange={(e) =>
                    setForm({ ...form, mobilePhone: maskPhone(e.target.value) })
                  }
                  required
                  inputMode="tel"
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="Faturamento mensal (R$)" required>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.incomeValue}
                  onChange={(e) =>
                    setForm({ ...form, incomeValue: e.target.value })
                  }
                  required
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="Data de nascimento (PF)">
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) =>
                    setForm({ ...form, birthDate: e.target.value })
                  }
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="CEP" required>
                <Input
                  value={form.postalCode}
                  onChange={(e) =>
                    setForm({ ...form, postalCode: maskCEP(e.target.value) })
                  }
                  required
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="Bairro" required>
                <Input
                  value={form.province}
                  onChange={(e) =>
                    setForm({ ...form, province: e.target.value })
                  }
                  required
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="Endereço" required>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  required
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="Número" required>
                <Input
                  value={form.addressNumber}
                  onChange={(e) =>
                    setForm({ ...form, addressNumber: e.target.value })
                  }
                  required
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>

              <div className="sm:col-span-2 mt-4 pt-4 border-t border-zinc-800">
                <h3 className="font-semibold text-zinc-100 mb-1">
                  Conta bancária de liquidação
                </h3>
                <p className="text-xs text-zinc-500">
                  Necessária para o Asaas liberar a trilha de KYC.
                </p>
              </div>
              <Field label="Banco" required>
                <Select
                  value={form.bankCode}
                  onValueChange={(v) => setForm({ ...form, bankCode: v })}
                >
                  <SelectTrigger className="bg-zinc-950/60 border-zinc-800">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.code} — {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="CPF/CNPJ do titular" required>
                <Input
                  value={form.bankOwnerCpfCnpj}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bankOwnerCpfCnpj: maskCpfCnpj(e.target.value),
                    })
                  }
                  required
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <Field label="Tipo" required>
                <Select
                  value={form.bankAccountType}
                  onValueChange={(v) =>
                    setForm({ ...form, bankAccountType: v as any })
                  }
                >
                  <SelectTrigger className="bg-zinc-950/60 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTA_CORRENTE">Corrente</SelectItem>
                    <SelectItem value="CONTA_POUPANCA">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Agência" required>
                <Input
                  value={form.bankAgency}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bankAgency: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  required
                  className="bg-zinc-950/60 border-zinc-800"
                />
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Field label="Conta" required>
                  <Input
                    value={form.bankAccount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bankAccount: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    required
                    className="bg-zinc-950/60 border-zinc-800"
                  />
                </Field>
                <Field label="Dígito" required>
                  <Input
                    className="w-20 bg-zinc-950/60 border-zinc-800"
                    value={form.bankAccountDigit}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bankAccountDigit: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    required
                    maxLength={2}
                  />
                </Field>
              </div>

              <div className="sm:col-span-2 flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_28px_-8px_rgb(139_92_246)]"
                >
                  <ShieldCheck className="size-4 mr-2" />
                  Iniciar Homologação Bancária
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <Card className="overflow-hidden bg-zinc-900/60 border-zinc-800 backdrop-blur">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-emerald-400" />
                  <span className="text-sm font-medium">
                    Painel Asaas — Verificação Embarcada
                  </span>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 border">
                  <CheckCircle2 className="size-3 mr-1" /> Conexão Segura
                </Badge>
              </div>
              <div className="relative bg-white">
                {!iframeReady && (
                  <div className="absolute inset-0 grid place-items-center bg-zinc-950/80 text-zinc-300 z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="size-6 animate-spin text-violet-400" />
                      <p className="text-sm">Carregando ambiente seguro…</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={onboardingUrl}
                  title="Verificação Asaas"
                  allow="camera; microphone; clipboard-read; clipboard-write"
                  className="w-full h-[78vh] min-h-[640px] border-0"
                  onLoad={() => {
                    if (!iframeReady) {
                      setIframeReady(true);
                      toast.success(
                        "Ambiente de verificação carregado com sucesso.",
                        {
                          className:
                            "!bg-emerald-600 !text-white !border-emerald-500",
                        },
                      );
                    }
                  }}
                />
              </div>
            </Card>

            <aside className="space-y-4">
              <Card className="p-5 bg-zinc-900/60 border-zinc-800 backdrop-blur">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/15 text-violet-300">
                    <Info className="size-4" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-zinc-100">
                      Dicas para finalizar a verificação
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Insira os documentos da imobiliária e realize a selfie de
                      validação no painel ao lado. O processamento é
                      criptografado e feito diretamente pelo barramento
                      homologado do Asaas.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-zinc-900/60 border-zinc-800 backdrop-blur space-y-3">
                <h4 className="text-sm font-semibold text-zinc-200">
                  Checklist
                </h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    RG/CNH legível, em arquivo nítido
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    Selfie em ambiente bem iluminado
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    Para PJ: contrato social atualizado
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    Aprovação Asaas: até 48h úteis
                  </li>
                </ul>
              </Card>

              <Button
                variant="outline"
                className="w-full border-zinc-800 bg-zinc-900/60"
                onClick={() => refetch()}
              >
                Atualizar status
              </Button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-zinc-300 text-xs uppercase tracking-wide">
        {label}
        {required && <span className="text-violet-400 ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 backdrop-blur-md">
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-violet-500/30 shadow-[0_0_60px_-10px_rgb(139_92_246)] text-center space-y-5">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <ShieldCheck className="absolute inset-0 m-auto size-8 text-violet-300" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-zinc-50">
            Criando ambiente bancário seguro…
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Por favor, aguarde 15 segundos enquanto homologamos suas
            credenciais junto ao gateway Asaas.
          </p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30 text-xs text-violet-200">
          {message}
        </div>
      </div>
    </div>
  );
}
