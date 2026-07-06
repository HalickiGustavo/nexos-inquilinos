import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, type LucideIcon } from "lucide-react";
import { NexoLogo } from "@/components/NexoLogo";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertsBell } from "@/components/AlertsBell";
import { OnboardingTour, type TourStep } from "@/components/OnboardingTour";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type ShellNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  tour?: string;
};

export type ShellNavGroup = {
  /** null / undefined = no section header */
  label?: string | null;
  items: ShellNavItem[];
};

export type ShellAlerts = {
  alerts: React.ComponentProps<typeof AlertsBell>["alerts"];
  seeAllHref: string;
};

export interface AppShellProps {
  /** Root link + subtitle shown next to the NEXO logo on desktop */
  brand: { to: string; subtitle?: string };
  /** Sidebar navigation, either flat (single group, no label) or grouped */
  navGroups: ShellNavGroup[];
  /** Optional global search rendered on the desktop top bar (manager) */
  search?: ReactNode;
  /** Optional alerts bell (mobile + desktop) */
  alerts?: ShellAlerts;
  /** Optional onboarding tour */
  tour?: { key: string; steps: TourStep[] };
  /**
   * Active-item visual style.
   * - "primary": solid primary background (owner, landlord).
   * - "accent":  sidebar-accent bg + left rail indicator (manager).
   */
  variant?: "primary" | "accent";
  /** Sidebar width (default: w-64). */
  sidebarWidth?: "w-60 lg:w-64" | "w-64";
  /** Mobile nav pill style. "pill" = rounded-full + border (manager/landlord); "chip" = rounded-md, no border (owner). */
  mobileNavStyle?: "pill" | "chip";
  /** Mobile header logo height class (default: h-8). */
  mobileLogoClass?: string;
  /** Sign-out button click handler; defaults to auth.signOut + navigate /login */
  onSignOut?: () => void | Promise<void>;
  /** PWA install button bottom offset */
  pwaBottomOffset?: number;
  children: ReactNode;
}

export function AppShell({
  brand,
  navGroups,
  search,
  alerts,
  tour,
  variant = "primary",
  sidebarWidth = "w-64",
  mobileNavStyle = "pill",
  mobileLogoClass = "h-8",
  onSignOut,
  pwaBottomOffset = 88,
  children,
}: AppShellProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const doSignOut = async () => {
    if (onSignOut) return onSignOut();
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const isActive = (item: ShellNavItem) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to);

  const flatItems = navGroups.flatMap((g) => g.items);
  const mlClass =
    sidebarWidth === "w-60 lg:w-64" ? "md:ml-60 lg:ml-64" : "md:ml-64";

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* ============ DESKTOP SIDEBAR ============ */}
      <aside
        className={cn(
          "hidden md:fixed md:left-0 md:top-0 md:h-screen md:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
          sidebarWidth,
        )}
      >
        <div
          className={cn(
            "border-b border-sidebar-border",
            variant === "accent" ? "px-4 py-4" : "p-4",
            variant === "primary" && !brand.subtitle && "p-5 bg-card",
          )}
        >
          <Link to={brand.to as any} className="flex items-center gap-2 min-w-0">
            <NexoLogo className={variant === "accent" ? "h-9" : "h-10"} alt="NEXO" />
            {brand.subtitle && (
              <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider hidden lg:block">
                {brand.subtitle}
              </span>
            )}
          </Link>
        </div>

        <nav
          className={cn(
            "flex-1 overflow-y-auto",
            variant === "accent" ? "px-2.5 py-3 space-y-4" : "p-3 space-y-1",
          )}
        >
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="px-2.5 mb-1.5 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/45 font-semibold">
                  {group.label}
                </div>
              )}
              <div className={variant === "accent" ? "space-y-0.5" : "space-y-1"}>
                {group.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  if (variant === "accent") {
                    return (
                      <Link
                        key={item.to}
                        to={item.to as any}
                        data-tour={item.tour}
                        className={cn(
                          "group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary"
                            aria-hidden
                          />
                        )}
                        <Icon
                          className={cn("size-4 shrink-0", active && "text-primary")}
                          strokeWidth={active ? 2.2 : 1.75}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  }
                  return (
                    <Link
                      key={item.to}
                      to={item.to as any}
                      data-tour={item.tour}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        active
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div
          className={cn(
            "border-t border-sidebar-border space-y-1",
            variant === "accent" ? "p-2.5" : "p-3",
          )}
        >
          <div
            className={cn(
              "truncate text-sidebar-foreground/60",
              variant === "accent" ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
            )}
          >
            {user?.email}
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              variant === "accent" && "h-9",
            )}
            onClick={doSignOut}
          >
            <LogOut className="size-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* ============ CONTENT ============ */}
      <div className={cn("flex-1 flex flex-col min-w-0", mlClass)}>
        {/* Desktop top bar (only when search or alerts exist) */}
        {(search || alerts) && (
          <div className="hidden md:flex sticky top-0 z-30 h-14 items-center gap-3 px-6 lg:px-8 bg-background/85 backdrop-blur border-b border-border">
            {search && <div className="flex-1 max-w-md">{search}</div>}
            {alerts && (
              <div className="ml-auto flex items-center gap-1">
                <AlertsBell alerts={alerts.alerts} seeAllHref={alerts.seeAllHref} />
              </div>
            )}
          </div>
        )}

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-40 bg-card border-b border-border shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 gap-2">
            <Link to={brand.to as any} className="flex items-center">
              <NexoLogo className="h-8" alt="NEXO" />
            </Link>
            <div className="flex items-center gap-1">
              {alerts && (
                <AlertsBell alerts={alerts.alerts} seeAllHref={alerts.seeAllHref} />
              )}
              <ThemeToggle size="icon" variant="ghost" />
              <Button
                variant="ghost"
                size="icon"
                className="text-foreground hover:bg-muted"
                onClick={doSignOut}
              >
                <LogOut className="size-5" />
              </Button>
            </div>
          </div>
          {search && <div className="px-4 pb-2">{search}</div>}

          <nav className="flex overflow-x-auto gap-1 p-2 border-t border-border">
            {flatItems.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to as any}
                  data-tour={item.tour}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={doSignOut}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border bg-muted text-muted-foreground border-border hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Sair
            </button>
          </nav>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {tour && <OnboardingTour tourKey={tour.key} steps={tour.steps} />}
      <InstallPwaButton bottomOffset={pwaBottomOffset} />
    </div>
  );
}
