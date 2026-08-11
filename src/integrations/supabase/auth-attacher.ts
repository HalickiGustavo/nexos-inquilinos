import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

const attachSupabaseAuthMiddleware = createMiddleware().middleware(async ({ next }: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    return next({
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  }

  return next();
});

export const attachSupabaseAuth = attachSupabaseAuthMiddleware as any;
