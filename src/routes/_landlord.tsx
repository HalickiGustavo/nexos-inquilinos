import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Wallet, Wrench, Loader2 } from "lucide-react";
import { AppShell, type ShellNavGroup } from "@/components/shell/AppShell";
import { useAuth } from "@/lib/auth";
import { useUserRole, roleHomePath } from "@/lib/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_landlord")({
  ssr: false,
  component: LandlordLayout,
});

const navGroups: ShellNavGroup[] = [
  {
    items: [
      { to: "/landlord", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/landlord/financeiro", label: "Finanças", icon: Wallet },
      { to: "/landlord/manutencoes", label: "Manutenções", icon: Wrench },
    ],
  },
];

function LandlordLayout() {
  const { user, loading } = useAuth();
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

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["landlord-gate-profile", user?.id],
    enabled: !!user && role === "landlord",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("pix_key")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (role !== "landlord" || profileLoading || !profile) return;
    if (!profile.pix_key) navigate({ to: "/landlord-setup", replace: true });
  }, [role, profile, profileLoading, navigate, pathname]);

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
