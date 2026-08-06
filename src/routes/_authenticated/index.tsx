import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    const { data: { user } } = await context.supabase.auth.getUser();
    if (user) {
      const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", user.id);
      const r = (roles ?? []).map((x: any) => x.role);
      if (r.includes("manager")) throw redirect({ to: "/manager" });
      if (r.includes("landlord")) throw redirect({ to: "/landlord" });
      if (r.includes("tenant")) throw redirect({ to: "/tenant" });
    }
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
