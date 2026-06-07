import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, AlertTriangle, AlertCircle, Info, BellOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  SEVERITY_LABEL,
  SEVERITY_STYLES,
  useTenantAlerts,
  type Alert,
  type AlertSeverity,
} from "@/lib/alerts";

export const Route = createFileRoute("/_authenticated/tenant/alertas")({
  head: () => ({ meta: [{ title: "Alertas — Nexo Inquilino" }] }),
  component: TenantAlertasPage,
});

const ICONS: Record<AlertSeverity, typeof Bell> = {
  critico: AlertCircle,
  atencao: AlertTriangle,
  informativo: Info,
};

function TenantAlertasPage() {
  const { alerts } = useTenantAlerts();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="size-6 text-primary" /> Alertas
        </h1>
        <p className="text-sm text-muted-foreground">Suas pendências e avisos importantes.</p>
      </header>

      {alerts.length === 0 ? (
        <Card className="p-8 text-center">
          <BellOff className="size-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum alerta no momento. 🎉</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const Icon = ICONS[alert.severity];
  const style = SEVERITY_STYLES[alert.severity];
  const content = (
    <Card className={cn("p-4 border-l-4 hover:shadow-md transition-shadow", style.border)}>
      <div className="flex items-start gap-3">
        <Icon className="size-5 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{alert.title}</p>
            <Badge className={cn("text-[10px]", style.badge)}>
              {SEVERITY_LABEL[alert.severity]}
            </Badge>
            {alert.date && (
              <span className="text-[11px] text-muted-foreground">{formatDate(alert.date)}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
        </div>
      </div>
    </Card>
  );

  if (alert.link) {
    return (
      <Link to={alert.link as any} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
