import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Database as DbIcon, 
  Globe, 
  Zap 
} from "lucide-react";
import { PageHeader, PageShell } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSystemStatus } from "@/lib/monitoring.functions";
import { formatDate } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/health")({
  head: () => ({ meta: [{ title: "Saúde do Sistema — NEXO" }] }),
  component: SystemHealthPage,
});

function SystemHealthPage() {
  const fetchStatus = useServerFn(getSystemStatus);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => fetchStatus(),
    refetchInterval: 30000,
  });

  const logs = data?.logs || [];
  const criticalCount = data?.criticalIncidentsCount || 0;

  return (
    <PageShell>
      <PageHeader
        icon={Activity}
        eyebrow="Administração"
        title="Saúde do Sistema"
        description="Monitoramento em tempo real da infraestrutura, banco de dados e integrações."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={criticalCount > 0 ? "destructive" : "outline"} className="px-3 py-1">
              {criticalCount > 0 ? `${criticalCount} Incidentes Críticos` : "Operacional"}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatusCard title="Database" status="online" icon={DbIcon} />
        <StatusCard title="Edge Functions" status="online" icon={Zap} />
        <StatusCard title="Efí API" status="online" icon={Globe} />
        <StatusCard title="WhatsApp API" status="online" icon={Zap} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" />
            Logs Recentes de Eventos
          </CardTitle>
          <Badge variant="secondary" className="cursor-pointer" onClick={() => refetch()}>
            Atualizar Agora
          </Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="size-12 mx-auto mb-3 opacity-20" />
              Nenhum evento registrado recentemente.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">{log.service}</TableCell>
                    <TableCell className="max-w-xs truncate" title={log.error_message}>
                      {log.event_type}
                      {log.error_message && (
                        <span className="block text-[10px] text-muted-foreground truncate">
                          {log.error_message}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={log.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function StatusCard({ title, status, icon: Icon }: { title: string; status: string; icon: any }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="p-3 rounded-xl bg-primary/5 text-primary">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-sm font-bold uppercase tracking-wide">{status}</p>
        </div>
      </div>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    error: "bg-red-500/10 text-red-500 border-red-500/30",
    critical: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <Badge variant="outline" className={map[severity]}>
      {severity}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    detected: "bg-zinc-500/10 text-zinc-500",
    investigating: "bg-amber-500/10 text-amber-500",
    mitigated: "bg-blue-500/10 text-blue-500",
    resolved: "bg-emerald-500/10 text-emerald-500",
  };
  return (
    <Badge variant="outline" className={map[status]}>
      {status}
    </Badge>
  );
}
