// Envio de PIX via Efí Bank (API Pix /v3/gn/pix/:idEnvio).
// SERVER-ONLY — usa o efi-proxy (mTLS/Deno) para as chamadas.
//
// Docs: https://dev.efipay.com.br/docs/api-pix/pix-envio
// Escopos necessários: gn.pix.send.write / gn.pix.send.read
//   (habilitar em https://sejaefi.com.br/central/aplicacoes)

export type EfiPixSendInput = {
  idEnvio: string;                // 26-35 chars, idempotência
  amount: number;                 // reais (>= 0.01)
  payerPixKey: string;            // chave PIX da conta NEXO (pagador)
  receiverPixKey: string;         // chave do favorecido
  description?: string;
  receiverInfo?: { nome: string; cpf?: string; cnpj?: string };
};

export type EfiPixSendResponse = {
  idEnvio: string;
  e2eId: string;
  valor: string;
  horario: { solicitacao: string };
  status: "EM_PROCESSAMENTO" | "REALIZADO" | "NAO_REALIZADO";
};

async function callProxy<T = any>(action: string, params: unknown): Promise<T> {
  const url = process.env.EFI_PROXY_URL;
  const secret = process.env.EFI_PROXY_SECRET;
  if (!url || !secret) throw new Error("Efí proxy não configurado");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-efi-proxy-secret": secret },
    body: JSON.stringify({ action, params }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    const err: any = new Error(`efi-proxy ${action} failed (${res.status}) ${detail}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

/** Gera idEnvio determinístico a partir da linha de payment_transfers.
 *  Formato: nx<uuidSemHifens>  → 34 chars (dentro do range 26-35). */
export function idEnvioFromTransferId(transferId: string): string {
  const clean = transferId.replace(/-/g, "");
  return `nx${clean}`.slice(0, 35);
}

/** Formata valor em reais como string "0.00" exigida pela Efí. */
function fmtValor(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2);
}

export async function efiPixSend(input: EfiPixSendInput): Promise<EfiPixSendResponse> {
  if (!input.payerPixKey) throw new Error("payerPixKey ausente (EFI_PIX_KEY)");
  if (!input.receiverPixKey) throw new Error("receiverPixKey ausente");
  if (!(input.amount > 0)) throw new Error("valor inválido");

  const favorecido: any = { chave: input.receiverPixKey };
  if (input.receiverInfo?.nome) {
    const doc = (input.receiverInfo.cpf ?? input.receiverInfo.cnpj ?? "").replace(/\D/g, "");
    if (doc) {
      favorecido.identificacao = {
        nome: input.receiverInfo.nome,
        ...(doc.length === 14 ? { cnpj: doc } : { cpf: doc }),
      };
    }
  }
  const body = {
    valor: fmtValor(input.amount),
    pagador: {
      chave: input.payerPixKey,
      infoPagador: (input.description ?? "Repasse Nexo").slice(0, 140),
    },
    favorecido,
  };
  return callProxy<EfiPixSendResponse>("pix_send", { idEnvio: input.idEnvio, body });
}

export async function efiPixSendGet(idEnvio: string): Promise<EfiPixSendResponse | null> {
  try {
    return await callProxy<EfiPixSendResponse>("pix_send_get", { idEnvio });
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}
