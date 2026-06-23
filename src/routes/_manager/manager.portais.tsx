import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Globe, RefreshCw, Loader2, Bell, Send, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CentralConexoesPanel } from "@/components/CentralConexoesPanel";
import {
  sendTestLeadNotification,
  listTeamMembersForTest,
  listTestPresets,
} from "@/lib/lead-test.functions";

export const Route = createFileRoute("/_manager/manager/portais")({
  head: () => ({ meta: [{ title: "Integrações com Portais — NEXO" }] }),
  component: ManagerPortaisPage,
});

function ManagerPortaisPage() {
  const { user } = useAuth();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["portal-integration", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profileRes, propsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("integration_imovelweb_connected, integration_zap_connected")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase
          .from("properties")
          .select("id, publish_imovelweb, publish_zap, status")
          .eq("user_id", user!.id),
      ]);
      if (profileRes.error) throw profileRes.error;
      const props = propsRes.data ?? [];
      return {
        connectedImw: Boolean(profileRes.data?.integration_imovelweb_connected),
        connectedZap: Boolean(profileRes.data?.integration_zap_connected),
        activeImw: props.some((p: any) => p.publish_imovelweb && p.status === "disponivel"),
        activeZap: props.some((p: any) => p.publish_zap && p.status === "disponivel"),
        total: props.length,
      };
    },
  });

  async function toggleConnection(
    field: "integration_imovelweb_connected" | "integration_zap_connected",
    value: boolean,
  ) {
    if (!user) return;
    const patch = { [field]: value } as Record<string, boolean>;
    const { error } = await supabase.from("profiles").update(patch as any).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Portal conectado com sucesso!" : "Portal desconectado.");
    refetch();
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Integrações com Portais</h1>
        <p className="text-muted-foreground mt-1">
          Conecte seus imóveis aos principais portais imobiliários do Brasil de forma automática.
        </p>
      </header>

      <CentralConexoesPanel />

      <div className="grid sm:grid-cols-2 gap-4">
        <PortalCard
          name="Imovelweb"
          description="Portal nacional de imóveis residenciais e comerciais."
          active={!!data?.activeImw}
          connected={!!data?.connectedImw}
          onToggle={(v) => toggleConnection("integration_imovelweb_connected", v)}
        />
        <PortalCard
          name="Grupo OLX (Zap / VivaReal)"
          description="Distribuição unificada nos portais Zap Imóveis e VivaReal."
          active={!!data?.activeZap}
          connected={!!data?.connectedZap}
          onToggle={(v) => toggleConnection("integration_zap_connected", v)}
        />
      </div>

      <Card className="p-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>{data?.total ?? 0} imóvel(is) na carteira • Sincronização automática a cada 5 minutos.</>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-3.5 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar status
        </Button>
      </Card>

      <TestLeadNotificationCard />
    </div>
  );
}

function TestLeadNotificationCard() {
  const send = useServerFn(sendTestLeadNotification);
  const fetchMembers = useServerFn(listTeamMembersForTest);
  const [memberId, setMemberId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["test-lead-members"],
    queryFn: () => fetchMembers(),
  });

  async function handleSend() {
    if (!memberId) {
      toast.error("Selecione um membro da equipe.");
      return;
    }
    setLoading(true);
    try {
      const res = await send({ data: { memberId } });
      toast.success(`Mensagem de teste enviada para ${res.memberName ?? res.phone}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar mensagem de teste");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5 space-y-4 border-dashed">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bell className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Testar notificação de lead</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Simula a mensagem que o corretor recebe no WhatsApp quando um lead chega de um portal.
          </p>
        </div>
      </div>

      <pre className="text-xs bg-muted/50 rounded-md p-3 whitespace-pre-wrap font-mono leading-relaxed">
{SAMPLE_LEAD_MESSAGE}
      </pre>

      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={memberId} onValueChange={setMemberId} disabled={loadingMembers}>
          <SelectTrigger className="flex-1">
            <SelectValue
              placeholder={
                loadingMembers
                  ? "Carregando equipe…"
                  : members.length === 0
                    ? "Nenhum membro com telefone cadastrado"
                    : "Selecione um membro da equipe"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {members.map((m: any) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name} {m.role_label ? `— ${m.role_label}` : ""} ({m.phone})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSend} disabled={loading || !memberId}>
          {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
          Enviar teste
        </Button>
      </div>
    </Card>
  );
}


function PortalCard({
  name, description, active, connected, onToggle,
}: { name: string; description: string; active: boolean; connected: boolean; onToggle: (v: boolean) => void }) {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Globe className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        {!connected ? (
          <Badge variant="secondary">Não conectado</Badge>
        ) : active ? (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
            Sincronização Ativa
          </Badge>
        ) : (
          <Badge className="bg-primary/10 text-primary border border-primary/30">Conectado</Badge>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {connected ? (
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onToggle(false)}>
            Desconectar
          </Button>
        ) : (
          <Button size="sm" className="flex-1" onClick={() => onToggle(true)}>
            Conectar portal
          </Button>
        )}
      </div>
    </Card>
  );
}
