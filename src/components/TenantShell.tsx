import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, FileText, Wrench, Bell, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import nexoLogoAsset from "@/assets/nexo-logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OnboardingTour } from "@/components/OnboardingTour";
import { tenantTourSteps } from "@/lib/tour-steps";

const tenantNav: ReadonlyArray<{ to: string; label: string; icon: typeof Home; exact?: boolean; tour: string }> = [
  { to: "/tenant", label: "Início", icon: Home, exact: true, tour: "nav-tenant" },
  { to: "/tenant/financeiro", label: "Financeiro", icon: Wallet, tour: "nav-tenant-financeiro" },
  { to: "/tenant/contrato", label: "Contrato", icon: FileText, tour: "nav-tenant-contrato" },
  { to: "/tenant/manutencoes", label: "Manutenções", icon: Wrench, tour: "nav-tenant-manutencoes" },
  { to: "/tenant/alertas", label: "Alertas", icon: Bell, tour: "nav-tenant-alertas" },
];

export function TenantShell() {
  const nexoLogo = nexoLogoAsset.url;
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-card border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={nexoLogo} alt="Nexo" className="h-7 w-auto" />
            <InstallPwaButton />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[180px]">
              {user?.email}
            </span>
            <ThemeToggle size="icon" variant="ghost" />
            <Button
              variant="ghost"
              size="icon"
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

      <main className="flex-1 pb-20 md:pb-6">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav (mobile) + sidebar-like row (desktop) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 md:static md:max-w-3xl md:mx-auto bg-card border-t md:border-0 md:hidden">
        <div className="grid grid-cols-6">
          {tenantNav.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                data-tour={item.tour}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
            className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-5" />
            Sair
          </button>
        </div>
      </nav>

      {/* Desktop top tabs */}
      <nav className="hidden md:flex border-b bg-card -order-1 md:order-none fixed md:sticky top-14 left-0 right-0 z-20">
        <div className="max-w-3xl mx-auto px-4 flex gap-1 w-full">
          {tenantNav.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors",
                  active
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
