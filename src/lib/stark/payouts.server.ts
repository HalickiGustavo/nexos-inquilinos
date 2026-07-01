// PayoutService — envia PIX via Stark (PixRequest).
// Nunca é chamado dentro do webhook: sempre pelo worker que drena a fila.

import { starkFetch } from "./stark.server";

export type PixRequestInput = {
  externalId: string;      // idempotência
  amount: number;          // reais
  pixKey: string;
  description?: string;
  taxId?: string;          // opcional — CPF/CNPJ do favorecido
  receiverName?: string;
};

export type StarkPixRequest = {
  id: string;
  amount: number;
  externalId: string;
  status: "created" | "processing" | "success" | "failed";
  senderName?: string;
  receiverName?: string;
  fee?: number;
  endToEndId?: string;
  created: string;
  updated: string;
};

export async function sendPix(input: PixRequestInput) {
  const body = {
    pixRequests: [
      {
        amount: Math.round(input.amount * 100),
        externalId: input.externalId,
        pixKey: input.pixKey,
        description: input.description ?? "Repasse Nexo",
        ...(input.taxId ? { receiverTaxId: input.taxId } : {}),
        ...(input.receiverName ? { receiverName: input.receiverName } : {}),
      },
    ],
  };
  const res = await starkFetch<{ pixRequests: StarkPixRequest[] }>({
    method: "POST",
    path: "/pix-request",
    body,
  });
  const created = res.pixRequests?.[0];
  if (!created) throw new Error("pix-request: resposta vazia");
  return created;
}

export async function getPixRequest(id: string) {
  return starkFetch<{ pixRequest: StarkPixRequest }>({
    method: "GET",
    path: `/pix-request/${id}`,
  });
}
