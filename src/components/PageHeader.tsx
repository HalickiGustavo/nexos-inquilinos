import { ReactNode, ComponentType } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col sm:flex-row items-start sm:justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          {Icon && <Icon className="size-6 text-primary shrink-0" />}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

interface PageShellProps {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}

export function PageShell({ children, className, narrow }: PageShellProps) {
  return (
    <div
      className={cn(
        "p-4 sm:p-6 lg:p-8 mx-auto space-y-6",
        narrow ? "max-w-4xl" : "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
