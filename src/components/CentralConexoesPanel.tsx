// Central de Conexões Técnicas — unified clean integration URLs per organization.
// Replaces the cluttered raw token-based URLs across portal config pages.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, Rss, Webhook, ShieldCheck, Loader2, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Connection = {
  id: "listings" | "leads";
  title: string;
  description: string;
  icon: typeof Rss;
  suffix: string;
  badge: string;
  externalOpen?: boolean;
};

const CONNECTIONS: Connection[] = [
  {
    id: "listings",
    title: "Feed XML de Imóveis",
    description: "Para Zap, VivaReal, OLX e Imovelweb sincronizarem seus anúncios automaticamente.",
    icon: Rss,
    suffix: "/listings.xml",
    badge: "Pronto para sincronização",
    externalOpen: true,
  },
  {
    id: "leads",
    title: "Webhook de Captura de Leads",
    description: "Endpoint para os portais enviarem cada novo lead em tempo real para sua roleta de corretores.",
    icon: Webhook,
    suffix: "/leads",
    badge: "Pronto para receber leads",
  },
];

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    const slugIdx = segments.findIndex((s) => s === "integrations") + 1;
    if (slugIdx > 0 && segments[slugIdx]) {
      const slug = segments[slugIdx];
      const masked = slug.length > 12 ? `${slug.slice(0, 6)}•••${slug.slice(-3)}` : slug;
      segments[slugIdx] = masked;
    }
    return `${u.host}/${segments.join("/")}`;
  } catch {
    return url;
  }
}

export function CentralConexoesPanel() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["org-slug", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agency_settings")
        .select("org_slug")
        .eq("manager_user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return { slug: (data?.org_slug as string | null) ?? null };
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const slug = data?.slug ?? "";

  return (
    <Card className="p-6 space-y-5 border-primary/30">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10">
          <Link2 className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Central de Conexões Técnicas</h2>
          <p className="text-sm text-muted-foreground">
            Endereços únicos da sua imobiliária para integração com portais e serviços externos.
          </p>
        </div>
      </div>

      {isLoading || !slug ? (
        <div className="py-10 grid place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {CONNECTIONS.map((c) => (
            <ConnectionRow
              key={c.id}
              connection={c}
              fullUrl={`${origin}/api/v1/integrations/${slug}${c.suffix}`}
            />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80">
        <ShieldCheck className="size-4 text-primary mt-0.5 shrink-0" />
        <p>
          Os endereços usam um identificador anônimo da sua organização. Nenhum dado interno
          (como IDs de banco de dados) é exposto. Compartilhe apenas com portais confiáveis.
        </p>
      </div>
    </Card>
  );
}

function ConnectionRow({ connection, fullUrl }: { connection: Connection; fullUrl: string }) {
  const [copied, setCopied] = useState(false);
  const Icon = connection.icon;

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Link copiado para a área de transferência! Cole no painel do portal parceiro.", {
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      });
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="rounded-lg border bg-background/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-md bg-primary/10 shrink-0">
            <Icon className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">{connection.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{connection.description}</p>
          </div>
        </div>
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_-2px_rgb(16_185_129_/_0.5)]">
          <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
          {connection.badge}
        </Badge>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          readOnly
          value={maskUrl(fullUrl)}
          onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
          className="font-mono text-xs bg-muted/40 truncate"
          aria-label={`Endereço de integração — ${connection.title}`}
        />
        <Button type="button" onClick={copy} className="shrink-0">
          <Copy className="size-4 mr-2" />
          {copied ? "Copiado!" : "Copiar Link de Integração"}
        </Button>
        {connection.externalOpen && (
          <Button asChild variant="outline" className="shrink-0">
            <a href={fullUrl} target="_blank" rel="noreferrer" aria-label="Abrir feed em nova aba">
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
