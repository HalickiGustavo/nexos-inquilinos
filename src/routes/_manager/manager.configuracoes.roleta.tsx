import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, RefreshCw, Shuffle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_manager/manager/configuracoes/roleta")({
  component: RoletaConfig,
});

const STRATEGIES = [
  { value: "DIRECT_OR_ROUND_ROBIN_ALPHABETICAL", label: "Ordem Alfabética", description: "Distribui em rodízio seguindo a ordem alfabética dos corretores." },
  { value: "DIRECT_OR_ROUND_ROBIN_SALES", label: "Volume de Vendas", description: "Balanceia carga priorizando quem tem menos vendas registradas." },
  { value: "DIRECT_OR_ROUND_ROBIN_TENURE", label: "Tempo de Trabalho", description: "Rodízio seguindo a senioridade, dos mais antigos para os mais novos." },
] as const;

function RoletaConfig() {
  const qc = useQueryClient();
  const [strategy, setStrategy] = useState<string>("DIRECT_OR_ROUND_ROBIN_ALPHABETICAL");

  const q = useQuery({
    queryKey: ["agency-settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;

      let { data } = await supabase
        .from("agency_settings")
        .select("*")
        .eq("manager_user_id", uid)
        .maybeSingle();

      if (!data) {
        const ins = await supabase
          .from("agency_settings")
          .insert({ manager_user_id: uid })
          .select("*")
          .single();
        data = ins.data!;
      }
      return data;
    },
  });

  useEffect(() => {
    if (q.data?.lead_routing_strategy) setStrategy(q.data.lead_routing_strategy);
  }, [q.data?.lead_routing_strategy]);

  const members = useQuery({
    queryKey: ["mgr-members-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("manager_members")
        .select("id, name, is_active, total_sales_count, hire_date, status")
        .order("name");
      return data ?? [];
    },
  });

  const save = async (nextStrategy: string) => {
    if (!q.data) return;
    const { error } = await supabase
      .from("agency_settings")
      .update({ lead_routing_strategy: nextStrategy })
      .eq("manager_user_id", q.data.manager_user_id);
    if (error) {
      toast.error("Falha ao atualizar estratégia", { description: error.message });
      return;
    }
    setStrategy(nextStrategy);
    toast.success("Estratégia de distribuição de leads atualizada com sucesso.");
    qc.invalidateQueries({ queryKey: ["agency-settings"] });
  };

  const rotateToken = async () => {
    if (!q.data) return;
    const newToken =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase
      .from("agency_settings")
      .update({ webhook_token: newToken })
      .eq("manager_user_id", q.data.manager_user_id);
    if (error) {
      toast.error("Falha ao rotacionar token", { description: error.message });
      return;
    }
    toast.success("Novo token de webhook gerado.");
    qc.invalidateQueries({ queryKey: ["agency-settings"] });
  };

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/webhooks/leads`
      : "/api/public/webhooks/leads";

  const activeCount = (members.data ?? []).filter(
    (m: any) => m.is_active && m.status === "ativo",
  ).length;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <header>
        <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80 flex items-center gap-2">
          <Shuffle className="size-3" /> Configurações
        </div>
        <h1 className="text-2xl font-bold mt-1">Roleta de Leads</h1>
        <p className="text-sm text-muted-foreground">
          Defina como leads recebidos dos portais são distribuídos para o time
        </p>
      </header>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Estratégia de Distribuição</CardTitle>
          <CardDescription>
            Aplicada quando o imóvel não possui um corretor responsável direto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label>Critério da roleta</Label>
            <Select value={strategy} onValueChange={save}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRATEGIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {STRATEGIES.find((s) => s.value === strategy)?.description}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Badge variant="outline" className="border-primary/40 text-primary">
              <CheckCircle2 className="size-3 mr-1" />
              {activeCount} corretor(es) ativo(s) na roleta
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Webhook dos Portais</CardTitle>
          <CardDescription>
            Configure este endpoint nos portais (Zap, VivaReal, OLX...) para receber leads automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.success("URL copiada");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Token de autenticação</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={q.data?.webhook_token ?? ""}
                className="font-mono text-xs"
                type="password"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (q.data?.webhook_token) {
                    navigator.clipboard.writeText(q.data.webhook_token);
                    toast.success("Token copiado");
                  }
                }}
              >
                <Copy className="size-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={rotateToken} title="Gerar novo token">
                <RefreshCw className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Envie o token no corpo da requisição como <code>token</code> ou no header{" "}
              <code>X-Webhook-Token</code>.
            </p>
          </div>

          <details className="text-xs text-muted-foreground/80 pt-2">
            <summary className="cursor-pointer select-none">Exemplo de payload</summary>
            <pre className="mt-2 p-3 rounded-md bg-muted/40 overflow-x-auto text-[11px]">
{`POST ${webhookUrl}
Content-Type: application/json

{
  "token": "<seu-token>",
  "portal": "zap",
  "property_code": "IM-AB12CD",
  "name": "Cliente Interessado",
  "email": "cliente@exemplo.com",
  "phone": "41999999999",
  "message": "Tenho interesse em agendar visita"
}`}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
