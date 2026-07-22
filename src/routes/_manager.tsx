import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Wallet,
  Users,
  ClipboardCheck,
  Loader2,
  FileDigit,
  FileText,
  Database,
  Globe,
  Shuffle,
  Inbox,
  Home,
  KeyRound,
  UserCog,
  BarChart3,
  Wrench,
} from "lucide-react";
import { AppShell, type ShellNavGroup } from "@/components/shell/AppShell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useAuth } from "@/lib/auth";
import { useUserRole, roleHomePath } from "@/lib/useUserRole";
import { useManagerAlerts } from "@/lib/alerts";
import { managerTourSteps } from "@/lib/tour-steps";

export const Route = createFileRoute("/_manager")({
  ssr: false,
  component: ManagerLayout,
});

const navGroups: ShellNavGroup[] = [
  {
    label: null,
    items: [
      { to: "/manager", label: "Dashboard", icon: LayoutDashboard, exact: true, tour: "nav-manager" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/manager/carteira", label: "Carteira", icon: Briefcase, tour: "nav-manager-carteira" },
      { to: "/manager/financeiro", label: "Financeiro", icon: Wallet, tour: "nav-manager-financeiro" },
      { to: "/manager/dimob", label: "DIMOB", icon: FileDigit, tour: "nav-manager-dimob" },
      { to: "/manager/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { to: "/manager/proprietarios", label: "Proprietários", icon: Home, tour: "nav-manager-proprietarios" },
      { to: "/manager/inquilinos", label: "Inquilinos", icon: KeyRound, tour: "nav-manager-inquilinos" },
      { to: "/manager/equipe", label: "Equipe", icon: Users, tour: "nav-manager-equipe" },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/manager/contratos", label: "Contratos", icon: FileText, tour: "nav-manager-contratos" },
      { to: "/manager/vistorias", label: "Vistorias", icon: ClipboardCheck, tour: "nav-manager-vistorias" },
      { to: "/manager/manutencoes", label: "Manutenções", icon: Wrench, tour: "nav-manager-manutencoes" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/manager/leads", label: "Leads", icon: Inbox, tour: "nav-manager-leads" },
      { to: "/manager/configuracoes/roleta", label: "Roleta de Leads", icon: Shuffle, tour: "nav-manager-roleta" },
      { to: "/manager/portais", label: "Portais", icon: Globe, tour: "nav-manager-portais" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/manager/migrar-dados", label: "Migrar Dados", icon: Database, tour: "nav-manager-migrar-dados" },
      { to: "/manager/perfil", label: "Meu Perfil", icon: UserCog, tour: "nav-manager-perfil" },
    ],
  },
];

function ManagerLayout() {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { alerts } = useManagerAlerts();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!roleLoading && role && role !== "manager") {
      navigate({ to: roleHomePath(role), replace: true });
    }
  }, [role, roleLoading, navigate]);

  if (loading || !user || roleLoading || role !== "manager") {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell
      brand={{ to: "/manager", subtitle: "Imobiliária" }}
      navGroups={navGroups}
      variant="accent"
      sidebarWidth="w-60 lg:w-64"
      search={<GlobalSearch />}
      alerts={{ alerts, seeAllHref: "/manager/alertas" }}
      tour={{ key: "manager", steps: managerTourSteps }}
    >
      <Outlet />
    </AppShell>
  );
}
