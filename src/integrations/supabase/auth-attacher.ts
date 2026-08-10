import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = createMiddleware()
  .validator((d) => d) // dummy validator to make it a FunctionMiddleware
  .middleware(async ({ next }) => {
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
