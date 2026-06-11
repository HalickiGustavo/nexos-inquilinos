// DIMOB (Declaração de Informações sobre Atividades Imobiliárias)
// Gerador de arquivo no formato pipe-delimited aceito pelo PVA da Receita Federal.
// Registros:
//   R01  Cabeçalho da declaração
//   R02  Operações de locação (1 por contrato/ano)
//   T9   Trailer (contagem total de registros)
//
// Referência: Manual Layout DIMOB — Instrução Normativa RFB nº 1.115/2010 e alterações.

export type DimobContractRow = {
  property_id: string;
  property_label: string;
  property_address: string;
  property_zip: string;
  property_city: string;
  property_state: string;
  owner_doc: string;          // CPF/CNPJ
  owner_name: string;
  tenant_doc: string;
  tenant_name: string;
  monthly_rent: number[];     // 12 posições (Jan..Dez) — valores PAGOS
  monthly_tax: number[];      // 12 posições — IR retido na fonte (se houver)
  monthly_commission: number[]; // 12 posições — comissões da imobiliária
};

export type DimobAggregate = {
  year: number;
  declarant: { doc: string; name: string };
  rows: DimobContractRow[];
  totals: {
    rentSum: number;
    taxSum: number;
    commissionSum: number;
    contractCount: number;
  };
};

function onlyDigits(v: string | null | undefined) {
  return (v ?? "").replace(/\D+/g, "");
}


function padDoc(doc: string) {
  const d = onlyDigits(doc);
  if (d.length === 14) return d;          // CNPJ
  if (d.length === 11) return d;          // CPF
  return d;                                // PVA aceita ambos; valida tamanho
}

/**
 * Agrega instalments pagas no ano por contrato/imóvel/proprietário/inquilino.
 * Espera `installments` no shape de `useInstallments()` (com contract→property/tenant).
 */
export function aggregateDimob(args: {
  year: number;
  declarant: { doc: string; name: string };
  installments: any[];
  properties: any[];
  managementFeeFallback?: number;
}): DimobAggregate {
  const { year, declarant, installments, properties } = args;

  const byContract = new Map<string, DimobContractRow>();

  for (const inst of installments) {
    if (inst.status !== "pago") continue;
    const refDate = inst.payment_date || inst.due_date;
    if (!refDate) continue;
    const refYear = Number(String(refDate).slice(0, 4));
    if (refYear !== year) continue;

    const contract = inst.contract;
    if (!contract) continue;
    const property = contract.property || properties.find((p) => p.id === contract.property_id);
    const tenant = contract.tenant;
    if (!property) continue;

    const month = Number(String(refDate).slice(5, 7)) - 1; // 0..11
    if (month < 0 || month > 11) continue;

    const amount = Number(inst.paid_amount || inst.amount || 0);
    const feePercent = Number(
      inst.management_fee_percent ?? property.default_management_fee_percent ?? args.managementFeeFallback ?? 0,
    );
    const commission = (amount * feePercent) / 100;

    const key = contract.id;
    let row = byContract.get(key);
    if (!row) {
      row = {
        property_id: property.id,
        property_label: property.nickname || property.code || "",
        property_address: [property.address, property.neighborhood].filter(Boolean).join(", "),
        property_zip: onlyDigits(property.zip_code),
        property_city: property.city || "",
        property_state: property.state || "",
        owner_doc: padDoc(property.owner_doc || ""),
        owner_name: property.owner_name || "",
        tenant_doc: padDoc(tenant?.document || ""),
        tenant_name: tenant?.full_name || "",
        monthly_rent: Array(12).fill(0),
        monthly_tax: Array(12).fill(0),
        monthly_commission: Array(12).fill(0),
      };
      byContract.set(key, row);
    }
    row.monthly_rent[month] += amount;
    row.monthly_commission[month] += commission;
    // IR retido: caso a parcela registre `irrf_amount` no futuro
    if (inst.irrf_amount) row.monthly_tax[month] += Number(inst.irrf_amount);
  }

  const rows = Array.from(byContract.values()).sort((a, b) =>
    a.property_label.localeCompare(b.property_label, "pt-BR"),
  );

  const totals = rows.reduce(
    (acc, r) => {
      acc.rentSum += r.monthly_rent.reduce((s, v) => s + v, 0);
      acc.taxSum += r.monthly_tax.reduce((s, v) => s + v, 0);
      acc.commissionSum += r.monthly_commission.reduce((s, v) => s + v, 0);
      return acc;
    },
    { rentSum: 0, taxSum: 0, commissionSum: 0, contractCount: rows.length },
  );

  return { year, declarant, rows, totals };
}

/* -------------------------------------------------------------------------- */
/*  Helpers de layout posicional (fixed-width)                                */
/* -------------------------------------------------------------------------- */

/** Texto: maiúsculo, sem acentos, alinhado à esquerda e completado com espaços. */
function txt(value: string | null | undefined, length: number): string {
  const clean = (value ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ./-]/g, " ")
    .slice(0, length);
  return clean.padEnd(length, " ");
}

