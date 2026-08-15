import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Wallet, Wrench, Loader2, MessageSquare, UserCog, Building2 } from "lucide-react";
import { AppShell, type ShellNavGroup } from "@/components/shell/AppShell";
import { useAuth } from "@/lib/auth";
import { useUserRole, roleHomePath } from "@/lib/useUserRole";
import { useLandlordProfile } from "@/lib/landlord-queries";

export const Route = createFileRoute("/_landlord")({
  ssr: false,
  component: LandlordLayout,
});

const navGroups: ShellNavGroup[] = [
  {
    items: [
      { to: "/landlord", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/landlord/chat", label: "Chat", icon: MessageSquare },
      { to: "/landlord/financeiro", label: "Finanças", icon: Wallet },
      { to: "/landlord/imoveis", label: "Imóveis", icon: Building2 },
      { to: "/landlord/manutencoes", label: "Manutenções", icon: Wrench },
      { to: "/landlord/perfil", label: "Meu Perfil", icon: UserCog },
    ],
  },
];

function LandlordLayout() {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", replace: true });
      return;
    }

    // Strict requirement: email must be confirmed
    if (user && !user.email_confirmed_at) {
      navigate({ to: "/login", replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!roleLoading && role && role !== "landlord") {
      navigate({ to: roleHomePath(role), replace: true });
    }
  }, [role, roleLoading, navigate]);

  // Reaproveita o hook cacheado (staleTime longo) em vez de rodar uma segunda
  // query dedicada só pra portão — evita refetch em cada troca de rota.
  const { data: profile, isLoading: profileLoading, isFetching: profileFetching } = useLandlordProfile();

  useEffect(() => {
    // Não redireciona enquanto houver refetch em voo: o dado em cache pode ser
    // uma versão antiga (sem pix_key) recém-salva na tela de setup.
    if (role !== "landlord" || profileLoading || profileFetching || !profile) return;
    if (!profile.pix_key) navigate({ to: "/landlord-setup", replace: true });
  }, [role, profile, profileLoading, profileFetching, navigate]);


  if (loading || !user || roleLoading || role !== "landlord" || profileLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell
      brand={{ to: "/landlord", subtitle: "Proprietário" }}
      navGroups={navGroups}
      variant="primary"
      sidebarWidth="w-60 lg:w-64"
    >
      <Outlet />
    </AppShell>
  );
}
