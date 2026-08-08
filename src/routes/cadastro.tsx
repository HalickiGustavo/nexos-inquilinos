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
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Download,
  User,
  Phone,
  IdCard,
  Calendar,
  AlertCircle,
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

import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRecaptchaSiteKey } from "@/lib/recaptcha.functions";
import { isPreviewClient } from "@/lib/recaptcha-client";
import { sendWelcomeEmail } from "@/lib/welcome-email.functions";
import { activateManagerRole } from "@/lib/manager-setup.functions";

type Role = "imobiliaria" | "proprietario";
const ALLOWED_ROLES: Role[] = ["imobiliaria", "proprietario"];

type Search = { role?: string; invite?: string; email?: string };

export const Route = createFileRoute("/cadastro")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => {
    const raw = typeof search.role === "string" ? search.role.toLowerCase().replace(/[^a-z]/g, "") : undefined;
    const invite = typeof search.invite === "string" && /^[a-f0-9]{16,}$/i.test(search.invite) ? search.invite : undefined;
    const email = typeof search.email === "string" ? search.email : undefined;
    return {
      role: raw && (ALLOWED_ROLES as string[]).includes(raw) ? raw : undefined,
      invite,
      email,
    };
  },
  head: () => ({ meta: [{ title: "Criar conta — Nexo" }] }),
  component: CadastroPage,
});

