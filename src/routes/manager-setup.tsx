import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/manager-setup")({
  head: () => ({ meta: [{ title: "Ativar Imobiliária — Nexo Manager" }] }),
  component: ManagerSetup,
});

function ManagerSetup() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  const ativar = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "manager" } as any);
    setBusy(false);
    if (error && !error.message.includes("duplicate")) {
      toast.error("Erro ao ativar imobiliária");
      return;
    }
    toast.success("Imobiliária ativada!");
    navigate({ to: "/manager", replace: true });
  };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-muted/30">
      <Card className="max-w-lg w-full p-8 text-center space-y-4">
        <div className="mx-auto size-14 rounded-full bg-primary/10 grid place-items-center">
          <Building2 className="size-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Ativar conta de Imobiliária</h1>
        <p className="text-sm text-muted-foreground">
          Você terá acesso ao painel <strong>NEXO Manager</strong> com Carteira, Financeiro, Equipe e CRM.
        </p>
        <Button onClick={ativar} disabled={busy} className="w-full">
          {busy && <Loader2 className="size-4 animate-spin mr-2" />}
          Ativar agora
        </Button>
      </Card>
    </div>
  );
}
