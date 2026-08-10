import { supabase } from "./client";

export const attachSupabaseAuth = async ({ next }: { next: (args?: any) => Promise<any> }) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return next({
    headers,
  });
};

// @ts-ignore - needed for TanStack Start middleware registry if used as AnyFunctionMiddleware
attachSupabaseAuth["~types"] = {
  input: undefined,
  output: undefined,
  clientContext: undefined,
  allClientContextBeforeNext: undefined,
};
