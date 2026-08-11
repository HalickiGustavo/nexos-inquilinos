import { createMiddleware } from "@tanstack/react-start";
import { supabaseAdmin } from "./client.server";

export const requireSupabaseAuth = createMiddleware().middleware(async ({ next, request, context }) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return next({
    context: {
      ...context,
      userId: user.id,
      claims: user.app_metadata || {},
      supabase: supabaseAdmin,
    },
  });
});
