import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Briefcase, Wallet, Users, KanbanSquare, ClipboardCheck, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/useUserRole";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_manager")({
  ssr: false,
  component: ManagerLayout,
});

const navItems: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/manager", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/manager/carteira", label: "Carteira", icon: Briefcase },
  { to: "/manager/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/manager/equipe", label: "Equipe", icon: Users },
  { to: "/manager/vistorias", label: "Vistorias", icon: ClipboardCheck },
  { to: "/manager/crm", label: "CRM", icon: KanbanSquare },
];


function ManagerLayout() {
  const { user, loading, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary grid place-items-center text-primary-foreground font-bold">N</div>
            <div>
              <div className="font-semibold text-sm">NEXO Manager</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Imobiliária</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground font-medium shadow-sm" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                )}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-zinc-800">
          <div className="px-3 py-2 text-xs text-zinc-500 truncate">{user.email}</div>
          <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:bg-zinc-800 hover:text-white"
            onClick={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}>
            <LogOut className="size-4 mr-2" />Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <nav className="md:hidden flex overflow-x-auto gap-1 p-2 border-b bg-zinc-900 text-zinc-100">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                  active ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-zinc-300")}>
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

