import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as ReCAPTCHAModule from "react-google-recaptcha";
const ReCAPTCHA: typeof import("react-google-recaptcha").default =
  (ReCAPTCHAModule as any).default?.default ??
  (ReCAPTCHAModule as any).default ??
  (ReCAPTCHAModule as any);
import { toast } from "sonner";
import {
  Home as HomeIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  User,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isValidCPF,
  maskCPF,
  onlyDigits,
  scorePassword,
} from "@/lib/br-validators";

import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRecaptchaSiteKey } from "@/lib/recaptcha.functions";
import { isPreviewClient } from "@/lib/recaptcha-client";
import { sendWelcomeEmail } from "@/lib/welcome-email.functions";
import { activateLandlordRole } from "@/lib/landlord-setup.functions";
import { syncInviteToProfile } from "@/lib/invite-sync.functions";

type Search = { invite?: string; email?: string };

export const Route = createFileRoute("/cadastro-landlord")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => {
    const invite = typeof search.invite === "string" && /^[a-f0-9]{16,}$/i.test(search.invite) ? search.invite : undefined;
    const email = typeof search.email === "string" ? search.email : undefined;
    return { invite, email };
  },
  head: () => ({ meta: [{ title: "Cadastro de Proprietário — Nexo" }] }),
  component: CadastroLandlordPage,
});

function CadastroLandlordPage() {
  const { invite, email: emailParam } = useSearch({ from: "/cadastro-landlord" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<import("react-google-recaptcha").default | null>(null);

  const triggerWelcomeEmail = useServerFn(sendWelcomeEmail);
  const triggerLandlordSetup = useServerFn(activateLandlordRole);
  const triggerInviteSync = useServerFn(syncInviteToProfile);

  const [form, setForm] = useState({
    email: emailParam || "",
    password: "",
    fullName: "",
    document: "",
  });

  useEffect(() => {
    if (invite && typeof window !== "undefined") {
      window.localStorage.setItem("landlord_invite_token", invite);
    }
  }, [invite]);

  const strength = useMemo(() => scorePassword(form.password), [form.password]);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  
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

  const canSubmit = emailOk && strength.valid && form.fullName.length > 3 && isValidCPF(form.document) && (!recaptchaEnabled || !!captchaToken);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !canSubmit) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          captchaToken: captchaToken ?? undefined,
          data: {
            role: "landlord",
            full_name: form.fullName,
            document: onlyDigits(form.document),
          },
        },
      });
      if (error) throw error;

      try {
        await triggerLandlordSetup({ data: undefined });
        await triggerInviteSync({ data: { email: form.email } });
        await triggerWelcomeEmail({
          data: {
            email: form.email,
            fullName: form.fullName,
            role: "proprietario",
            document: form.document,
          },
        });
      } catch (err) {
        console.warn("Secondary setup failed:", err);
      }

      toast.success("Cadastro realizado! Verifique seu e-mail.");
      await supabase.auth.signOut().catch(() => {});
      setSuccess(true);
    } catch (err: any) {
      if (err?.message?.includes("User already registered") || err?.code === "23505") {
        toast.error("Este e-mail já está cadastrado. Tente fazer login.");
      } else {
        toast.error(err?.message || "Erro no cadastro.");
      }
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 p-8 text-center shadow-sm">
          <div className="size-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Conta criada!</h1>
          <p className="text-zinc-500 mb-8">
            Enviamos um link de confirmação para <strong>{form.email}</strong>. Por favor, valide seu e-email para acessar o painel.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Ir para o Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="mb-6">
          <Link to="/" className="text-zinc-500 hover:text-zinc-900 transition-colors inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8">
          <div className="mb-8">
            <div className="size-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center mb-4">
              <HomeIcon className="size-6" />
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900">Cadastro de Proprietário</h1>
            <p className="text-zinc-500 mt-1">Crie sua conta para gerir seus imóveis na Nexo.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={e => setForm(s => ({ ...s, fullName: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                  placeholder="Seu nome completo"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">CPF</label>
              <input
                type="text"
                required
                value={form.document}
                onChange={e => setForm(s => ({ ...s, document: maskCPF(e.target.value) }))}
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={e => setForm(s => ({ ...s, password: e.target.value }))}
                  className="w-full pl-10 pr-10 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        strength.score <= 1 ? "bg-rose-500" : strength.score <= 2 ? "bg-amber-500" : "bg-emerald-500"
                      )} 
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase font-medium">
                    {strength.score <= 1 ? "Senha fraca" : strength.score <= 2 ? "Senha razoável" : "Senha forte"}
                  </p>
                </div>
              )}
            </div>

            {recaptchaEnabled && (
              <div className="flex justify-center py-2">
                <ReCAPTCHA
                  ref={captchaRef}
                  sitekey={recaptchaSiteKey!}
                  onChange={setCaptchaToken}
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-violet-600 hover:bg-violet-700 h-11"
              disabled={submitting || !canSubmit}
            >
              {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : "Criar minha conta"}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-violet-600 font-medium hover:underline">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
