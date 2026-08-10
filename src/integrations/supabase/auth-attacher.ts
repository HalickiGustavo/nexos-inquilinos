import { supabase } from "./client";

export const attachSupabaseAuth = async ({ next }: { next: (args?: any) => Promise<any> }) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return next({
    headers,
  });
};
