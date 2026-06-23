import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Wallet, Wrench, Coins, LogOut, Loader2 } from "lucide-react";
import { NexoLogo } from "@/components/NexoLogo";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import { useAuth } from "@/lib/auth";
import { useUserRole, roleHomePath } from "@/lib/useUserRole";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_landlord")({
  ssr: false,
  component: LandlordLayout,
});

const navItems: ReadonlyArray<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/landlord", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/landlord/financeiro", label: "Finanças", icon: Wallet },
  { to: "/landlord/manutencoes", label: "Manutenções", icon: Wrench },
  { to: "/landlord/saldo", label: "Saldo e Saque", icon: Coins },
];

function LandlordLayout() {
  const { user, loading, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!roleLoading && role && role !== "landlord") {
      navigate({ to: roleHomePath(role), replace: true });
    }
  }, [role, roleLoading, navigate]);

  if (loading || !user || roleLoading || role !== "landlord") {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar desktop */}
      <aside className="hidden md:fixed md:left-0 md:top-0 md:h-screen md:flex w-60 lg:w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <Link to="/landlord" className="flex items-center gap-2 min-w-0">
            <NexoLogo className="h-9" alt="NEXO" />
            <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider hidden lg:block">
              Proprietário
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}>
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          <ThemeToggle />
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}>
            <LogOut className="size-4 mr-2" />Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 md:ml-60 lg:ml-64">
        {/* Header mobile */}
        <div className="md:hidden sticky top-0 z-40 bg-card border-b border-border shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/landlord" className="flex items-center">
              <NexoLogo className="h-8" alt="NEXO" />
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle size="icon" variant="ghost" />
              <Button variant="ghost" size="icon"
                onClick={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}>
                <LogOut className="size-5" />
              </Button>
            </div>
          </div>
          <nav className="flex overflow-x-auto gap-1 p-2 border-t border-border">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to}
                  className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground")}>
                  <Icon className="size-3.5" />{item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
      <InstallPwaButton bottomOffset={88} />
    </div>
  );
}
