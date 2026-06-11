import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/useUserRole";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin")({
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!roleLoading && role && role !== "manager") {
      navigate({ to: role === "tenant" ? "/tenant" : "/dashboard", replace: true });
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-violet-400/80">Admin</div>
            <h1 className="text-lg font-semibold">Painel de Configurações</h1>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/manager"><ArrowLeft className="size-4 mr-1.5" />Voltar ao Dashboard</Link>
          </Button>
        </div>
      </header>
      <main><Outlet /></main>
    </div>
  );
}
