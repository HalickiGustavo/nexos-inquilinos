// PayoutService — envia PIX via Stark usando /transfer + DictKey lookup,
// conforme docs oficiais (https://starkbank.com/docs/api).
//
// Fluxo:
//   1. GET /dict-key/{pixKey} → retorna { bankCode, branchCode, accountNumber,
//      accountType, taxId, name } do favorecido.
//   2. POST /transfer body { transfers: [{ amount, bankCode, branchCode,
//      accountNumber, accountType, taxId, name, externalId, description, tags }] }
//   3. Status inicial "created" | "processing"; webhook `transfer` fecha
//      para "success" | "failed".

import { starkFetch } from "./stark.server";

export type StarkDictKey = {
  id: string;                     // a própria pix key
  type: string;                   // cpf | cnpj | email | phone | evp
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  accountType: "checking" | "savings" | "salary" | "payment";
  name: string;
  taxId: string;
  ownerType: "naturalPerson" | "legalPerson";
  status: string;
};

export async function getDictKey(pixKey: string) {
  const res = await starkFetch<{ dictKey: StarkDictKey }>({
    method: "GET",
    path: `/dict-key/${encodeURIComponent(pixKey)}`,
  });
  if (!res.dictKey) throw new Error(`dict-key não encontrada: ${pixKey}`);
  return res.dictKey;
}

export type StarkTransfer = {
  id: string;
  amount: number;
  externalId: string;
  status: "created" | "processing" | "success" | "failed";
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  accountType: string;
  name: string;
  taxId: string;
  description?: string;
  fee?: number;
  endToEndId?: string;
  transactionIds?: string[];
  created: string;
  updated: string;
};

export type CreateTransferInput = {
  externalId: string;             // idempotência
  amount: number;                 // reais
  pixKey: string;                 // resolvida via DictKey.get
  description?: string;
  tags?: string[];
};

export async function createTransfer(input: CreateTransferInput) {
  const dict = await getDictKey(input.pixKey);
  const body = {
    transfers: [
      {
        amount: Math.round(input.amount * 100),
        externalId: input.externalId,
        bankCode: dict.bankCode,
        branchCode: dict.branchCode,
        accountNumber: dict.accountNumber,
        accountType: dict.accountType,
        taxId: dict.taxId,
        name: dict.name,
        description: (input.description ?? "Repasse Nexo").slice(0, 140),
        tags: input.tags ?? [],
      },
    ],
  };
  const res = await starkFetch<{ transfers: StarkTransfer[] }>({
    method: "POST",
    path: "/transfer",
    body,
  });
  const created = res.transfers?.[0];
  if (!created) throw new Error("transfer: resposta vazia");
  return created;
}

export async function getTransfer(id: string) {
  return starkFetch<{ transfer: StarkTransfer }>({
    method: "GET",
    path: `/transfer/${id}`,
  });
}
