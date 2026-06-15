import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, Globe, ShieldCheck, RefreshCw, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/integracoes")({
  head: () => ({ meta: [{ title: "Integrações com Portais — NEXO" }] }),
  component: AdminIntegracoesPage,
});

function AdminIntegracoesPage() {
  const { user } = useAuth();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["portal-integration", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profileRes, propsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("integration_token, full_name, integration_imovelweb_connected, integration_zap_connected")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase
          .from("properties")
          .select("id, publish_imovelweb, publish_zap, status")
          .eq("user_id", user!.id),
      ]);
      if (profileRes.error) throw profileRes.error;
      const props = propsRes.data ?? [];
      const activeImw = props.some((p: any) => p.publish_imovelweb && p.status === "disponivel");
      const activeZap = props.some((p: any) => p.publish_zap && p.status === "disponivel");
      return {
        token: profileRes.data?.integration_token as string | undefined,
        agency: profileRes.data?.full_name as string | undefined,
        connectedImw: Boolean(profileRes.data?.integration_imovelweb_connected),
        connectedZap: Boolean(profileRes.data?.integration_zap_connected),
        activeImw,
        activeZap,
        total: props.length,
      };
    },
  });

  async function toggleConnection(field: "integration_imovelweb_connected" | "integration_zap_connected", value: boolean) {
    if (!user) return;
    const patch: any = { [field]: value };
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Portal conectado com sucesso!" : "Portal desconectado.");
    refetch();
  }

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
  const feedUrl = data?.token ? `${supabaseUrl}/functions/v1/portal-xml-feed?token=${data.token}` : "";

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Integrações com Portais</h1>
        <p className="text-muted-foreground mt-1">
          Conecte sua carteira aos principais portais imobiliários do Brasil via feed XML automático.
        </p>
      </header>

      {/* Master Feed URL */}
      <Card className="p-6 space-y-4 border-primary/30">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">URL Mestre de Distribuição</h2>
            <p className="text-sm text-muted-foreground">
              Endereço seguro e tokenizado do feed XML. Cole esta URL no painel de cada portal.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-6 grid place-items-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <FeedUrlTrack url={feedUrl} />
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          O token é único, opaco e não exibe IDs internos. Compartilhe apenas com portais confiáveis.
        </div>
      </Card>

      {/* Portal connection cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <PortalCard
          name="Imovelweb"
          description="Portal nacional de imóveis residenciais e comerciais."
          active={!!data?.activeImw}
          connected={!!data?.connectedImw}
          feedUrl={feedUrl}
          onToggle={(v) => toggleConnection("integration_imovelweb_connected", v)}
        />
        <PortalCard
          name="Grupo OLX (Zap / VivaReal)"
          description="Distribuição unificada nos portais Zap Imóveis e VivaReal."
          active={!!data?.activeZap}
          connected={!!data?.connectedZap}
          feedUrl={feedUrl}
          onToggle={(v) => toggleConnection("integration_zap_connected", v)}
        />
      </div>

      <Card className="p-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {data?.total ?? 0} imóvel(is) na carteira • Sincronização automática a cada 5 minutos.
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-3.5 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar status
        </Button>
      </Card>
    </div>
  );
}

function FeedUrlTrack({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL do feed copiada com sucesso!", {
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      });
    } catch {
      toast.error("Não foi possível copiar a URL.");
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Input
        readOnly
        value={url}
        onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
        className="font-mono text-xs bg-muted/40 focus-visible:ring-primary"
      />
      <Button type="button" onClick={copy} className="shrink-0">
        <Copy className="size-4 mr-2" />
        {copied ? "Copiado!" : "Copiar URL do Feed"}
      </Button>
    </div>
  );
}

function PortalCard({
  name, description, active, connected, feedUrl, onToggle,
}: { name: string; description: string; active: boolean; connected: boolean; feedUrl: string; onToggle: (v: boolean) => void }) {
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
        <Button asChild variant="outline" size="sm" disabled={!feedUrl} className="flex-1">
          <a href={feedUrl || "#"} target="_blank" rel="noreferrer">
            Visualizar feed <ExternalLink className="size-3.5 ml-2" />
          </a>
        </Button>
      </div>
      {!connected && (
        <p className="text-[11px] text-muted-foreground">
          Conecte-se antes de habilitar a sincronização em qualquer imóvel.
        </p>
      )}
    </Card>
  );
}
