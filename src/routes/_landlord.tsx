import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { LandlordShell } from "@/components/landlord/LandlordShell";
import { useAuth } from "@/lib/auth";
import { useUserRole, roleHomePath } from "@/lib/useUserRole";
import { useLandlordProfile } from "@/lib/landlord-queries";

export const Route = createFileRoute("/_landlord")({
  ssr: false,
  component: LandlordLayout,
});

function LandlordLayout() {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!roleLoading && role && role !== "landlord") {
      navigate({ to: roleHomePath(role), replace: true });
    }
  }, [role, roleLoading, navigate]);

  const { data: profile, isLoading: profileLoading } = useLandlordProfile();

  useEffect(() => {
    if (role !== "landlord" || profileLoading || !profile) return;
    if (!profile.pix_key) navigate({ to: "/landlord-setup", replace: true });
  }, [role, profile, profileLoading, navigate]);

  if (loading || !user || roleLoading || role !== "landlord" || profileLoading) {
    return (
      <div className="grid min-h-screen place-items-center" style={{ backgroundColor: "#0a0a1a" }}>
        <Loader2 className="size-6 animate-spin text-[#4f46e5]" />
      </div>
    );
  }

  return (
    <LandlordShell>
      <Outlet />
    </LandlordShell>
  );
}
