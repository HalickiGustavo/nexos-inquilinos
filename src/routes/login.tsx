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

const RECAPTCHA_SITE_KEY = "6LfxdhktAAAAADHvwxq3_auLwuUSO3oNrDUlUkDx";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Nexo" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nexoLogo = nexoLogoAsset.url;
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex flex-col items-center gap-6 flex-1 justify-center">
          <div className="bg-white/95 rounded-xl py-4 mx-auto flex-col flex items-center justify-center px-[24px]">
            <img src={nexoLogo} alt="Nexo" className="h-28 w-80 object-contain my-0" />
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-bold leading-tight">
              Controle total dos seus<br />
              <span className="text-primary">imóveis e aluguéis.</span>
            </h1>
            <p className="mt-4 text-sidebar-foreground/70 max-w-md mx-auto">
              Gerencie inquilinos, contratos, parcelas e manutenções em uma única plataforma moderna e segura.
            </p>
          </div>
        </div>
        <p className="text-xs text-sidebar-foreground/50 text-center">© {new Date().getFullYear()} Nexo</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md p-8 shadow-lg">
          <div className="lg:hidden flex justify-center items-center mb-6">
            <img src={nexoLogo} alt="Nexo" className="h-10 w-auto" />
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold">Bem-vindo de volta</h2>
            <p className="text-sm text-muted-foreground mt-1">Entre com sua conta para continuar</p>
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

  const canSubmit = !!email && !!password && !!captchaToken && !busy;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!captchaToken) {
          toast.error("Por favor, complete a verificação reCAPTCHA.");
          return;
        }
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        });
        setBusy(false);
        if (error) {
          captchaRef.current?.reset();
          setCaptchaToken(null);
          return toast.error(error.message);
        }
        toast.success("Bem-vindo de volta!");
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

      <div className="flex justify-center pt-1">
        <div className="rounded-md overflow-hidden ring-1 ring-border">
          <ReCAPTCHA
            ref={captchaRef}
            sitekey={RECAPTCHA_SITE_KEY}
            theme="dark"
            onChange={(token) => setCaptchaToken(token)}
            onExpired={() => setCaptchaToken(null)}
            onErrored={() => setCaptchaToken(null)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {busy && <Loader2 className="size-4 animate-spin mr-2" />}
        Entrar
      </Button>
    </form>
  );
}

