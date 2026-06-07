import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, AlertTriangle, AlertCircle, Info, BellOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  SEVERITY_LABEL,
  SEVERITY_STYLES,
  useManagerAlerts,
  type Alert,
  type AlertSeverity,
} from "@/lib/alerts";

export const Route = createFileRoute("/_manager/manager/alertas")({
  head: () => ({ meta: [{ title: "Alertas — NEXO Manager" }] }),
  component: AlertasPage,
});

const ICONS: Record<AlertSeverity, typeof Bell> = {
  critico: AlertCircle,
  atencao: AlertTriangle,
  informativo: Info,
};

function AlertasPage() {
  const { alerts, isLoading } = useManagerAlerts();
  const counts = {
    critico: alerts.filter((a) => a.severity === "critico").length,
    atencao: alerts.filter((a) => a.severity === "atencao").length,
    informativo: alerts.filter((a) => a.severity === "informativo").length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="size-7 text-primary" /> Alertas
        </h1>
        <p className="text-muted-foreground mt-1">
          Pendências computadas em tempo real a partir de contratos, parcelas, manutenções e vistorias.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard severity="critico" count={counts.critico} />
        <SummaryCard severity="atencao" count={counts.atencao} />
        <SummaryCard severity="informativo" count={counts.informativo} />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : alerts.length === 0 ? (
        <Card className="p-12 text-center">
          <BellOff className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Tudo em dia — nenhum alerta no momento. 🎉</p>
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

function SummaryCard({ severity, count }: { severity: AlertSeverity; count: number }) {
  const Icon = ICONS[severity];
  const style = SEVERITY_STYLES[severity];
  return (
    <Card className={cn("p-4 border-l-4", style.border)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {SEVERITY_LABEL[severity]}
          </p>
          <p className="text-3xl font-bold mt-1">{count}</p>
        </div>
        <Icon className="size-7 text-muted-foreground" />
      </div>
    </Card>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const Icon = ICONS[alert.severity];
  const style = SEVERITY_STYLES[alert.severity];
  const content = (
    <Card
      className={cn(
        "p-4 border-l-4 hover:shadow-md transition-shadow cursor-pointer",
        style.border,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="size-5 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{alert.title}</p>
            <Badge className={style.badge}>{SEVERITY_LABEL[alert.severity]}</Badge>
            {alert.date && (
              <span className="text-xs text-muted-foreground">{formatDate(alert.date)}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{alert.description}</p>
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
