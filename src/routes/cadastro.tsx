import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as ReCAPTCHAModule from "react-google-recaptcha";
const ReCAPTCHA: typeof import("react-google-recaptcha").default =
  (ReCAPTCHAModule as any).default?.default ??
  (ReCAPTCHAModule as any).default ??
  (ReCAPTCHAModule as any);
import { toast } from "sonner";
import {
  Building2,
  Home as HomeIcon,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Download,
} from "lucide-react";
import appQrCode from "@/assets/app-qrcode.png.asset.json";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  isValidCNPJ,
  isValidCPF,
  isValidPhone,
  maskCNPJ,
  maskCPF,
  maskPhone,
  onlyDigits,
  scorePassword,
} from "@/lib/br-validators";

const RECAPTCHA_SITE_KEY = "6LfxdhktAAAAADHvwxq3_auLwuUSO3oNrDUlUkDx";

type Role = "imobiliaria" | "proprietario";

const ALLOWED_ROLES: Role[] = ["imobiliaria", "proprietario"];

type Search = { role?: string };

export const Route = createFileRoute("/cadastro")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => {
    const raw = typeof search.role === "string" ? search.role.toLowerCase().replace(/[^a-z]/g, "") : undefined;
    return { role: raw && (ALLOWED_ROLES as string[]).includes(raw) ? raw : undefined };
  },
  head: () => ({ meta: [{ title: "Criar conta — Nexo" }] }),
  component: CadastroPage,
});

