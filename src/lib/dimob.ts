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

function fmtVal(n: number) {
  // Formato Receita: sem separador de milhar, vírgula como decimal, 2 casas.
  return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
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

/**
 * Gera o conteúdo .txt no layout pipe-delimited do PVA DIMOB.
 */
export function buildDimobFile(agg: DimobAggregate): string {
  const lines: string[] = [];

  // R01 - Cabeçalho
  // R01|CNPJ|NOME|ANO_REF|IND_RETIFICADORA|NUM_RECIBO_ANTERIOR|
  lines.push(
    [
      "R01",
      padDoc(agg.declarant.doc),
      agg.declarant.name.trim().toUpperCase(),
      String(agg.year),
      "N",   // N = Original, S = Retificadora
      "",    // Número do recibo anterior (vazio quando original)
    ].join("|") + "|",
  );

  // R02 - Operações de locação
  for (const r of agg.rows) {
    const parts = [
      "R02",
      r.owner_doc,
      r.owner_name.trim().toUpperCase(),
      r.tenant_doc,
      r.tenant_name.trim().toUpperCase(),
      // Valores mensais de aluguel (Jan..Dez)
      ...r.monthly_rent.map(fmtVal),
      // IR retido na fonte (Jan..Dez)
      ...r.monthly_tax.map(fmtVal),
      // Comissões pagas à imobiliária (Jan..Dez)
      ...r.monthly_commission.map(fmtVal),
      // Endereço do imóvel
      r.property_address.toUpperCase(),
      r.property_zip,
      r.property_city.toUpperCase(),
      r.property_state.toUpperCase(),
    ];
    lines.push(parts.join("|") + "|");
  }

  // T9 - Trailer
  // T9|TOTAL_REGISTROS|  (inclui R01 + R02s + o próprio T9)
  const total = lines.length + 1;
  lines.push(["T9", String(total)].join("|") + "|");

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
