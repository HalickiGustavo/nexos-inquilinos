// Regras determinísticas de insights da carteira do owner.
// Nenhuma alteração de dados — apenas leitura + memoização.

import { formatBRL } from "@/lib/format";

export type InsightSeverity = "success" | "info" | "warning" | "critical";
export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail?: string;
};

type BuildArgs = {
  properties: any[];
  contracts: any[];
  installments: any[];
  maintenances: any[];
  occupiedIds: Set<string>;
};

function ym(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildOwnerInsights({
  properties,
  contracts,
  installments,
  maintenances,
  occupiedIds,
}: BuildArgs): Insight[] {
  const out: Insight[] = [];
  const now = new Date();
  const thisYm = ym(now);
  const lastYm = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const today = now.toISOString().slice(0, 10);

  // 1) Recebimento do mês
  const monthly = installments.filter((i) => i.due_date?.slice(0, 7) === thisYm);
  const monthTotal = monthly.reduce((s, i) => s + Number(i.amount || 0), 0);
  const monthPaid = monthly
    .filter((i) => i.status === "pago")
    .reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);
  if (monthTotal > 0 && monthPaid >= monthTotal * 0.999) {
    out.push({
      id: "all-received",
      severity: "success",
      title: "Todos os aluguéis deste mês foram recebidos.",
    });
  }

  // 2) Variação MoM
  const lastPaid = installments
    .filter((i) => i.due_date?.slice(0, 7) === lastYm && i.status === "pago")
    .reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);
  if (lastPaid > 0 && monthPaid > 0) {
    const diff = ((monthPaid - lastPaid) / lastPaid) * 100;
    if (Math.abs(diff) >= 5) {
      out.push({
        id: "mom-variation",
        severity: diff > 0 ? "success" : "info",
        title:
          diff > 0
            ? `Sua receita aumentou ${diff.toFixed(0)}% em relação ao mês passado.`
            : `Sua receita reduziu ${Math.abs(diff).toFixed(0)}% em relação ao mês passado.`,
      });
    }
  }

  // 3) Imóveis vagos há > 30 dias (sem contrato ativo, updated_at antigo)
  const vacantLong = properties.filter((p) => {
    if (occupiedIds.has(p.id)) return false;
    const ref = p.updated_at || p.created_at;
    if (!ref) return false;
    const days = Math.floor((now.getTime() - new Date(ref).getTime()) / 86400000);
    return days >= 30;
  });
  if (vacantLong.length > 0) {
    const worst = vacantLong[0];
    const days = Math.floor(
      (now.getTime() - new Date(worst.updated_at || worst.created_at).getTime()) / 86400000,
    );
    out.push({
      id: "vacant-long",
      severity: "warning",
      title:
        vacantLong.length === 1
          ? `Existe um imóvel disponível há ${days} dias.`
          : `${vacantLong.length} imóveis disponíveis há mais de 30 dias.`,
      detail: worst.nickname,
    });
  }

  // 4) Manutenções aguardando aprovação
  const pendingApprovals = maintenances.filter((m) => m.budget_status === "pendente");
  if (pendingApprovals.length > 0) {
    const total = pendingApprovals.reduce((s, m) => s + Number(m.budget_amount || 0), 0);
    out.push({
      id: "pending-approvals",
      severity: "warning",
      title:
        pendingApprovals.length === 1
          ? "Você possui uma manutenção aguardando aprovação."
          : `Você possui ${pendingApprovals.length} manutenções aguardando aprovação.`,
      detail: total > 0 ? `Valor total: ${formatBRL(total)}` : undefined,
    });
  }

  // 5) Contratos vencendo em ≤ 30 dias
  const expiring = contracts.filter((c) => {
    if (!c.active || c.deleted_at || !c.end_date) return false;
    const days = Math.floor(
      (new Date(c.end_date).getTime() - now.getTime()) / 86400000,
    );
    return days >= 0 && days <= 30;
  });
  if (expiring.length > 0) {
    out.push({
      id: "expiring-contracts",
      severity: "warning",
      title:
        expiring.length === 1
          ? "Seu imóvel possui contrato vencendo em 30 dias."
          : `${expiring.length} contratos vencem nos próximos 30 dias.`,
    });
  }

  // 6) Inadimplência
  const overdueCount = installments.filter(
    (i) => i.status !== "pago" && i.due_date < today,
  ).length;
  if (overdueCount > 0) {
    out.push({
      id: "overdue",
      severity: "critical",
      title:
        overdueCount === 1
          ? "1 parcela em atraso na sua carteira."
          : `${overdueCount} parcelas em atraso na sua carteira.`,
    });
  }

  if (out.length === 0) {
    out.push({
      id: "all-good",
      severity: "success",
      title: "Nenhuma pendência encontrada.",
      detail: "Sua carteira está em dia.",
    });
  }

  // Ordena por severidade e limita a 4
  const rank: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 4);
}
