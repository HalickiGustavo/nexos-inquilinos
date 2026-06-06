import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Wallet,
  Wrench,
  LogOut,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import nexoLogoAsset from "@/assets/nexo-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

const navItems = [
  { to: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/properties", label: "Imóveis", icon: Building2 },
  { to: "/tenants", label: "Inquilinos", icon: Users },
  { to: "/contracts", label: "Contratos", icon: FileText },
  { to: "/financials", label: "Finanças", icon: Wallet },
  { to: "/maintenances", label: "Manutenções", icon: Wrench },
] as const;

function AuthLayout() {
  const nexoLogo = nexoLogoAsset.url;
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border bg-white/95">
          <img src={nexoLogo} alt="Nexo" className="h-10 w-auto" />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={async () => {
              await signOut();
              await supabase.auth.signOut();
              navigate({ to: "/login", replace: true });
            }}
          >
            <LogOut className="size-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-card">
          <img src={nexoLogo} alt="Nexo" className="h-7 w-auto" />

          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <nav className="md:hidden flex overflow-x-auto gap-1 p-2 border-b bg-card">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
