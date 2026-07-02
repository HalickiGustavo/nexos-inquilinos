// Cria cobranças Stark (Invoice — dynamic Pix reconciliado — e Boleto)
// seguindo a documentação oficial: https://starkbank.com/docs/api
//
// Escolhemos Invoice em vez de DynamicBrcode porque Invoice é a cobrança
// PIX dinâmica RECONCILIADA (a Stark casa pagamento ↔ cobrança e dispara
// evento `invoice` com status='paid' via webhook — sem precisar consultar
// Deposits pelo tag `dynamic-brcode/{uuid}`).

import { starkFetch, starkHost } from "./stark.server";

export type CreateInvoiceInput = {
  installmentId: string;
  amount: number;                 // reais
  payer: {
    taxId: string;                // CPF/CNPJ (com ou sem máscara)
    name: string;
  };
  due?: string;                   // ISO date (YYYY-MM-DD) ou datetime
  expirationSeconds?: number;     // após due
  fine?: number;                  // %
  interest?: number;              // % ao mês
  descriptions?: Array<{ key: string; value: string }>;
  tags?: string[];
};

export type StarkInvoice = {
  id: string;
  amount: number;
  due: string;
  expiration: number;
  taxId: string;
  name: string;
  brcode: string;                 // copia-e-cola PIX
  link: string;                   // URL pública da fatura
  status: "created" | "paid" | "canceled" | "overdue" | "voided";
  pdf?: string;
  descriptions?: Array<{ key: string; value: string }>;
  tags?: string[];
  created: string;
  updated: string;
};

function randomExternalId(prefix: string, installmentId: string) {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}-${installmentId}-${rand}`;
}

export async function createInvoice(input: CreateInvoiceInput) {
  const external = randomExternalId("inv", input.installmentId);
  const invoice: Record<string, unknown> = {
    amount: Math.round(input.amount * 100),
    taxId: input.payer.taxId,
    name: input.payer.name,
    tags: input.tags ?? [`installment:${input.installmentId}`, `external:${external}`],
  };
  if (input.due) invoice.due = input.due;
  if (input.expirationSeconds) invoice.expiration = input.expirationSeconds;
  if (input.fine !== undefined) invoice.fine = input.fine;
  if (input.interest !== undefined) invoice.interest = input.interest;
  if (input.descriptions?.length) invoice.descriptions = input.descriptions;

  const res = await starkFetch<{ invoices: StarkInvoice[] }>({
    method: "POST",
    path: "/invoice",
    body: { invoices: [invoice] },
  });
  const created = res.invoices?.[0];
  if (!created) throw new Error("invoice: resposta vazia");
  return { ...created, externalId: external };
}

export async function getInvoice(id: string) {
  return starkFetch<{ invoice: StarkInvoice }>({
    method: "GET",
    path: `/invoice/${id}`,
  });
}

// Endpoint oficial retorna o PNG do QR Code diretamente (image/png).
// Fazemos fetch bruto porque starkFetch parseia JSON.
export async function getInvoiceQrCodePng(id: string): Promise<Uint8Array> {
  const { Ecdsa, PrivateKey } = await import("starkbank-ecdsa");
  const raw = (process.env.STARK_PROJECT_ID || "").trim();
  const accessId = /^(project|organization)\//i.test(raw) ? raw : `project/${raw}`;
  const accessTime = Math.floor(Date.now() / 1000).toString();
  const path = `/invoice/${id}/qrcode`;
  const message = `${accessId}:${accessTime}:`;
  const privateKey = PrivateKey.fromPem(process.env.STARK_PRIVATE_KEY!);
  const signature = Ecdsa.sign(message, privateKey).toBase64();

  const res = await fetch(`${starkHost()}${path}?size=320`, {
    method: "GET",
    headers: {
      "Access-Id": accessId,
      "Access-Time": accessTime,
      "Access-Signature": signature,
      Accept: "image/png",
      "User-Agent": "Nexo/1.0",
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`invoice qrcode ${res.status}: ${t.slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

// ---------------- Boleto ----------------

export type StarkBoleto = {
  id: string;
  amount: number;
  name: string;
  taxId: string;
  due: string;
  fine: number;
  interest: number;
  line: string;
  barCode: string;
  status: "created" | "paid" | "canceled" | "overdue" | "registered";
  transactionIds?: string[];
  created: string;
  pdf?: string;
};

export type CreateBoletoInput = {
  installmentId: string;
  amount: number;
  due: string;                    // YYYY-MM-DD
  payer: {
    name: string;
    taxId: string;
    streetLine1: string;
    streetLine2?: string;
    district: string;
    city: string;
    stateCode: string;
    zipCode: string;
  };
  descriptions?: Array<{ text: string; amount?: number }>;
  fine?: number;                  // %
  interest?: number;              // % ao mês
  tags?: string[];
};

export async function createBoleto(input: CreateBoletoInput) {
  const external = randomExternalId("bol", input.installmentId);
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
        tags: input.tags ?? [`installment:${input.installmentId}`, `external:${external}`],
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
  return { ...created, externalId: external };
}

export async function getBoleto(id: string) {
  return starkFetch<{ boleto: StarkBoleto }>({
    method: "GET",
    path: `/boleto/${id}`,
  });
}

export function getBoletoPdfUrl(boletoId: string) {
  return `${starkHost()}/boleto/${boletoId}/pdf`;
}
