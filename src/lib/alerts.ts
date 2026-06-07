import { useMemo } from "react";
import { useContracts, useInstallments, useMaintenances } from "@/lib/queries";
import { useInspections } from "@/lib/inspections";
import {
  useTenantActiveContract,
  useTenantInstallments,
  useTenantMaintenances,
} from "@/lib/tenant-queries";
import { today } from "@/lib/format";

export type AlertSeverity = "critico" | "atencao" | "informativo";

export type Alert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  link?: string;
  date?: string;
};

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  informativo: "Informativo",
};

export const SEVERITY_STYLES: Record<AlertSeverity, { badge: string; border: string }> = {
  critico: {
    badge: "bg-destructive text-destructive-foreground",
    border: "border-l-destructive",
  },
  atencao: {
    badge: "bg-amber-500 text-white",
    border: "border-l-amber-500",
  },
  informativo: {
    badge: "bg-primary/15 text-primary border border-primary/30",
    border: "border-l-primary",
  },
};

function daysBetween(a: string, b: string) {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.floor((db - da) / 86_400_000);
}

/** Computes manager-side alerts from contracts, installments, maintenances and inspections. */
export function useManagerAlerts() {
  const { data: contracts = [], isLoading: lc } = useContracts();
  const { data: installments = [], isLoading: li } = useInstallments();
  const { data: maintenances = [], isLoading: lm } = useMaintenances();
  const { data: inspections = [], isLoading: lin } = useInspections();

  const alerts = useMemo<Alert[]>(() => {
    const todayStr = today();
    const list: Alert[] = [];

    // Parcelas em atraso
    for (const inst of installments as any[]) {
      if (inst.status === "pago") continue;
      const days = daysBetween(inst.due_date, todayStr);
      if (days > 0) {
        list.push({
          id: `inst-late-${inst.id}`,
          severity: days > 15 ? "critico" : "atencao",
          title: `Parcela atrasada há ${days} dia(s)`,
          description: `${inst.contract?.property?.nickname ?? "Imóvel"} — ${inst.contract?.tenant?.full_name ?? "Inquilino"}`,
          link: "/manager/financeiro",
          date: inst.due_date,
        });
      } else if (days >= -5 && days <= 0) {
        list.push({
          id: `inst-soon-${inst.id}`,
          severity: "informativo",
          title: `Parcela vence em ${Math.abs(days)} dia(s)`,
          description: `${inst.contract?.property?.nickname ?? "Imóvel"} — ${inst.contract?.tenant?.full_name ?? "Inquilino"}`,
          link: "/manager/financeiro",
          date: inst.due_date,
        });
      }
    }

    // Contratos vencendo ≤60 dias
    for (const c of contracts as any[]) {
      if (!c.active) continue;
      const days = daysBetween(todayStr, c.end_date);
      if (days >= 0 && days <= 60) {
        list.push({
          id: `contract-end-${c.id}`,
          severity: days <= 15 ? "critico" : "atencao",
          title: `Contrato encerra em ${days} dia(s)`,
          description: `${c.property?.nickname ?? "Imóvel"} — ${c.tenant?.full_name ?? "Inquilino"}`,
          link: "/manager/carteira",
          date: c.end_date,
        });
      }
    }

    // Manutenções abertas há > 7 dias
    for (const m of maintenances as any[]) {
      if (m.status === "concluido") continue;
      const days = daysBetween(m.created_at?.slice(0, 10) ?? todayStr, todayStr);
      if (days > 7) {
        list.push({
          id: `maint-old-${m.id}`,
          severity: days > 15 ? "critico" : "atencao",
          title: `Manutenção em aberto há ${days} dias`,
          description: `${m.property?.nickname ?? "Imóvel"} — ${m.title}`,
          link: "/maintenances",
        });
      }
    }

    // Contratos ativos sem vistoria de entrada
    const insByContract = new Map<string, any[]>();
    for (const ins of inspections as any[]) {
      const arr = insByContract.get(ins.contract_id) ?? [];
      arr.push(ins);
      insByContract.set(ins.contract_id, arr);
    }
    for (const c of contracts as any[]) {
      if (!c.active) continue;
      const arr = insByContract.get(c.id) ?? [];
      const hasEntrada = arr.some((i) => i.kind === "entrada");
      if (!hasEntrada) {
        list.push({
          id: `no-entry-insp-${c.id}`,
          severity: "atencao",
          title: "Vistoria de entrada ausente",
          description: `${c.property?.nickname ?? "Imóvel"} — ${c.tenant?.full_name ?? "Inquilino"}`,
          link: "/manager/vistorias",
        });
      }
    }

    // Ordena: crítico → atenção → informativo, depois por data
    const rank: Record<AlertSeverity, number> = { critico: 0, atencao: 1, informativo: 2 };
    list.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return list;
  }, [contracts, installments, maintenances, inspections]);

  return { alerts, isLoading: lc || li || lm || lin };
}

/** Tenant-side computed alerts. */
export function useTenantAlerts() {
  const { data: contract } = useTenantActiveContract();
  const { data: installments = [] } = useTenantInstallments();
  const { data: maintenances = [] } = useTenantMaintenances();

  const alerts = useMemo<Alert[]>(() => {
    const list: Alert[] = [];
    const todayStr = today();

    for (const inst of installments as any[]) {
      if (inst.status === "pago") continue;
      const days = daysBetween(inst.due_date, todayStr);
      if (days > 0) {
        list.push({
          id: `t-inst-late-${inst.id}`,
          severity: days > 5 ? "critico" : "atencao",
          title: `Aluguel atrasado há ${days} dia(s)`,
          description: `Vencimento original: ${inst.due_date}`,
          link: "/tenant/financeiro",
          date: inst.due_date,
        });
      } else if (days >= -7 && days <= 0) {
        list.push({
          id: `t-inst-soon-${inst.id}`,
          severity: days >= -2 ? "atencao" : "informativo",
          title: `Aluguel vence em ${Math.abs(days)} dia(s)`,
          description: "Acesse a área Financeiro para pagar.",
          link: "/tenant/financeiro",
          date: inst.due_date,
        });
      }
    }

    for (const m of maintenances as any[]) {
      if (m.status === "concluido") continue;
      list.push({
        id: `t-maint-${m.id}`,
        severity: "informativo",
        title: `Chamado: ${m.title}`,
        description: `Status: ${m.status}`,
        link: "/tenant/manutencoes",
      });
    }

    if (contract) {
      const days = daysBetween(today(), contract.end_date);
      if (days >= 0 && days <= 60) {
        list.push({
          id: `t-contract-end`,
          severity: days <= 15 ? "atencao" : "informativo",
          title: `Seu contrato encerra em ${days} dia(s)`,
          description: "Procure a imobiliária para renovação.",
          link: "/tenant/contrato",
        });
      }
    }

    const rank: Record<AlertSeverity, number> = { critico: 0, atencao: 1, informativo: 2 };
    list.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return list;
  }, [contract, installments, maintenances]);

  return { alerts };
}
