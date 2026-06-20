import { Link } from "@tanstack/react-router";
import { Bell, AlertCircle, AlertTriangle, Info, BellOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  SEVERITY_LABEL,
  SEVERITY_STYLES,
  type Alert,
  type AlertSeverity,
} from "@/lib/alerts";

const ICONS: Record<AlertSeverity, typeof Bell> = {
  critico: AlertCircle,
  atencao: AlertTriangle,
  informativo: Info,
};

type Props = {
  alerts: Alert[];
  seeAllHref: string;
  className?: string;
};

export function AlertsBell({ alerts, seeAllHref, className }: Props) {
  const unread = alerts.length;
  const hasCritical = alerts.some((a) => a.severity === "critico");
  const indicatorColor = hasCritical
    ? "bg-destructive shadow-[0_0_8px_2px_hsl(var(--destructive)/0.6)]"
    : "bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.6)]";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Alertas${unread > 0 ? ` (${unread} não lidos)` : ""}`}
          className={cn(
            "relative inline-flex size-9 items-center justify-center rounded-full text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
            className,
          )}
        >
          <Bell className="size-[18px]" strokeWidth={1.75} />
          {unread > 0 && (
            <span className={cn("absolute top-1.5 right-1.5 size-2 rounded-full animate-pulse", indicatorColor)} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] p-0 overflow-hidden border-sidebar-border"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <span className="text-sm font-semibold">Alertas</span>
            {unread > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                {unread}
              </span>
            )}
          </div>
          <Link
            to={seeAllHref as any}
            className="text-xs text-primary hover:underline"
          >
            Ver todos
          </Link>
        </div>

        {unread === 0 ? (
          <div className="p-8 text-center">
            <BellOff className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Tudo em dia — nenhum alerta.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[380px]">
            <ul className="divide-y divide-border">
              {alerts.slice(0, 12).map((a) => {
                const Icon = ICONS[a.severity];
                const style = SEVERITY_STYLES[a.severity];
                const inner = (
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-sidebar-accent/40 transition-colors">
                    <div className={cn("mt-0.5 size-1.5 rounded-full shrink-0", a.severity === "critico" ? "bg-destructive" : a.severity === "atencao" ? "bg-amber-500" : "bg-primary")} />
                    <Icon className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wide", style.badge)}>
                          {SEVERITY_LABEL[a.severity]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                      {a.date && (
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{formatDate(a.date)}</p>
                      )}
                    </div>
                  </div>
                );
                return (
                  <li key={a.id}>
                    {a.link ? (
                      <Link to={a.link as any} className="block">{inner}</Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
