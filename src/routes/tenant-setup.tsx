import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { linkTenantUser } from "@/lib/asaas.functions";

export const Route = createFileRoute("/tenant-setup")({
  head: () => ({ meta: [{ title: "Acesso do Inquilino — Nexo" }] }),
  component: TenantSetupPage,
});

function TenantSetupPage() {
  const navigate = useNavigate();
  const link = useServerFn(linkTenantUser);
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loadingSession) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/30 p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold">Convite inválido ou expirado</h1>
          <p className="text-muted-foreground mt-2">
            Solicite ao seu proprietário/imobiliária um novo convite por e-mail.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/login" })}>
            Ir para o login
          </Button>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/30 p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle2 className="size-12 mx-auto text-primary mb-3" />
          <h1 className="text-2xl font-bold">Tudo pronto!</h1>
          <p className="text-muted-foreground mt-2">
            Sua conta foi vinculada ao seu cadastro de inquilino.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/tenant" })}>
            Acessar portal
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 p-6">
      <Card className="max-w-md w-full p-8 space-y-5">
        <div className="text-center">
          <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-3">
            <KeyRound className="size-5" />
          </div>
          <h1 className="text-2xl font-bold">Configure seu acesso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bem-vindo(a) ao Nexo. Defina uma senha para entrar no portal do inquilino.
          </p>
          <p className="text-xs text-muted-foreground mt-2">{session.user?.email}</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 6) return toast.error("Senha precisa ter ao menos 6 caracteres");
            if (password !== confirm) return toast.error("Senhas não coincidem");
            setSaving(true);
            try {
              const { error } = await supabase.auth.updateUser({ password });
              if (error) throw error;
              const res = await link();
              if (!res.ok) {
                toast.warning("Conta criada, mas não encontramos seu cadastro. Avise o proprietário.");
              } else {
                toast.success("Acesso configurado!");
              }
              setDone(true);
            } catch (err: any) {
              toast.error(err?.message ?? "Falha ao configurar acesso");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="space-y-2">
            <Label>Confirmar senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            Confirmar e acessar
          </Button>
        </form>
      </Card>
    </div>
  );
}
