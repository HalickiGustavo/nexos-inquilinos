import { supabase } from "./client";

export const attachSupabaseAuth = async ({ next }: { next: (args?: any) => Promise<any> }) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    return next({
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  }

  return next();
};
