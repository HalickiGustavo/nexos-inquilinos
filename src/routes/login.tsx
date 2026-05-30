import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Gestão de Imóveis" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <div className="size-9 rounded-lg bg-primary grid place-items-center">
            <Building2 className="size-5 text-primary-foreground" />
          </div>
          ImovelPro
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Controle total dos seus<br />
            <span className="text-primary">imóveis e aluguéis.</span>
          </h1>
          <p className="mt-4 text-sidebar-foreground/70 max-w-md">
            Gerencie inquilinos, contratos, parcelas e manutenções em uma única plataforma moderna e segura.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} ImovelPro</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md p-8 shadow-lg">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="size-9 rounded-lg bg-primary grid place-items-center">
              <Building2 className="size-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">ImovelPro</span>
          </div>
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-6">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) return toast.error(error.message);
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
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin mr-2" />}
        Entrar
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        setBusy(false);
        if (error) return toast.error(error.message);
        toast.success("Conta criada! Verifique seu email para confirmar.");
        navigate({ to: "/dashboard", replace: true });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-up">Email</Label>
        <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-up">Senha</Label>
        <Input id="password-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin mr-2" />}
        Criar conta
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Já tem conta?{" "}
        <Link to="/login" className="underline">Entrar</Link>
      </p>
    </form>
  );
}
