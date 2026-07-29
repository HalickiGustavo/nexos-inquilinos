import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, FileText, Wrench, LogOut, User, FolderOpen, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { NexoLogo } from "@/components/NexoLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OnboardingTour } from "@/components/OnboardingTour";
import { tenantTourSteps } from "@/lib/tour-steps";
import { AlertsBell } from "@/components/AlertsBell";
import { useTenantAlerts } from "@/lib/alerts";

const tenantNav: ReadonlyArray<{ to: string; label: string; icon: typeof Home; exact?: boolean; tour: string }> = [
  { to: "/tenant", label: "Início", icon: Home, exact: true, tour: "nav-tenant" },
  { to: "/tenant/chat", label: "Chat", icon: MessageSquare, tour: "nav-tenant-chat" },
  { to: "/tenant/financeiro", label: "Financeiro", icon: Wallet, tour: "nav-tenant-financeiro" },
  { to: "/tenant/contrato", label: "Contrato", icon: FileText, tour: "nav-tenant-contrato" },
  { to: "/tenant/documentos", label: "Documentos", icon: FolderOpen, tour: "nav-tenant-documentos" },
  { to: "/tenant/manutencoes", label: "Manutenções", icon: Wrench, tour: "nav-tenant-manutencoes" },
  { to: "/tenant/perfil", label: "Perfil", icon: User, tour: "nav-tenant-perfil" },
];


export function TenantShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { alerts } = useTenantAlerts();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Top header */}
      <header className="fixed top-0 inset-x-0 z-40 backdrop-blur-xl bg-card/85 border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <NexoLogo className="h-7 shrink-0" />
            <AlertsBell alerts={alerts} seeAllHref="/tenant/alertas" />
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[180px]">
              {user?.email}
            </span>
            <ThemeToggle size="icon" variant="ghost" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login", replace: true });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-14 pb-24 md:pb-6 md:pt-[7.25rem]">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav (mobile + small tablet) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl bg-card/90 border-t border-border/60 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tenantNav.length + 1}, minmax(0, 1fr))` }}>
          {tenantNav.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                data-tour={item.tour}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors min-w-0",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
                <Icon className={cn("size-[18px] shrink-0", active && "text-primary")} />
                <span className="truncate max-w-full px-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
            className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors text-muted-foreground hover:text-foreground min-w-0"
          >
            <LogOut className="size-[18px] shrink-0" />
            <span className="truncate font-medium">Sair</span>
          </button>
        </div>
      </nav>

      {/* Desktop top tabs */}
      <nav className="hidden md:flex border-b border-border/60 backdrop-blur-xl bg-card/85 fixed top-14 left-0 right-0 z-30">
        <div className="max-w-3xl mx-auto px-4 flex gap-1 w-full overflow-x-auto">
          {tenantNav.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                data-tour={item.tour}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap",
                  active
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <OnboardingTour tourKey="tenant" steps={tenantTourSteps} />
      <InstallPwaButton bottomOffset={80} />
      <SupportWhatsAppButton bottomOffset={144} />
    </div>
  );
}
