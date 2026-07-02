// Cria cobranças Stark (PIX dinâmico e Boleto) e persiste em stark_charges.

import { starkFetch } from "./stark.server";

function randomTxid(prefix = "NEXO") {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return (prefix + rand).slice(0, 32).toLowerCase();
}

export type CreateDynamicPixInput = {
  installmentId: string;
  amount: number;
  expirationSeconds?: number; // default 86400
  tags?: string[];
  description?: string;
};

export type StarkDynamicBrcode = {
  id: string;
  uuid: string;
  amount: number;
  expiration: number;
  brcode: string;   // copia e cola
  pictureUrl?: string;
  status: string;
  created: string;
  updated: string;
};

export async function createDynamicPix(input: CreateDynamicPixInput) {
  const external = `inst-${input.installmentId}-${Date.now()}`;
  const body = {
    brcodes: [
      {
        amount: Math.round(input.amount * 100), // centavos
        expiration: input.expirationSeconds ?? 86400,
        tags: input.tags ?? [`installment:${input.installmentId}`],
        externalId: external,
      },
    ],
  };
  const res = await starkFetch<{ brcodes: StarkDynamicBrcode[] }>({
    method: "POST",
    path: "/dynamic-brcode",
    body,
  });
  const created = res.brcodes?.[0];
  if (!created) throw new Error("dynamic-brcode: resposta vazia");
  return { ...created, externalId: external, txid: randomTxid() };
}

export type StarkBoleto = {
  id: string;
  amount: number;
  name: string;
  taxId: string;
  streetLine1: string;
  streetLine2?: string;
  district: string;
  city: string;
  stateCode: string;
  zipCode: string;
  due: string;
  fine: number;
  interest: number;
  ourNumber?: string;
  line: string;
  barCode: string;
  status: string;
  transactionIds?: string[];
  created: string;
  pdf?: string;
};

export type CreateBoletoInput = {
  installmentId: string;
  amount: number;
  due: string; // YYYY-MM-DD
  payer: {
    name: string;
    taxId: string;      // CPF/CNPJ com máscara
    streetLine1: string;
    streetLine2?: string;
    district: string;
    city: string;
    stateCode: string;
    zipCode: string;
  };
  descriptions?: Array<{ text: string; amount?: number }>;
  fine?: number;      // %
  interest?: number;  // % ao mês
  tags?: string[];
};

export async function createBoleto(input: CreateBoletoInput) {
  const body = {
    boletos: [
      {
        amount: Math.round(input.amount * 100),
        name: input.payer.name,
        taxId: input.payer.taxId,
        streetLine1: input.payer.streetLine1,
        streetLine2: input.payer.streetLine2 ?? "",
        district: input.payer.district,
        city: input.payer.city,
        stateCode: input.payer.stateCode,
        zipCode: input.payer.zipCode,
        due: input.due,
        fine: input.fine ?? 2,
        interest: input.interest ?? 1,
        descriptions: input.descriptions ?? [],
        tags: input.tags ?? [`installment:${input.installmentId}`],
      },
    ],
  };
  const res = await starkFetch<{ boletos: StarkBoleto[] }>({
    method: "POST",
    path: "/boleto",
    body,
  });
  const created = res.boletos?.[0];
  if (!created) throw new Error("boleto: resposta vazia");
  return created;
}

export async function getBoletoPdfUrl(boletoId: string) {
  // O PDF é acessível via GET /boleto/{id}/pdf (redirect). Usamos endpoint direto.
  return `${(process.env.STARK_ENVIRONMENT || "sandbox").toLowerCase() === "production"
    ? "https://api.starkbank.com/v2"
    : "https://sandbox.api.starkbank.com/v2"}/boleto/${boletoId}/pdf`;
}

// Consulta status para reconciliação
export async function getDynamicBrcode(id: string) {
  return starkFetch<{ dynamicBrcode: StarkDynamicBrcode }>({
    method: "GET",
    path: `/dynamic-brcode/${id}`,
  });
}

export async function getBoleto(id: string) {
  return starkFetch<{ boleto: StarkBoleto }>({
    method: "GET",
    path: `/boleto/${id}`,
  });
}
