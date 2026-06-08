import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Briefcase, Wallet, Users, KanbanSquare, ClipboardCheck, Bell, LogOut, Loader2, Plug, FileDigit } from "lucide-react";
import nexoLogo from "@/assets/nexo-logo.jpeg.asset.json";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/useUserRole";
import { useManagerAlerts } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_manager")({
  ssr: false,
  component: ManagerLayout,
});

const navItems: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/manager", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/manager/carteira", label: "Carteira", icon: Briefcase },
  { to: "/manager/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/manager/dimob", label: "DIMOB", icon: FileDigit },
  { to: "/manager/equipe", label: "Equipe", icon: Users },
  { to: "/manager/vistorias", label: "Vistorias", icon: ClipboardCheck },
  { to: "/manager/alertas", label: "Alertas", icon: Bell },
  { to: "/manager/crm", label: "CRM", icon: KanbanSquare },
  { to: "/manager/integracao", label: "Integração", icon: Plug },
];


function ManagerLayout() {
  const { user, loading, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { alerts } = useManagerAlerts();
  const criticalCount = alerts.filter((a) => a.severity === "critico").length;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!roleLoading && role && role !== "manager") {
      navigate({ to: role === "tenant" ? "/tenant" : "/dashboard", replace: true });
    }
  }, [role, roleLoading, navigate]);

  if (loading || !user || roleLoading || role !== "manager") {
    return <div className="min-h-screen grid place-items-center bg-zinc-950"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
      <aside className="hidden md:flex w-64 flex-col bg-zinc-900 text-zinc-100 border-r border-zinc-800">
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <img src={nexoLogo.url} alt="NEXO" className="h-9 w-auto rounded-md bg-white p-1.5" />
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Imobiliária</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            const showBadge = item.to === "/manager/alertas" && criticalCount > 0;
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground font-medium shadow-sm" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                )}>
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold">
                    {criticalCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-zinc-800 space-y-1">
          <div className="px-3 py-2 text-xs text-zinc-500 truncate">{user.email}</div>
          <ThemeToggle />
          <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:bg-zinc-800 hover:text-white"
            onClick={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}>
            <LogOut className="size-4 mr-2" />Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-black border-b border-white/5">
          <Link to="/manager" className="flex items-center">
            <img src={nexoLogo.url} alt="NEXO" className="h-8 w-auto rounded-md bg-white p-1" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle size="icon" variant="ghost" />
            <Link to="/manager/alertas" className="relative size-9 grid place-items-center rounded-full text-zinc-200 hover:bg-white/5">
              <Bell className="size-5" strokeWidth={1.5} />
              {criticalCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold">{criticalCount}</span>
              )}
            </Link>
            <Button variant="ghost" size="icon" className="text-zinc-200 hover:bg-white/5"
              onClick={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}>
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
        <nav className="md:hidden flex overflow-x-auto gap-1 p-2 border-b border-white/5 bg-black text-zinc-100">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border",
                  active ? "bg-violet-500 text-white border-violet-400" : "bg-zinc-900 text-zinc-300 border-white/10")}>
                <Icon className="size-3.5" />{item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}

