import { formatBRL } from "@/lib/format";

export type ExpensePayer = "inquilino" | "proprietario";

export type VariableExpense = {
  id: string;
  description: string;
  amount: number;
  payer: ExpensePayer; // inquilino: somado à parcela; proprietario: descontado do repasse
  created_at?: string;
};

export const PAYER_LABEL: Record<ExpensePayer, string> = {
  inquilino: "Cobrar do inquilino",
  proprietario: "Descontar do proprietário",
};

export function parseExpenses(raw: unknown): VariableExpense[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => ({
      id: String(r?.id ?? crypto.randomUUID()),
      description: String(r?.description ?? ""),
      amount: Number(r?.amount ?? 0) || 0,
      payer: (r?.payer === "proprietario" ? "proprietario" : "inquilino") as ExpensePayer,
      created_at: r?.created_at ?? new Date().toISOString(),
    }))
    .filter((e) => e.description.trim().length > 0);
}

export function expensesTotals(list: VariableExpense[]) {
  let tenant = 0;
  let owner = 0;
  for (const e of list) {
    if (e.payer === "inquilino") tenant += e.amount;
    else owner += e.amount;
  }
  return { tenant, owner };
}

export function formatExpenseLine(e: VariableExpense) {
  return `${e.description} — ${formatBRL(e.amount)} (${PAYER_LABEL[e.payer]})`;
}
