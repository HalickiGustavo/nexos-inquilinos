import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  FileText,
  UserCheck,
  Wrench,
  Receipt,
  ThumbsUp,
  ThumbsDown,
  Coins,
  Camera,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  fetchMaintenanceEvents,
  type MaintenanceEventAction,
  type MaintenanceEventRow,
} from "@/lib/maintenance-events";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACTION_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  created: { label: "Solicitação criada", icon: FileText },
  status_changed: { label: "Status atualizado", icon: Circle },
  responsible_set: { label: "Responsável definido", icon: UserCheck },
  execution_responsible_set: { label: "Responsável pela execução definido", icon: Wrench },
  budget_submitted: { label: "Orçamento enviado", icon: Receipt },
  budget_approved: { label: "Orçamento aprovado", icon: ThumbsUp },
  budget_rejected: { label: "Orçamento recusado", icon: ThumbsDown },
  rent_deduction_applied: { label: "Abatimento no aluguel aplicado", icon: Coins },
  evidence_added: { label: "Anexos adicionados", icon: Camera },
  note: { label: "Observação", icon: MessageSquare },
};

function metaFor(action: MaintenanceEventAction | string) {
  return ACTION_META[action] ?? { label: action, icon: Circle };
}

export function MaintenanceTimeline({ maintenanceId }: { maintenanceId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["maintenance-events", maintenanceId],
    queryFn: () => fetchMaintenanceEvents(maintenanceId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Carregando histórico…
      </div>
    );
  }
  if (isError) {
    return <p className="text-xs text-destructive">Não foi possível carregar o histórico.</p>;
  }

  const events = data ?? [];
  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Ainda não há eventos registrados para esta manutenção.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-border pl-4 space-y-4">
      {events.map((ev, idx) => (
        <TimelineItem key={ev.id} event={ev} isLast={idx === events.length - 1} />
      ))}
    </ol>
  );
}

function TimelineItem({ event, isLast }: { event: MaintenanceEventRow; isLast: boolean }) {
  const { label, icon: Icon } = metaFor(event.action);
  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[22px] top-0.5 flex size-4 items-center justify-center rounded-full border",
          isLast
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground",
        )}
      >
        {isLast ? <CheckCircle2 className="size-3" /> : <Icon className="size-2.5" />}
      </span>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <time className="text-[10px] text-muted-foreground shrink-0">
          {formatDate(event.created_at)}
        </time>
      </div>
      {event.description && (
        <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
      )}
      {event.user_email && (
        <p className="text-[10px] text-muted-foreground/80 mt-0.5">
          por {event.user_email}
          {event.actor_role ? ` · ${event.actor_role}` : ""}
        </p>
      )}
    </li>
  );
}
