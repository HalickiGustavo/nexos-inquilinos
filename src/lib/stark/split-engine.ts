// SplitEngine — cálculo puro. Não depende de Stark, nem faz IO.
// Regra: net_owner = paid - nexo_fee - agency_cut.
// Se net_owner <= 0, owner recebe 0 e agency é ajustada para não estourar.

export type SplitInput = {
  paidAmount: number;              // total pago pelo inquilino
  nexoFee: number;                 // taxa fixa Nexo (R$)
  managementFeePercent: number;    // % de administração da imobiliária
  agencyPixKey?: string | null;
  ownerPixKey?: string | null;
  nexoPixKey: string;              // chave master Nexo (fica na conta, sem transfer)
};

export type SplitParty = {
  amount: number;
  pixKey: string | null;
  kind: "nexo" | "agency" | "owner";
};

export type SplitResult = {
  total: number;
  nexo: SplitParty;
  agency: SplitParty;
  owner: SplitParty;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeSplit(input: SplitInput): SplitResult {
  const total = round2(Math.max(0, input.paidAmount));
  const nexoFee = round2(Math.max(0, Math.min(total, input.nexoFee)));

  const remainderAfterNexo = round2(total - nexoFee);
  const pct = Math.max(0, Math.min(100, input.managementFeePercent || 0));
  let agencyCut = input.agencyPixKey ? round2((remainderAfterNexo * pct) / 100) : 0;
  if (agencyCut > remainderAfterNexo) agencyCut = remainderAfterNexo;

  const ownerAmount = round2(remainderAfterNexo - agencyCut);

  return {
    total,
    nexo:   { kind: "nexo",   amount: nexoFee,     pixKey: input.nexoPixKey },
    agency: { kind: "agency", amount: agencyCut,   pixKey: input.agencyPixKey ?? null },
    owner:  { kind: "owner",  amount: ownerAmount, pixKey: input.ownerPixKey ?? null },
  };
}