/** Número inteiro: alinhado à direita e preenchido com zeros à esquerda. */
function num(value: number | string | null | undefined, length: number): string {
  const digits = onlyDigits(String(value ?? "0"));
  const safe = digits.length === 0 ? "0" : digits;
  return safe.slice(-length).padStart(length, "0");
}

/** Valor monetário: 2 casas decimais SEM separadores, padStart com zeros. */
function money(value: number, length: number): string {
  const cents = Math.round((Number.isFinite(value) ? value : 0) * 100);
  const abs = Math.abs(cents).toString();
  return abs.slice(-length).padStart(length, "0");
}

/** Documento CPF/CNPJ posicional — 14 dígitos, leading zeros (CPF ocupa as últimas 11). */
function docField(doc: string | null | undefined): string {
  return onlyDigits(doc ?? "").padStart(14, "0");
}

/** Comprimento total padrão de uma linha do layout DIMOB. */
const LINE_LENGTH = 1200;

function padLine(line: string): string {
  return line.length >= LINE_LENGTH ? line.slice(0, LINE_LENGTH) : line.padEnd(LINE_LENGTH, " ");
}

/**
 * Gera o conteúdo .txt no layout POSICIONAL (fixed-width) do DIMOB.
 *
 * Estrutura por registro:
 *   R01 — Cabeçalho da declaração
 *     001-003  Tipo registro       "R01"
 *     004-017  CNPJ declarante     14 dígitos, leading zeros
 *     018-019  Ano-ref (AA)        2 dígitos finais do ano
 *     020-023  Ano-ref (AAAA)      4 dígitos do ano
 *     024-024  Indicador           "N" original / "S" retificadora
 *     025-074  Nº recibo anterior  50 chars
 *     075-224  Razão social        150 chars
 *     restante                     espaços até LINE_LENGTH
 *
 *   R02 — Operações de locação
 *     001-003  Tipo registro       "R02"
 *     004-017  CPF/CNPJ proprietário        14 dígitos
 *     018-077  Nome proprietário            60 chars
 *     078-091  CPF/CNPJ inquilino           14 dígitos
 *     092-151  Nome inquilino               60 chars
 *     152-211  Endereço do imóvel           60 chars
 *     212-219  CEP                          8 dígitos
 *     220-259  Município                    40 chars
 *     260-261  UF                           2 chars
 *     262-405  12 × Aluguel mensal          12 × 12 dígitos (centavos)
 *     406-549  12 × IRRF retido             12 × 12 dígitos (centavos)
 *     550-693  12 × Comissão imobiliária    12 × 12 dígitos (centavos)
 *     restante                              espaços até LINE_LENGTH
 *
 *   T9 — Trailer
 *     001-003  Tipo registro       "T9"
 *     004-010  Qtd. total registros (inclui T9)  7 dígitos, leading zeros
 *     restante                              espaços até LINE_LENGTH
 */
export function buildDimobFile(agg: DimobAggregate): string {
  const lines: string[] = [];
  const yearStr = String(agg.year);
  const yearShort = yearStr.slice(-2);

  // R01 — Cabeçalho
  const r01 =
    "R01" +                                     // 001-003
    docField(agg.declarant.doc) +               // 004-017 (14)
    yearShort.padStart(2, "0") +                // 018-019 (2)
    yearStr.padStart(4, "0") +                  // 020-023 (4)
    "N" +                                       // 024     (1) original
    txt("", 50) +                               // 025-074 (50) recibo anterior
    txt(agg.declarant.name, 150);               // 075-224 (150)
  lines.push(padLine(r01));

  // R02 — Operações de locação
  for (const r of agg.rows) {
    let line =
      "R02" +                                   // 001-003
      docField(r.owner_doc) +                   // 004-017 (14)
      txt(r.owner_name, 60) +                   // 018-077 (60)
      docField(r.tenant_doc) +                  // 078-091 (14)
      txt(r.tenant_name, 60) +                  // 092-151 (60)
      txt(r.property_address, 60) +             // 152-211 (60)
      num(r.property_zip, 8) +                  // 212-219 (8)
      txt(r.property_city, 40) +                // 220-259 (40)
      txt(r.property_state, 2);                 // 260-261 (2)

    // 12 × aluguel (cada um em 12 dígitos)
    for (const v of r.monthly_rent) line += money(v, 12);
    // 12 × IRRF
    for (const v of r.monthly_tax) line += money(v, 12);
    // 12 × comissão
    for (const v of r.monthly_commission) line += money(v, 12);

    lines.push(padLine(line));
  }

  // T9 — Trailer (inclui o próprio T9 na contagem)
  const total = lines.length + 1;
  const t9 = "T9" + num(total, 7);
  lines.push(padLine(t9));

  return lines.join("\r\n") + "\r\n";
}


export function downloadDimobFile(agg: DimobAggregate) {
  const content = buildDimobFile(agg);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DIMOB_${agg.year}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