function CadastroPage() {
  const { role: roleParam, invite, email: emailParam } = useSearch({ from: "/cadastro" });
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>((roleParam as Role) ?? (invite ? "proprietario" : null));
  const [initialEmail] = useState(emailParam || "");

  useEffect(() => {
    if (roleParam && ALLOWED_ROLES.includes(roleParam as Role)) {
      setRole(roleParam as Role);
    }
  }, [roleParam]);

  useEffect(() => {
    if (invite && typeof window !== "undefined") {
      window.localStorage.setItem("landlord_invite_token", invite);
    }
  }, [invite]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="mb-5 flex items-center justify-between text-xs">
            <Link to="/" className="text-zinc-500 hover:text-zinc-900 transition-colors inline-flex items-center gap-1">
              <ArrowLeft className="size-3.5" /> Voltar
            </Link>
            <Link to="/login" className="text-zinc-500 hover:text-zinc-900 transition-colors">
              Já tenho conta →
            </Link>
          </div>

          {role === null ? (
            <RoleSelector onPick={(r) => navigate({ to: "/cadastro", search: { role: r } })} />
          ) : (
            <OnboardingWizard role={role} initialEmail={initialEmail} onChangeRole={() => navigate({ to: "/cadastro", search: {} })} />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Seleção de papel -------------------- */

function RoleSelector({ onPick }: { onPick: (r: Role) => void }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6 sm:p-8">
      <div className="text-center mb-7">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">Criar sua conta</h1>
        <p className="mt-1.5 text-sm text-zinc-500">Como você vai usar a Nexo?</p>
      </div>

      <div className="space-y-2.5">
        <RoleCard
          icon={<Building2 className="size-5" />}
          title="Imobiliária"
          description="Gestão de carteira, equipe e repasses."
          onClick={() => onPick("imobiliaria")}
        />
        <RoleCard
          icon={<HomeIcon className="size-5" />}
          title="Proprietário"
          description="Controle direto dos seus imóveis."
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
      className="group w-full text-left rounded-xl border border-zinc-200 bg-white p-4 flex items-center gap-4 transition-all hover:border-violet-500/70 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20 transition-colors group-hover:bg-violet-500/20">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-zinc-900">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{description}</p>
      </div>
      <ArrowRight className="size-4 text-zinc-500 transition-all group-hover:text-violet-600 group-hover:translate-x-0.5" />
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
  document: string;
  phone: string;
  birthDate: string;
  companyName: string;
  acceptTerms: boolean;
  acceptLgpd: boolean;
}

function OnboardingWizard({ role, initialEmail, onChangeRole }: { role: Role; initialEmail: string; onChangeRole: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const captchaRef = useRef<import("react-google-recaptcha").default | null>(null);
  const triggerWelcomeEmail = useServerFn(sendWelcomeEmail);
  const triggerManagerSetup = useServerFn(activateManagerRole);

  const [form, setForm] = useState<FormState>({
    email: initialEmail,
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
        email: form.email.trim().toLowerCase(),
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

      // Ensure role assignment and send welcome email
      try {
        if (role === "imobiliaria") {
          await triggerManagerSetup({});
        }
        await triggerWelcomeEmail({
          data: {
            email: form.email,
            fullName: role === "imobiliaria" ? form.companyName : form.fullName,
            role: role,
            document: form.document,
          },
        });
      } catch (roleOrEmailErr) {
        console.warn("Falha no setup de papel ou e-mail de boas-vindas, mas a conta foi criada:", roleOrEmailErr);
      }

      toast.success("Cadastro realizado! Verifique seu e-mail para confirmar.");
      await supabase.auth.signOut().catch(() => {});
      setSuccess(true);
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
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6 sm:p-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-violet-600 font-semibold">
            {role === "imobiliaria" ? "Imobiliária" : "Proprietário"}
          </p>
          <h1 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-zinc-900">
            Criar sua conta Nexo
          </h1>
        </div>
        <button
          onClick={onChangeRole}
          className="text-xs text-zinc-500 hover:text-violet-600 transition-colors shrink-0"
          type="button"
        >
          Trocar perfil
        </button>
      </div>

      <StepperBar step={step} />

      <div className="mt-7">
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
    { n: 1 as Step, label: "Acesso" },
    { n: 2 as Step, label: "Identidade" },
    { n: 3 as Step, label: "Termos" },
  ];
  return (
    <div className="flex items-center">
      {items.map((it, idx) => {
        const done = step > it.n;
        const active = step === it.n;
        return (
          <div key={it.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  "grid place-items-center size-6 rounded-full text-[11px] font-semibold transition-all shrink-0",
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-violet-500 text-white ring-4 ring-violet-500/20"
                      : "bg-zinc-200 text-zinc-500",
                )}
              >
                {done ? <CheckCircle2 className="size-3.5" /> : it.n}
              </div>
              <span
                className={cn(
                  "text-xs font-medium transition-colors hidden sm:inline",
                  active ? "text-zinc-900" : done ? "text-zinc-500" : "text-zinc-500",
                )}
              >
                {it.label}
              </span>
            </div>
            {idx < items.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-px flex-1 transition-colors",
                  done ? "bg-emerald-500/50" : "bg-zinc-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------- Passo 1 · Acesso -------------------- */

function StepCredentials({
  form,
  update,
  captchaRef,
  onNext,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  captchaRef: React.MutableRefObject<import("react-google-recaptcha").default | null>;
  onNext: () => void;
}) {
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const strength = useMemo(() => scorePassword(form.password), [form.password]);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const matches = form.password.length > 0 && form.password === form.confirm;

  const fetchSiteKey = useServerFn(getRecaptchaSiteKey);
  const { data: siteKeyData } = useQuery({
    queryKey: ["recaptcha-site-key"],
    queryFn: () => fetchSiteKey(),
    staleTime: Infinity,
  });
  const [previewClient, setPreviewClient] = useState(false);
  useEffect(() => setPreviewClient(isPreviewClient()), []);
  const recaptchaSiteKey = siteKeyData?.siteKey ?? null;
  const recaptchaEnabled = !previewClient && (siteKeyData?.enabled ?? true);
  const canNext =
    emailOk && strength.valid && matches && (!recaptchaEnabled || !!form.captchaToken);

  const emailError = touched.email && form.email.length > 0 && !emailOk ? "Formato de e-mail inválido" : undefined;
  const pwError = touched.password && form.password.length > 0 && !strength.valid
    ? "A senha ainda não atende a todos os requisitos"
    : undefined;
  const confirmError = touched.confirm && form.confirm.length > 0 && !matches ? "As senhas não coincidem" : undefined;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({ email: true, password: true, confirm: true });
        if (canNext) onNext();
      }}
    >
      <Field label="E-mail" icon={<Mail className="size-3.5" />} error={emailError}>
        <NeoInput
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          placeholder="voce@empresa.com.br"
          aria-invalid={!!emailError}
          required
        />
      </Field>

      <Field label="Senha" icon={<Lock className="size-3.5" />} error={pwError}>
        <div className="relative">
          <NeoInput
            type={showPw ? "text" : "password"}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            aria-invalid={!!pwError}
            className="pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 transition-colors"
            tabIndex={-1}
            aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <StrengthMeter strength={strength} />
      </Field>

      <Field label="Confirmar senha" icon={<Lock className="size-3.5" />} error={confirmError}>
        <NeoInput
          type="password"
          value={form.confirm}
          onChange={(e) => update("confirm", e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          placeholder="Repita a senha"
          autoComplete="new-password"
          aria-invalid={!!confirmError}
          required
        />
        {form.confirm.length > 0 && matches && (
          <p className="text-xs mt-1.5 text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="size-3" /> As senhas coincidem
          </p>
        )}
      </Field>

      {recaptchaEnabled && (
        <div className="flex justify-center pt-1">
          <div className="w-[237px] h-[61px] sm:w-[304px] sm:h-[78px] max-w-full rounded-md overflow-hidden ring-1 ring-zinc-200">
            <div className="origin-top-left scale-[0.78] sm:scale-100 w-[304px] h-[78px]">
              {recaptchaSiteKey ? (
                <ReCAPTCHA
                  ref={captchaRef}
                  sitekey={recaptchaSiteKey}
                  theme="light"
                  onChange={(token) => update("captchaToken", token)}
                  onExpired={() => update("captchaToken", null)}
                  onErrored={() => update("captchaToken", null)}
                />
              ) : (
                <div className="w-[304px] h-[78px] bg-white animate-pulse rounded-md" />
              )}
            </div>
          </div>
        </div>
      )}

      <NextButton disabled={!canNext}>Continuar</NextButton>
    </form>
  );
}

function StrengthMeter({ strength }: { strength: ReturnType<typeof scorePassword> }) {
  const colors = ["bg-zinc-200", "bg-red-500", "bg-orange-500", "bg-violet-500", "bg-emerald-500"];
  const labels = ["", "Fraca", "Razoável", "Boa", "Forte"];
  return (
    <div className="mt-2.5 space-y-2">
      <div className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 rounded-full transition-all",
              strength.score >= i ? colors[strength.score] : "bg-zinc-200",
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10px]">
          <Check ok={strength.hasLength}>8+ caracteres</Check>
          <Check ok={strength.hasUpper}>maiúscula</Check>
          <Check ok={strength.hasNumber}>número</Check>
          <Check ok={strength.hasSpecial}>especial</Check>
        </div>
        {strength.score > 0 && (
          <span className={cn("text-[10px] font-medium shrink-0", strength.valid ? "text-emerald-600" : "text-zinc-500")}>
            {labels[strength.score]}
          </span>
        )}
      </div>
      <p className="text-[10px] text-zinc-500">Atenda pelo menos 3 dos 4 requisitos (8+ caracteres obrigatório).</p>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 transition-colors", ok ? "text-emerald-600" : "text-zinc-500")}>
      <span className={cn("size-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-zinc-300")} />
      {children}
    </span>
  );
}

/* -------------------- Passo 2 · Identidade -------------------- */

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

  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

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
        <Field
          label="Razão Social"
          icon={<Building2 className="size-3.5" />}
          error={touched.companyName && !companyValid ? "Informe a razão social" : undefined}
        >
          <NeoInput
            value={form.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            onBlur={() => touch("companyName")}
            placeholder="Sua Imobiliária LTDA"
            required
          />
        </Field>
      )}

      <Field
        label={isImob ? "Nome do responsável" : "Nome completo"}
        icon={<User className="size-3.5" />}
        error={touched.fullName && !fullNameValid ? "Informe um nome válido (mín. 3 letras)" : undefined}
      >
        <NeoInput
          value={form.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          onBlur={() => touch("fullName")}
          placeholder={isImob ? "Responsável pela conta" : "Como aparece no documento"}
          autoComplete="name"
          required
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label={isImob ? "CNPJ" : "CPF"}
          icon={<IdCard className="size-3.5" />}
          error={touched.document && form.document.length > 0 && !docValid ? `${isImob ? "CNPJ" : "CPF"} inválido` : undefined}
        >
          <NeoInput
            value={form.document}
            onChange={(e) => update("document", isImob ? maskCNPJ(e.target.value) : maskCPF(e.target.value))}
            onBlur={() => touch("document")}
            placeholder={isImob ? "00.000.000/0000-00" : "000.000.000-00"}
            inputMode="numeric"
            required
          />
        </Field>

        <Field
          label={isImob ? "Telefone comercial" : "Telefone"}
          icon={<Phone className="size-3.5" />}
          error={touched.phone && form.phone.length > 0 && !phoneValid ? "Telefone inválido" : undefined}
        >
          <NeoInput
            value={form.phone}
            onChange={(e) => update("phone", maskPhone(e.target.value))}
            onBlur={() => touch("phone")}
            placeholder="(11) 99999-9999"
            inputMode="tel"
            autoComplete="tel"
            required
          />
        </Field>
      </div>

      {!isImob && (
        <Field
          label="Data de nascimento"
          icon={<Calendar className="size-3.5" />}
          error={touched.birthDate && form.birthDate && !birthValid ? "Data inválida" : undefined}
        >
          <NeoInput
            type="date"
            value={form.birthDate}
            onChange={(e) => update("birthDate", e.target.value)}
            onBlur={() => touch("birthDate")}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </Field>
      )}

      <div className="flex gap-3 pt-3">
        <BackButton onClick={onBack} />
        <NextButton disabled={!canNext}>Continuar</NextButton>
      </div>
    </form>
  );
}

/* -------------------- Passo 3 · Termos -------------------- */

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
      <ScrollArea className="h-52 rounded-lg border border-zinc-200 bg-white p-4 text-xs text-zinc-500 leading-relaxed">
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">Termos de Serviço</h3>
        <p className="mb-3">
          Ao utilizar a plataforma NEXO, você concorda em usá-la exclusivamente para a gestão lícita de
          imóveis, contratos de locação, inquilinos, parcelas, repasses, manutenções e demais operações
          relacionadas. É vedado o uso para qualquer finalidade fraudulenta ou ilegal.
        </p>
        <p className="mb-3">
          A NEXO disponibiliza a infraestrutura tecnológica e poderá, a qualquer momento, atualizar
          funcionalidades, planos e políticas, comunicando alterações relevantes.
        </p>
        <h3 className="text-sm font-semibold text-zinc-900 mb-2 mt-4">Privacidade & LGPD</h3>
        <p className="mb-3">
          Coletamos dados cadastrais (nome, e-mail, CPF/CNPJ, telefone) e operacionais (imóveis, contratos,
          financeiro) para execução de contrato e cumprimento legal, conforme Lei nº 13.709/2018.
        </p>
        <p>
          Você possui direitos de acesso, correção, portabilidade e exclusão. Adotamos criptografia em
          trânsito/repouso, controle de acesso por papéis e auditoria contínua.
        </p>
      </ScrollArea>

      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer group">
          <Checkbox
            checked={form.acceptTerms}
            onCheckedChange={(c) => update("acceptTerms", c === true)}
            className="mt-0.5 border-zinc-700 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
          />
          <span className="text-xs text-zinc-700 leading-relaxed group-hover:text-zinc-900 transition-colors">
            Li e aceito os <span className="text-violet-600 font-medium">Termos de Serviço</span> e a{" "}
            <span className="text-violet-600 font-medium">Política de Privacidade</span>.
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <Checkbox
            checked={form.acceptLgpd}
            onCheckedChange={(c) => update("acceptLgpd", c === true)}
            className="mt-0.5 border-zinc-700 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
          />
          <span className="text-xs text-zinc-700 leading-relaxed group-hover:text-zinc-900 transition-colors">
            Consinto com o tratamento dos meus dados cadastrais e financeiros para provisionamento da
            plataforma, conforme a LGPD.
          </span>
        </label>
      </div>

      <div className="flex gap-3 pt-1">
        <BackButton onClick={onBack} disabled={submitting} />
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex-1 h-11 bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-40"
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

/* -------------------- Building blocks -------------------- */

function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
        {icon && <span className="text-zinc-500">{icon}</span>}
        {label}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1" role="alert">
          <AlertCircle className="size-3" /> {error}
        </p>
      )}
    </div>
  );
}

const NeoInput = (props: React.ComponentProps<typeof Input>) => (
  <Input
    {...props}
    className={cn(
      "h-11 bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400",
      "focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:border-violet-500 transition-colors",
      "aria-[invalid=true]:border-red-500/70 aria-[invalid=true]:focus-visible:ring-red-500/40",
      props.className,
    )}
  />
);

function NextButton({ disabled, children }: { disabled: boolean; children: React.ReactNode }) {
  return (
    <Button
      type="submit"
      disabled={disabled}
      className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-40 transition-all"
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
      className="h-11 bg-transparent border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
    >
      <ArrowLeft className="size-4 mr-1" /> Voltar
    </Button>
  );
}

/* -------------------- Sucesso -------------------- */

function SuccessPanel({ role, email }: { role: Role; email: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6 sm:p-8">
      <div className="text-center">
        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/40">
          <CheckCircle2 className="size-6" />
        </div>
        <h2 className="mt-4 text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
          Cadastro realizado!
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Enviamos um link de confirmação para{" "}
          <span className="text-zinc-900 font-medium">{email}</span>.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {role === "imobiliaria"
            ? "Sua imobiliária está pronta para começar."
            : "Sua conta de proprietário está pronta."}
        </p>
      </div>

      <div className="my-6 h-px bg-zinc-200" />

      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-violet-600 font-semibold">
          <Smartphone className="size-3" /> Baixe o aplicativo
        </div>
        <h3 className="mt-2 text-base font-semibold text-zinc-900">Leve o Nexo no bolso</h3>
        <p className="mt-1 text-xs text-zinc-500">Aponte a câmera do celular para o QR code.</p>
      </div>

      <div className="flex justify-center">
        <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
          <img
            src={appQrCode.url}
            alt="QR code para baixar o app Nexo"
            className="size-56 sm:size-64 rounded-md object-contain"
          />
        </div>
      </div>


      <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
        <Link to="/login" className="flex-1">
          <Button className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white">
            Ir para o login <ArrowRight className="size-4 ml-1" />
          </Button>
        </Link>
        <a href={appQrCode.url} download="nexo-app-qrcode.png" className="flex-1">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 bg-transparent border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
          >
            <Download className="size-4 mr-1" /> Baixar QR
          </Button>
        </a>
      </div>
    </div>
  );
}
