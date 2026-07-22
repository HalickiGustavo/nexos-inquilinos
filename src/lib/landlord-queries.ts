import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// Cache defaults: mantém a UI fluida entre navegações (dashboard <-> finanças <->
// saldo <-> manutenções) sem refetch a cada troca de rota. Mutations continuam
// invalidando explicitamente.
const DEFAULT_STALE = 60_000; // 1 min
const DEFAULT_GC = 5 * 60_000; // 5 min

// Todas as queries abaixo confiam na RLS: o landlord só enxerga linhas onde
// properties.landlord_id = auth.uid() (e cascata em contracts/installments/maintenances).

export function useLandlordProperties() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["landlord", "properties", user?.id],
    enabled: !!user?.id,
    staleTime: DEFAULT_STALE,
    gcTime: DEFAULT_GC,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLandlordContracts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["landlord", "contracts", user?.id],
    enabled: !!user?.id,
    staleTime: DEFAULT_STALE,
    gcTime: DEFAULT_GC,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, property:properties(*), tenant:tenants(*)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLandlordInstallments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["landlord", "installments", user?.id],
    enabled: !!user?.id,
    staleTime: DEFAULT_STALE,
    gcTime: DEFAULT_GC,
    queryFn: async () => {
      // Slim select: só as colunas usadas por dashboard / finanças / saldo.
      // Reduz payload e tempo de parse. RLS mantém a cascata segura.
      const { data, error } = await supabase
        .from("installments")
        .select(
          "id, due_date, amount, paid_amount, paid_at, status, contract:contracts(id, property:properties(id, address, nickname), tenant:tenants(id, full_name))",
        )
        .order("due_date", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLandlordMaintenances() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["landlord", "maintenances", user?.id],
    enabled: !!user?.id,
    staleTime: DEFAULT_STALE,
    gcTime: DEFAULT_GC,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenances")
        .select("*, property:properties(*), contract:contracts(id, start_date, end_date, rent_amount, active, tenant:tenants(id, full_name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLandlordWithdrawals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["landlord", "withdrawals", user?.id],
    enabled: !!user?.id,
    staleTime: DEFAULT_STALE,
    gcTime: DEFAULT_GC,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landlord_withdrawals")
        .select("*")
        .eq("landlord_user_id", user!.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLandlordProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["landlord", "profile", user?.id],
    enabled: !!user?.id,
    // Profile muda pouco — cachear por mais tempo evita refetch em cada navegação.
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, pix_key, pix_key_type")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Saldo disponível = parcelas pagas - saques já realizados (pagos/processando).
 * Em produção quem governa o saldo é o split do Asaas; aqui é a view derivada.
 */
export function useLandlordSaldo() {
  const installments = useLandlordInstallments();
  const withdrawals = useLandlordWithdrawals();

  const totalRecebido = (installments.data ?? [])
    .filter((i: any) => i.status === "pago")
    .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);

  const totalSacado = (withdrawals.data ?? [])
    .filter((w: any) => ["pago", "processando", "solicitado"].includes(w.status))
    .reduce((s: number, w: any) => s + Number(w.amount), 0);

  return {
    saldoDisponivel: Math.max(0, totalRecebido - totalSacado),
    totalRecebido,
    totalSacado,
    loading: installments.isLoading || withdrawals.isLoading,
  };
}
