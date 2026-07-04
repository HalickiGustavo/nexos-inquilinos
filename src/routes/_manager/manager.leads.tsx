import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox, Phone, Mail, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_manager/manager/leads")({
  component: LeadsPipeline,
});

const STAGES = [
  { id: "novos", label: "Novos Leads" },
  { id: "contato", label: "Em Contato" },
  { id: "proposta", label: "Proposta" },
  { id: "fechado", label: "Fechado" },
] as const;

function LeadsPipeline() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mgr-portal-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*, broker:manager_members!crm_leads_routed_member_id_fkey(name)")
        .eq("source", "portal")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: alert when a brand new lead arrives
  useEffect(() => {
    const channel = supabase
      .channel("crm_leads_portal_alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crm_leads" },
        (payload) => {
          const row: any = payload.new;
          if (row?.source !== "portal") return;
          toast.success(`Novo lead recebido: ${row.name}`, {
            description: row.routing_criteria_used
              ? `Atribuído por: ${row.routing_criteria_used}`
              : undefined,
          });
          qc.invalidateQueries({ queryKey: ["mgr-portal-leads"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return (
    <PageShell>
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><Sparkles className="size-3" /> Roleta de Portais</span>}
        title="Leads de Portais"
        description="Distribuição automática de Zap, VivaReal, OLX e demais integrados."
      />


      <div className="overflow-x-auto -mx-6 px-6 pb-2">
        <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] lg:grid-flow-row lg:grid-cols-4 gap-4">
          {STAGES.map((stage) => {
            const items = (q.data ?? []).filter((l: any) => l.stage === stage.id);
            return (
              <div
                key={stage.id}
                className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-3 min-h-[420px]"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <div className="text-xs text-muted-foreground/60 px-1 py-6 text-center">
                      <Inbox className="size-4 mx-auto mb-1 opacity-50" />
                      Nada por aqui
                    </div>
                  )}
                  {items.map((lead: any) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: any }) {
  const brokerName = lead.broker?.name ?? null;
  return (
    <Card className="border-border/60 bg-card/80 hover:border-primary/50 transition-colors shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-sm leading-tight">{lead.name}</div>
          {lead.portal_origin && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider border-primary/40 text-primary"
            >
              {lead.portal_origin}
            </Badge>
          )}
        </div>

        {lead.interested_code && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="size-3" />
            {lead.interested_code}
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="size-3" />
            {lead.phone}
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <Mail className="size-3 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.notes && (
          <div className="text-xs text-muted-foreground/80 line-clamp-2 pt-1 border-t border-border/40">
            {lead.notes}
          </div>
        )}

        {(brokerName || lead.routing_criteria_used) && (
          <div className="pt-2 mt-1 border-t border-border/40">
            <div
              className="text-[11px] rounded-md px-2 py-1.5 bg-primary/10 text-primary border border-primary/30"
              style={{ boxShadow: "0 0 12px -4px hsl(var(--primary) / 0.4)" }}
            >
              <span className="opacity-80">Atribuído a: </span>
              <span className="font-semibold">{brokerName ?? "—"}</span>
              {lead.routing_criteria_used && (
                <>
                  <span className="opacity-70"> · Regra: </span>
                  <span className="font-medium">{lead.routing_criteria_used}</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground/60 pt-1">
          {new Date(lead.created_at).toLocaleString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );
}
