import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  User,
  Phone,
  FileText,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { isValidCPF, isValidPhone, maskCPF, maskPhone, onlyDigits, scorePassword } from "@/lib/br-validators";
// asaas removed

export const Route = createFileRoute("/tenant-setup")({
  ssr: false,
  head: () => ({ meta: [{ title: "Acesso do Inquilino — Nexo" }] }),
  component: TenantSetupPage,
});

function TenantSetupPage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeTenantSetup);

  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    document: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    acceptTerms: false,
    acceptFee: false,
  });
  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user?.email) {
        setForm((s) => ({
          ...s,
          email: data.session!.user!.email!,
          fullName: (data.session!.user!.user_metadata?.full_name as string) ?? "",
        }));
      }
      setLoadingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const [showPw, setShowPw] = useState(false);
  const strength = useMemo(() => scorePassword(form.password), [form.password]);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const matches = form.password.length > 0 && form.password === form.confirm;
  const docOk = isValidCPF(form.document);
  const phoneOk = isValidPhone(form.phone);
  const nameOk = form.fullName.trim().length >= 3;
  const canSubmit =
    nameOk &&
    docOk &&
    emailOk &&
    phoneOk &&
    strength.valid &&
    matches &&
    form.acceptTerms &&
    form.acceptFee &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: form.password,
        data: { full_name: form.fullName },
      });
      if (error) throw error;

      const res = await complete({
        data: {
          fullName: form.fullName.trim(),
          document: onlyDigits(form.document),
          email: form.email.trim(),
          phone: onlyDigits(form.phone),
          acceptTerms: true,
          acceptNexoFee: true,
        },
      });
      if (!res.ok) {
        toast.warning("Conta criada, mas não encontramos seu cadastro. Avise a imobiliária.");
      } else {
        toast.success("Cadastro concluído!");
      }
      setDone(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao concluir cadastro");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <Shell>
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-8 shadow-2xl text-center">
          <h1 className="text-2xl font-semibold">Convite inválido ou expirado</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Peça à sua imobiliária para reenviar o convite por WhatsApp.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/login" })}>
            Ir para o login
          </Button>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-8 shadow-2xl text-center">
          <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/40 shadow-[0_0_30px_-4px_rgba(16,185,129,0.6)]">
            <CheckCircle2 className="size-7" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Tudo pronto!</h2>
          <p className="mt-2 text-sm text-zinc-400">Sua conta foi vinculada com sucesso.</p>
          <Button
            className="mt-6 h-11 bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.7)]"
            onClick={() => navigate({ to: "/tenant" })}
          >
            <ArrowRight className="size-4 mr-1" /> Acessar portal
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-violet-400 font-medium">Inquilino</p>
          <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
            Conclua seu acesso à Nexo
          </h1>
          <p className="mt-2 text-xs text-zinc-500">
            Confirme seus dados e defina uma senha para entrar no portal.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Nome completo" icon={<User className="size-4" />}>
            <NeoInput
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="Como aparece no documento"
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="CPF" icon={<FileText className="size-4" />}>
              <NeoInput
                value={form.document}
                onChange={(e) => update("document", maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                required
              />
              {form.document.length > 0 && !docOk && (
                <p className="text-xs text-red-400 mt-1">CPF inválido</p>
              )}
            </Field>

            <Field label="Telefone" icon={<Phone className="size-4" />}>
              <NeoInput
                value={form.phone}
                onChange={(e) => update("phone", maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                required
              />
              {form.phone.length > 0 && !phoneOk && (
                <p className="text-xs text-red-400 mt-1">Telefone inválido</p>
              )}
            </Field>
          </div>

          <Field label="E-mail" icon={<Mail className="size-4" />}>
            <NeoInput
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="voce@email.com"
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

          <ScrollArea className="h-40 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-400 leading-relaxed">
            <h3 className="text-sm font-medium text-zinc-200 mb-2">Termos & Taxa Nexo</h3>
            <p className="mb-2">
              Ao concluir, você concorda com os Termos de Serviço e a Política de Privacidade da Nexo,
              autorizando o uso dos seus dados para gestão da sua locação.
            </p>
            <p>
              Você também aceita que será adicionada uma <strong className="text-zinc-200">taxa
              administrativa Nexo</strong> em cada boleto/PIX gerado, destinada à manutenção da
              plataforma. O valor da taxa é informado em cada cobrança.
            </p>
          </ScrollArea>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={form.acceptTerms}
                onCheckedChange={(c) => update("acceptTerms", c === true)}
                className="mt-0.5 border-zinc-700 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
              />
              <span className="text-xs text-zinc-300 leading-relaxed group-hover:text-zinc-100 inline-flex items-start gap-1.5">
                <ShieldCheck className="size-3.5 text-violet-400 mt-0.5 shrink-0" />
                Li e aceito os <span className="text-violet-400">Termos de Serviço</span> e a{" "}
                <span className="text-violet-400">Política de Privacidade</span> da Nexo.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={form.acceptFee}
                onCheckedChange={(c) => update("acceptFee", c === true)}
                className="mt-0.5 border-zinc-700 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
              />
              <span className="text-xs text-zinc-300 leading-relaxed group-hover:text-zinc-100 inline-flex items-start gap-1.5">
                <Receipt className="size-3.5 text-violet-400 mt-0.5 shrink-0" />
                Aceito a <span className="text-violet-400">taxa adicional Nexo</span> incluída em cada
                boleto/PIX da minha locação.
              </span>
            </label>
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-medium",
              "shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)]",
              "disabled:opacity-40 disabled:shadow-none",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" /> Concluindo…
              </>
            ) : (
              <>
                <KeyRound className="size-4 mr-2" /> Concluir cadastro
              </>
            )}
          </Button>
        </form>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 size-[400px] rounded-full bg-fuchsia-500/10 blur-[100px]" />
      </div>
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          <div className="mb-6 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Portal do Inquilino</span>
            <Link to="/login" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Já tenho conta
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

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
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span>8+ caracteres + 2 de: maiúscula, número, especial</span>
        {strength.score > 0 && (
          <span className={cn("font-medium", strength.valid ? "text-emerald-400" : "text-zinc-400")}>
            {labels[strength.score]}
          </span>
        )}
      </div>
    </div>
  );
}
