import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// Todas as queries abaixo confiam na RLS: o landlord só enxerga linhas onde
// properties.landlord_id = auth.uid() (e cascata em contracts/installments/maintenances).

export function useLandlordProperties() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["landlord", "properties", user?.id],
    enabled: !!user?.id,
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*, contract:contracts(*, property:properties(*), tenant:tenants(*))")
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

/**
 * Agregações por imóvel — reaproveitadas na listagem e detalhe de imóvel.
 * Não muda regra de negócio: apenas deriva do que já vem de RLS.
 */
export type PropertyAggregate = {
  propertyId: string;
  receitaTotal: number;
  receitaAno: number;
  ultimoPagamento: string | null;
  proximoVencimento: string | null;
  inadimplencia: number;
  parcelasPagasCount: number;
  parcelasAbertasCount: number;
};

export function usePropertyAggregates() {
  const { data: installments = [] } = useLandlordInstallments();
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;

  return useMemo(() => {
    const map = new Map<string, PropertyAggregate>();
    for (const i of installments as any[]) {
      const propId: string | undefined = i.contract?.property?.id;
      if (!propId) continue;
      const agg = map.get(propId) ?? {
        propertyId: propId,
        receitaTotal: 0,
        receitaAno: 0,
        ultimoPagamento: null,
        proximoVencimento: null,
        inadimplencia: 0,
        parcelasPagasCount: 0,
        parcelasAbertasCount: 0,
      };
      const amount = Number(i.paid_amount || i.amount);
      if (i.status === "pago") {
        agg.receitaTotal += amount;
        if (i.paid_at && i.paid_at >= yearStart) agg.receitaAno += amount;
        agg.parcelasPagasCount += 1;
        const paid = i.paid_at || i.payment_date;
        if (paid && (!agg.ultimoPagamento || paid > agg.ultimoPagamento)) {
          agg.ultimoPagamento = paid;
        }
      } else {
        agg.parcelasAbertasCount += 1;
        if (i.due_date >= today) {
          if (!agg.proximoVencimento || i.due_date < agg.proximoVencimento) {
            agg.proximoVencimento = i.due_date;
          }
        } else {
          agg.inadimplencia += Number(i.amount);
        }
      }
      map.set(propId, agg);
    }
    return map;
  }, [installments, today, yearStart]);
}
