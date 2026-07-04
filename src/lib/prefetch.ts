import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Kick off the same fetches that dashboard/properties/etc. use, in parallel,
// right after auth is ready. Data lands in React Query cache with the same
// keys the page hooks use, so navigation is instant (cache hit).
export function useWarmOwnerCache(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const opts = { staleTime: 60_000 } as const;

    qc.prefetchQuery({
      queryKey: ["properties"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("properties")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return data;
      },
      ...opts,
    });
    qc.prefetchQuery({
      queryKey: ["tenants"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return data;
      },
      ...opts,
    });
    qc.prefetchQuery({
      queryKey: ["contracts"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("contracts")
          .select("*, property:properties(*), tenant:tenants(*)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return data;
      },
      ...opts,
    });
    qc.prefetchQuery({
      queryKey: ["installments"],
      queryFn: async () => {
        // Mesma projeção enxuta usada em useInstallments para reaproveitar o cache
        const { data, error } = await supabase
          .from("installments")
          .select(
            "*, contract:contracts(id, property_id, late_fee_percent, daily_interest_percent, property:properties(id, nickname, address), tenant:tenants(id, full_name))",
          )
          .order("due_date", { ascending: true })
          .limit(1000);
        if (error) throw error;
        return data;
      },
      ...opts,
    });
    qc.prefetchQuery({
      queryKey: ["maintenances"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("maintenances")
          .select(
            "*, property:properties(id, nickname, address), contract:contracts(id, start_date, end_date, rent_amount, active, tenant:tenants(id, full_name))",
          )
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return data;
      },
      ...opts,
    });

  }, [enabled, qc]);
}

// On idle, ask the router to fetch each route's JS chunk so first navigation
// doesn't wait on the network. Safe: preloadRoute is a no-op if already loaded.
export function useIdlePreloadRoutes(paths: string[], enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const run = () => {
      for (const to of paths) {
        void router.preloadRoute({ to }).catch(() => {});
      }
    };
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(run, { timeout: 2000 })
      : (window.setTimeout(run, 800) as unknown as number);
    return () => {
      if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [enabled, paths, router]);
}
