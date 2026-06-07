import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, FileText, Wrench, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import nexoLogoAsset from "@/assets/nexo-logo.png.asset.json";

const tenantNav: ReadonlyArray<{ to: string; label: string; icon: typeof Home; exact?: boolean }> = [
  { to: "/tenant", label: "Início", icon: Home, exact: true },
  { to: "/tenant/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/tenant/contrato", label: "Contrato", icon: FileText },
  { to: "/tenant/manutencoes", label: "Manutenções", icon: Wrench },
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
        <div className="grid grid-cols-4">
          {tenantNav.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
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
