import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Wallet,
  Wrench,
  Loader2,
  Coins,
  ClipboardCheck,
  FolderOpen,
  BarChart3,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/useUserRole";
import { AppShell, type ShellNavGroup } from "@/components/shell/AppShell";
import { TenantShell } from "@/components/TenantShell";
import { ownerTourSteps } from "@/lib/tour-steps";
import { useWarmOwnerCache, useIdlePreloadRoutes } from "@/lib/prefetch";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

const navGroups: ShellNavGroup[] = [
  {
    items: [
      { to: "/dashboard", label: "Visão Geral", icon: LayoutDashboard, tour: "nav-dashboard" },
      { to: "/conta-corrente", label: "Conta Corrente", icon: Coins, tour: "nav-conta-corrente" },
      { to: "/properties", label: "Imóveis", icon: Building2, tour: "nav-properties" },
      { to: "/contracts", label: "Contratos", icon: FileText, tour: "nav-contracts" },
      { to: "/tenants", label: "Inquilinos", icon: Users, tour: "nav-tenants" },
      { to: "/maintenances", label: "Manutenções", icon: Wrench, tour: "nav-maintenances" },
      { to: "/vistorias", label: "Vistorias", icon: ClipboardCheck },
      { to: "/documentos", label: "Documentos", icon: FolderOpen },
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/financials", label: "Finanças (detalhado)", icon: Wallet, tour: "nav-financials" },
      { to: "/perfil", label: "Meu Perfil", icon: UserCog },
    ],
  },
];

const OWNER_PREFETCH_PATHS = [
  "/dashboard",
  "/conta-corrente",
  "/properties",
  "/tenants",
  "/contracts",
  "/financials",
  "/maintenances",
];

function AuthLayout() {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useWarmOwnerCache(!!user && role === "owner");
  useIdlePreloadRoutes(OWNER_PREFETCH_PATHS, !!user && role === "owner");

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    
    // Strict requirement: email must be confirmed to access dashboards
    if (user && !user.email_confirmed_at && !pathname.includes('/perfil')) {
      toast.error("Por favor, confirme seu e-mail para acessar o painel.");
      navigate({ to: "/login", replace: true });
    }
  }, [user, loading, navigate, pathname]);

  useEffect(() => {
    if (!role) return;
    const isTenantPath = pathname === "/tenant" || pathname.startsWith("/tenant/");
    if (role === "manager") {
      navigate({ to: "/manager", replace: true });
    } else if (role === "landlord") {
      navigate({ to: "/landlord", replace: true });
    } else if (role === "tenant" && !isTenantPath) {
      navigate({ to: "/tenant", replace: true });
    } else if (role === "owner" && isTenantPath) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [role, pathname, navigate]);

  if (loading || !user || roleLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (role === "tenant") {
    return <TenantShell />;
  }

  return (
    <AppShell
      brand={{ to: "/dashboard" }}
      navGroups={navGroups}
      variant="primary"
      sidebarWidth="w-64"
      mobileNavStyle="chip"
      mobileLogoClass="h-7"
      tour={{ key: "owner", steps: ownerTourSteps }}
    >
      <Outlet />
    </AppShell>
  );
}
