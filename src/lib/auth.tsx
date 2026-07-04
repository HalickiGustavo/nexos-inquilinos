import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Hydrate from cached session first to render protected UI on first paint
    // Hydrate from cached session first to render protected UI on first paint.
    // Do NOT clear the query cache here — it wipes any prefetched/hydrated data
    // that was warmed before the provider mounted. Cache is only cleared on
    // real user switches inside onAuthStateChange below.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      lastUserId.current = data.session?.user?.id ?? null;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      const nextUserId = s?.user?.id ?? null;
      if (lastUserId.current !== nextUserId) {
        await queryClient.cancelQueries();
        queryClient.clear();
      }
      lastUserId.current = nextUserId;
      setSession(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    lastUserId.current = null;
    await supabase.auth.signOut();
  }, [queryClient]);

  // Memoize context value so consumers don't re-render on parent re-renders
  const value = useMemo<AuthCtx>(
    () => ({ session, user: session?.user ?? null, loading, signOut }),
    [session, loading, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