function CadastroPage() {
  const { role: roleParam } = useSearch({ from: "/cadastro" });
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>((roleParam as Role) ?? null);

  useEffect(() => {
    if (roleParam && ALLOWED_ROLES.includes(roleParam as Role)) {
      setRole(roleParam as Role);
    }
  }, [roleParam]);

  return (
    <div className="min-h-screen bg-white text-zinc-100 relative overflow-hidden">
      {/* Glow ambiente */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-violet-400/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 size-[400px] rounded-full bg-violet-300/10 blur-[100px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1">
              <ArrowLeft className="size-3.5" /> Voltar
            </Link>
            <Link to="/login" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Já tenho conta
            </Link>
          </div>

          {role === null ? (
            <RoleSelector onPick={(r) => navigate({ to: "/cadastro", search: { role: r } })} />
          ) : (
            <OnboardingWizard role={role} onChangeRole={() => navigate({ to: "/cadastro", search: {} })} />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Tela de seleção -------------------- */

function RoleSelector({ onPick }: { onPick: (r: Role) => void }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <div className="inline-flex size-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/30 mb-4">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Desejo me cadastrar como…</h1>
        <p className="mt-2 text-sm text-zinc-400">Escolha o perfil que melhor descreve a sua operação.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <RoleCard
          icon={<Building2 className="size-6" />}
          title="Imobiliária"
          description="Gestão de carteira, equipe, repasses e DIMOB."
          onClick={() => onPick("imobiliaria")}
        />
        <RoleCard
          icon={<HomeIcon className="size-6" />}
          title="Proprietário"
          description="Controle direto dos seus imóveis e contratos."
          onClick={() => onPick("proprietario")}
        />
      </div>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-all hover:border-violet-500/60 hover:bg-zinc-900 hover:shadow-[0_0_30px_-10px_rgba(139,92,246,0.6)] focus:outline-none focus:ring-2 focus:ring-violet-500"
    >
      <div className="flex size-11 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20 group-hover:bg-violet-500/20">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-medium text-zinc-100">{title}</h3>
      <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{description}</p>
      <div className="mt-3 flex items-center gap-1 text-xs text-violet-400 opacity-0 transition-opacity group-hover:opacity-100">
        Selecionar <ArrowRight className="size-3" />
      </div>
    </button>
  );
}

/* -------------------- Wizard -------------------- */

type Step = 1 | 2 | 3;

interface FormState {
  email: string;
  password: string;
  confirm: string;
  captchaToken: string | null;

  fullName: string;
  document: string; // CPF ou CNPJ
  phone: string;
  birthDate: string;
  companyName: string;

  acceptTerms: boolean;
  acceptLgpd: boolean;
}

function OnboardingWizard({ role, onChangeRole }: { role: Role; onChangeRole: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const captchaRef = useRef<import("react-google-recaptcha").default | null>(null);

  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    confirm: "",
    captchaToken: null,
    fullName: "",
    document: "",
    phone: "",
    birthDate: "",
    companyName: "",
    acceptTerms: false,
    acceptLgpd: false,
  });

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((s) => ({ ...s, [k]: v }));

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const fullName = role === "imobiliaria" ? form.companyName : form.fullName;
      const signUpPayload: Parameters<typeof supabase.auth.signUp>[0] = {
        email: form.email.trim(),
        password: form.password,
        options: {
          captchaToken: form.captchaToken ?? undefined,
          data: {
            role: role === "imobiliaria" ? "manager" : "owner",
            full_name: fullName,
            document: onlyDigits(form.document),
            phone: onlyDigits(form.phone),
            company_name: role === "imobiliaria" ? form.companyName : undefined,
            responsible_name: role === "imobiliaria" ? form.fullName : undefined,
            birth_date: role !== "imobiliaria" ? form.birthDate : undefined,
          },
        },
      };
      const { error } = await supabase.auth.signUp(signUpPayload);
      if (error) throw error;
      toast.success("Cadastro realizado com sucesso! Verifique seu e-mail para confirmação.");
      // Garantir que nenhuma sessão fique ativa — usuário precisa confirmar email e logar
      await supabase.auth.signOut().catch(() => {});
      navigate({ to: "/login", replace: true });
    } catch (err: any) {
      captchaRef.current?.reset();
      update("captchaToken", null);
      toast.error(err?.message || "Erro ao processar cadastro. Verifique os dados ou tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return <SuccessPanel role={role} email={form.email} />;
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-violet-400 font-medium">
            {role === "imobiliaria" ? "Imobiliária" : "Proprietário"}
          </p>
          <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">Criar sua conta Nexo</h1>
        </div>
        <button
          onClick={onChangeRole}
          className="text-xs text-zinc-500 hover:text-violet-400 transition-colors"
          type="button"
        >
          Trocar perfil
        </button>
      </div>

      <StepperBar step={step} />

      <div className="mt-6">
        {step === 1 && (
          <StepCredentials
            form={form}
            update={update}
            captchaRef={captchaRef}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepIdentity
            role={role}
            form={form}
            update={update}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepTerms
            form={form}
            update={update}
            submitting={submitting}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

function StepperBar({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Credenciais" },
    { n: 2, label: "Identidade" },
    { n: 3, label: "Termos" },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it, idx) => (
        <div key={it.n} className="flex items-center flex-1">
          <div
            className={cn(
              "flex items-center gap-2 transition-all",
              step >= it.n ? "text-violet-400" : "text-zinc-500",
            )}
          >
            <div
              className={cn(
                "grid place-items-center size-7 rounded-full text-xs font-medium transition-all",
                step > it.n
                  ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40"
                  : step === it.n
                    ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/60 shadow-[0_0_15px_-2px_rgba(139,92,246,0.6)]"
                    : "bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800",
              )}
            >
              {step > it.n ? <CheckCircle2 className="size-4" /> : it.n}
            </div>
            <span className="text-xs font-medium hidden sm:inline">{it.label}</span>
          </div>
          {idx < items.length - 1 && (
            <div
              className={cn(
                "mx-2 h-px flex-1 transition-colors",
                step > it.n ? "bg-emerald-500/40" : "bg-zinc-800",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* -------------------- Passo 1 -------------------- */

function StepCredentials({
  form,
  update,
  captchaRef,
  onNext,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  captchaRef: React.MutableRefObject<ReCAPTCHA | null>;
  onNext: () => void;
}) {
  const [showPw, setShowPw] = useState(false);
  const strength = useMemo(() => scorePassword(form.password), [form.password]);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const matches = form.password.length > 0 && form.password === form.confirm;
  const canNext = emailOk && strength.valid && matches && !!form.captchaToken;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canNext) onNext();
      }}
    >
      <Field label="E-mail" icon={<Mail className="size-4" />}>
        <NeoInput
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="voce@empresa.com.br"
          required
        />
      </Field>

      <Field label="Senha" icon={<Lock className="size-4" />}>
        <div className="relative">
          <NeoInput
            type={showPw ? "text" : "password"}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <StrengthMeter strength={strength} />
      </Field>

      <Field label="Confirmar senha" icon={<Lock className="size-4" />}>
        <NeoInput
          type="password"
          value={form.confirm}
          onChange={(e) => update("confirm", e.target.value)}
          placeholder="Repita a senha"
          autoComplete="new-password"
          required
        />
        {form.confirm.length > 0 && (
          <p className={cn("text-xs mt-1.5", matches ? "text-emerald-400" : "text-red-400")}>
            {matches ? "✓ As senhas coincidem" : "As senhas não coincidem"}
          </p>
        )}
      </Field>

      <div className="flex justify-center pt-2">
        <div className="rounded-md overflow-hidden ring-1 ring-zinc-800">
          <ReCAPTCHA
            ref={captchaRef}
            sitekey={RECAPTCHA_SITE_KEY}
            theme="dark"
            onChange={(token) => update("captchaToken", token)}
            onExpired={() => update("captchaToken", null)}
            onErrored={() => update("captchaToken", null)}
          />
        </div>
      </div>

      <NextButton disabled={!canNext}>Próximo</NextButton>
    </form>
  );
}

function StrengthMeter({ strength }: { strength: ReturnType<typeof scorePassword> }) {
  const colors = ["bg-zinc-800", "bg-red-500", "bg-orange-500", "bg-violet-500", "bg-emerald-500"];
  const labels = ["", "Fraca", "Razoável", "Boa", "Forte"];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 rounded-full transition-all",
              strength.score >= i ? colors[strength.score] : "bg-zinc-800",
              strength.score >= 4 && i <= strength.score && "shadow-[0_0_6px_rgba(16,185,129,0.6)]",
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span className="flex flex-wrap gap-x-2">
          <Check ok={strength.hasLength}>8+ caracteres</Check>
          <Check ok={strength.hasUpper}>1 maiúscula</Check>
          <Check ok={strength.hasNumber}>1 número</Check>
          <Check ok={strength.hasSpecial}>1 especial</Check>
        </span>
        {strength.score > 0 && (
          <span className={cn("font-medium", strength.valid ? "text-emerald-400" : "text-zinc-400")}>
            {labels[strength.score]}
          </span>
        )}
      </div>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("transition-colors", ok ? "text-emerald-400" : "text-zinc-600")}>
      {ok ? "✓" : "○"} {children}
    </span>
  );
}

/* -------------------- Passo 2 -------------------- */

function StepIdentity({
  role,
  form,
  update,
  onBack,
  onNext,
}: {
  role: Role;
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const isImob = role === "imobiliaria";
  const docValid = isImob ? isValidCNPJ(form.document) : isValidCPF(form.document);
  const phoneValid = isValidPhone(form.phone);
  const fullNameValid = form.fullName.trim().length >= 3;
  const companyValid = !isImob || form.companyName.trim().length >= 2;
  const birthValid = isImob || (form.birthDate.length === 10 && new Date(form.birthDate) < new Date());
  const canNext = docValid && phoneValid && fullNameValid && companyValid && birthValid;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({ document: true, phone: true, fullName: true, companyName: true, birthDate: true });
        if (canNext) onNext();
      }}
    >
      {isImob && (
        <Field label="Razão Social">
          <NeoInput
            value={form.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            placeholder="Sua Imobiliária LTDA"
            required
          />
        </Field>
      )}

      <Field label={isImob ? "Nome do responsável" : "Nome completo"}>
        <NeoInput
          value={form.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
          placeholder={isImob ? "Responsável pela conta" : "Como aparece no documento"}
          required
        />
        {touched.fullName && !fullNameValid && (
          <p className="text-xs text-red-400 mt-1">Informe um nome válido</p>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={isImob ? "CNPJ" : "CPF"}>
          <NeoInput
            value={form.document}
            onChange={(e) => update("document", isImob ? maskCNPJ(e.target.value) : maskCPF(e.target.value))}
            onBlur={() => setTouched((t) => ({ ...t, document: true }))}
            placeholder={isImob ? "00.000.000/0000-00" : "000.000.000-00"}
            inputMode="numeric"
            required
          />
          {touched.document && form.document.length > 0 && !docValid && (
            <p className="text-xs text-red-400 mt-1">{isImob ? "CNPJ" : "CPF"} inválido</p>
          )}
        </Field>

        <Field label={isImob ? "Telefone comercial" : "Telefone"}>
          <NeoInput
            value={form.phone}
            onChange={(e) => update("phone", maskPhone(e.target.value))}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            placeholder="(11) 99999-9999"
            inputMode="tel"
            required
          />
          {touched.phone && form.phone.length > 0 && !phoneValid && (
            <p className="text-xs text-red-400 mt-1">Telefone inválido</p>
          )}
        </Field>
      </div>

      {!isImob && (
        <Field label="Data de nascimento">
          <NeoInput
            type="date"
            value={form.birthDate}
            onChange={(e) => update("birthDate", e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </Field>
      )}

      <div className="flex gap-3 pt-2">
        <BackButton onClick={onBack} />
        <NextButton disabled={!canNext}>Próximo</NextButton>
      </div>
    </form>
  );
}

/* -------------------- Passo 3 -------------------- */

function StepTerms({
  form,
  update,
  submitting,
  onBack,
  onSubmit,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = form.acceptTerms && form.acceptLgpd && !submitting;
  return (
    <div className="space-y-5">
      <ScrollArea className="h-56 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-400 leading-relaxed">
        <h3 className="text-sm font-medium text-zinc-200 mb-2">Termos de Serviço</h3>
        <p className="mb-3">
          Ao utilizar a plataforma NEXO, você concorda em usá-la exclusivamente para a gestão lícita de
          imóveis, contratos de locação, inquilinos, parcelas, repasses, manutenções e demais operações
          relacionadas. É vedado o uso para qualquer finalidade fraudulenta, ilegal ou que viole direitos
          de terceiros.
        </p>
        <p className="mb-3">
          A NEXO disponibiliza a infraestrutura tecnológica e poderá, a qualquer momento, atualizar
          funcionalidades, planos e políticas, comunicando alterações relevantes através do e-mail
          cadastrado ou em painel próprio.
        </p>
        <h3 className="text-sm font-medium text-zinc-200 mb-2 mt-4">Política de Privacidade & LGPD</h3>
        <p className="mb-3">
          Coletamos e tratamos dados cadastrais (nome, e-mail, CPF/CNPJ, telefone) e dados operacionais
          (imóveis, contratos, financeiro) com finalidade legítima de execução de contrato e cumprimento
          de obrigações legais, conforme a Lei nº 13.709/2018 (LGPD).
        </p>
        <p className="mb-3">
          Você possui os direitos de acesso, correção, portabilidade e exclusão dos seus dados, mediante
          solicitação ao encarregado (DPO) pelos canais oficiais da plataforma. Dados financeiros podem
          ser compartilhados com nosso provedor de pagamentos (Asaas) estritamente para
          processamento das transações autorizadas.
        </p>
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não
          autorizado, perda ou destruição, incluindo criptografia em trânsito e em repouso, controle de
          acesso baseado em papéis e auditoria contínua.
        </p>
      </ScrollArea>

      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer group">
          <Checkbox
            checked={form.acceptTerms}
            onCheckedChange={(c) => update("acceptTerms", c === true)}
            className="mt-0.5 border-zinc-700 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
          />
          <span className="text-xs text-zinc-300 leading-relaxed group-hover:text-zinc-100">
            Li e aceito os <span className="text-violet-400">Termos de Serviço</span> e a{" "}
            <span className="text-violet-400">Política de Privacidade</span> da NEXO.
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <Checkbox
            checked={form.acceptLgpd}
            onCheckedChange={(c) => update("acceptLgpd", c === true)}
            className="mt-0.5 border-zinc-700 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
          />
          <span className="text-xs text-zinc-300 leading-relaxed group-hover:text-zinc-100">
            Consinto com o processamento dos meus dados cadastrais e financeiros para fins de
            provisionamento da plataforma, em conformidade com a LGPD.
          </span>
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <BackButton onClick={onBack} disabled={submitting} />
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={cn(
            "flex-1 h-11 bg-violet-600 hover:bg-violet-500 text-white font-medium",
            "shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)]",
            "disabled:opacity-40 disabled:shadow-none",
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Processando…
            </>
          ) : (
            "Concluir cadastro"
          )}
        </Button>
      </div>
    </div>
  );
}

/* -------------------- UI building blocks -------------------- */

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
        {icon && <span className="text-zinc-500">{icon}</span>}
        {label}
      </Label>
      {children}
    </div>
  );
}

const NeoInput = (props: React.ComponentProps<typeof Input>) => (
  <Input
    {...props}
    className={cn(
      "h-11 bg-zinc-900/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-600",
      "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:border-violet-500/50",
      "focus-visible:shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)] transition-shadow",
      props.className,
    )}
  />
);

function NextButton({ disabled, children }: { disabled: boolean; children: React.ReactNode }) {
  return (
    <Button
      type="submit"
      disabled={disabled}
      className={cn(
        "w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-medium",
        "shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)]",
        "disabled:opacity-40 disabled:shadow-none",
      )}
    >
      {children}
    </Button>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="h-11 bg-transparent border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
    >
      <ArrowLeft className="size-4 mr-1" /> Voltar
    </Button>
  );
}

/* -------------------- Tela de sucesso com QR -------------------- */

function SuccessPanel({ role, email }: { role: Role; email: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
      <div className="text-center">
        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/40 shadow-[0_0_30px_-4px_rgba(16,185,129,0.6)]">
          <CheckCircle2 className="size-7" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          Cadastro realizado com sucesso!
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Enviamos um link de confirmação para{" "}
          <span className="text-zinc-200 font-medium">{email}</span>.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {role === "imobiliaria"
            ? "Sua imobiliária está pronta para começar."
            : "Sua conta de proprietário está pronta."}
        </p>
      </div>

      <div className="my-6 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-violet-400 font-medium">
          <Smartphone className="size-3.5" /> Baixe o aplicativo
        </div>
        <h3 className="mt-2 text-lg font-semibold">Leve o Nexo no seu bolso</h3>
        <p className="mt-1 text-xs text-zinc-400">
          Aponte a câmera do seu celular para o QR code abaixo.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800 shadow-[0_0_40px_-10px_rgba(139,92,246,0.5)]">
          <img
            src={appQrCode.url}
            alt="QR code para baixar o app Nexo"
            className="size-44 sm:size-52 rounded-lg"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Link to="/login" className="flex-1">
          <Button className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.7)]">
            <ArrowRight className="size-4 mr-1" /> Ir para login
          </Button>
        </Link>
        <a
          href={appQrCode.url}
          download="nexo-app-qrcode.png"
          className="flex-1"
        >
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 bg-transparent border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <Download className="size-4 mr-1" /> Baixar QR
          </Button>
        </a>
      </div>
    </div>
  );
}
