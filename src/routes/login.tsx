import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as ReCAPTCHAModule from "react-google-recaptcha";
// react-google-recaptcha is CJS — under SSR the default import can resolve
// to the module namespace { default: Component } instead of the component.
const ReCAPTCHA: typeof import("react-google-recaptcha").default =
  (ReCAPTCHAModule as any).default?.default ??
  (ReCAPTCHAModule as any).default ??
  (ReCAPTCHAModule as any);

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import nexoLogoAsset from "@/assets/nexo-logo.png.asset.json";
import nexoLogoDarkAsset from "@/assets/nexo-logo-dark.png.asset.json";
import { useTheme } from "@/components/ThemeProvider";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRecaptchaSiteKey } from "@/lib/recaptcha.functions";
import { isPreviewClient } from "@/lib/recaptcha-client";


export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Nexo" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const nexoLogo = isDark ? nexoLogoDarkAsset.url : nexoLogoAsset.url;
  const navigate = useNavigate();
  const { user, loading } = useAuth();



  useEffect(() => {

    if (loading || !user) return;
    if (loading || !user) return;
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const r = (roles ?? []).map((x: any) => x.role);
      const target = r.includes("manager") ? "/manager"
        : r.includes("landlord") ? "/landlord"
        : r.includes("tenant") ? "/tenant"
        : "/dashboard";
      navigate({ to: target, replace: true });
    })();
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-[100dvh] grid lg:grid-cols-[1.05fr_1fr] overflow-x-hidden">
      {/* Fundo violeta com grade — visível em mobile/tablet */}
      <div
        className="lg:hidden pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute top-[-12%] left-[-8%] size-[280px] sm:size-[420px] rounded-full bg-fuchsia-500/25 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] size-[260px] sm:size-[380px] rounded-full bg-violet-400/25 blur-[120px]" />

        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 75%)",
          }}
        />
      </div>

      {/* Painel brand — sempre dark/violet, independente do tema escolhido pelo usuário */}
      <div
        className="hidden lg:flex relative flex-col justify-between p-12 text-white overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        {/* Camadas decorativas */}
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
          <div className="absolute top-[-12%] left-[-8%] size-[520px] rounded-full bg-fuchsia-500/25 blur-[120px]" />
          <div className="absolute bottom-[-15%] right-[-10%] size-[480px] rounded-full bg-violet-400/25 blur-[120px]" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 75%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <span className="size-2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
          </span>
          <span className="text-sm font-medium tracking-wide opacity-80">Nexo · gestão imobiliária</span>
        </div>

        <div className="relative flex flex-col items-center gap-8 flex-1 justify-center">
          <div className="flex items-center justify-center px-6">
            <img src={nexoLogoDarkAsset.url} alt="Nexo" className="h-32 w-auto max-w-full object-contain drop-shadow-[0_8px_32px_rgba(139,92,246,0.45)]" />
          </div>

          <div className="text-center max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight text-balance">
              Controle total dos seus<br />
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-pink-200 bg-clip-text text-transparent">
                imóveis e aluguéis.
              </span>
            </h1>
            <p className="mt-5 text-white/70 text-[15px] leading-relaxed">
              Inquilinos, contratos, parcelas e manutenções em uma única plataforma moderna e segura.
            </p>
          </div>
        </div>

        <p className="relative text-xs text-white/40 text-center">© {new Date().getFullYear()} Nexo</p>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-6 lg:p-12 lg:bg-background">
        <Card className="w-full max-w-md p-8 border-border/60 shadow-card surface-1">
          <div className="lg:hidden flex justify-center items-center mb-6">
            <img src={nexoLogo} alt="Nexo" className="h-14 w-auto max-w-full object-contain" />
          </div>

          <div className="text-center mb-7">
            <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h2>
            <p className="text-sm text-muted-foreground mt-1.5">Entre com sua conta para continuar</p>
          </div>
          <SignInForm />
        </Card>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const captchaRef = useRef<import("react-google-recaptcha").default | null>(null);
  const navigate = useNavigate();
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

  const canSubmit =
    !!email && !!password && (!recaptchaEnabled || !!captchaToken) && !busy;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (recaptchaEnabled && !captchaToken) {
          toast.error("Por favor, complete a verificação reCAPTCHA.");
          return;
        }
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: recaptchaEnabled && captchaToken ? { captchaToken } : undefined,
        });
        if (error) {
          setBusy(false);
          captchaRef.current?.reset();
          setCaptchaToken(null);
          return toast.error(error.message);
        }
        // Aceita convite de proprietário pendente (se houver)
        const pendingInvite = typeof window !== "undefined"
          ? window.localStorage.getItem("landlord_invite_token")
          : null;
        let landed: "landlord" | null = null;
        if (pendingInvite) {
          try {
            const { error: rpcErr } = await supabase.rpc("accept_landlord_invite", { _token: pendingInvite });
            if (!rpcErr) {
              landed = "landlord";
              toast.success("Convite aceito! Você agora é Proprietário na NEXO.");
            } else {
              toast.error("Convite inválido ou já utilizado.");
            }
          } catch { /* silencioso */ }
          window.localStorage.removeItem("landlord_invite_token");
        }
        setBusy(false);
        toast.success("Bem-vindo de volta!");
        // Descobre a melhor home com base em roles atuais
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
          const r = (roles ?? []).map((x: any) => x.role);
          const target = landed === "landlord" || r.includes("landlord")
            ? "/landlord"
            : r.includes("manager") ? "/manager"
            : r.includes("tenant") ? "/tenant"
            : "/dashboard";
          navigate({ to: target, replace: true });
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      {recaptchaEnabled && (
        <div className="flex justify-center pt-1 w-full">
          <div className="w-[237px] h-[61px] sm:w-[304px] sm:h-[78px] max-w-full rounded-md overflow-hidden ring-1 ring-border">
            <ClientOnly fallback={<div className="w-[237px] h-[61px] sm:w-[304px] sm:h-[78px] bg-muted animate-pulse rounded-md" />}>
              <div className="origin-top-left scale-[0.78] sm:scale-100 w-[304px] h-[78px]">
                {recaptchaSiteKey ? (
                  <ReCAPTCHA
                    ref={captchaRef}
                    sitekey={recaptchaSiteKey}
                    theme="dark"
                    onChange={(token) => setCaptchaToken(token)}
                    onExpired={() => setCaptchaToken(null)}
                    onErrored={() => setCaptchaToken(null)}
                  />
                ) : (
                  <div className="w-[304px] h-[78px] bg-muted animate-pulse rounded-md" />
                )}
              </div>
            </ClientOnly>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {busy && <Loader2 className="size-4 animate-spin mr-2" />}
        Entrar
      </Button>
    </form>
  );
}

