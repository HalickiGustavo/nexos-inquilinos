// Efí PIX cobrança imediata — helpers usados pelo backend do NEXO.
//
// Fase 1: mesma semântica do fluxo Stark (`generateTripleSplitPix`), porém
// via Efí. A geração do txid é determinística por parcela para garantir
// idempotência (recuperar cobrança existente em vez de duplicar).

import { efiCobCreate, efiCobGet, efiQrCodeGet, type EfiCobRequest } from "./efi.server";

// txid Efí: 26–35 chars alfanuméricos. Deriva de uuid da parcela.
export function txidFromInstallmentId(installmentId: string): string {
  const clean = installmentId.replace(/-/g, "");
  // prefixo "nexo" + 30 chars do uuid → 34 chars, dentro do range aceito.
  return `nexo${clean}`.slice(0, 35);
}

export type CreateEfiPixInput = {
  installmentId: string;
  amount: number;
  expirationSeconds?: number;
  payer: { taxId: string; name: string };
  pixKey: string; // chave Pix da conta NEXO em Efí
  descriptions?: Array<{ key: string; value: string }>;
};

export type CreateEfiPixResult = {
  txid: string;
  locId: number | null;
  pixPayload: string;
  qrCodeBase64: string;
  status: string;
};

export async function createOrReuseEfiPix(input: CreateEfiPixInput): Promise<CreateEfiPixResult> {
  const txid = txidFromInstallmentId(input.installmentId);

  const doc = input.payer.taxId.replace(/\D/g, "");
  const devedor =
    doc.length === 14
      ? { cnpj: doc, nome: input.payer.name }
      : { cpf: doc, nome: input.payer.name };

  const body: EfiCobRequest = {
    calendario: { expiracao: input.expirationSeconds ?? 86400 },
    devedor,
    valor: { original: input.amount.toFixed(2) },
    chave: input.pixKey,
    solicitacaoPagador: input.descriptions?.[0]?.value ?? "Aluguel NEXO",
    infoAdicionais: input.descriptions?.map((d) => ({ nome: d.key, valor: d.value })),
  };

  // Idempotência: tenta GET, se não existe cria; se existe e está ATIVA reutiliza.
  const getWithRetry = async (attempts = 4): Promise<EfiCobResponse | null> => {
    for (let i = 0; i < attempts; i++) {
      const r = await efiCobGet(txid).catch(() => null);
      if (r) return r;
      if (i < attempts - 1) await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
    return null;
  };

  let cob = await efiCobGet(txid).catch(() => null);
  if (!cob || cob.status === "REMOVIDA_PELO_USUARIO_RECEBEDOR" || cob.status === "REMOVIDA_PELO_PSP") {
    try {
      cob = await efiCobCreate(txid, body);
    } catch (err: any) {
      // 409 txid_duplicado: cobrança já existe na Efí mas GET pode responder
      // 400 cobranca_nao_encontrada por eventual consistency — tenta reler com backoff.
      const bodyErr = err?.body;
      const isDup = err?.status === 409 || bodyErr?.nome === "txid_duplicado";
      if (!isDup) throw err;
      cob = await getWithRetry();
      if (!cob) {
        throw new Error(
          "Efí reportou txid duplicado mas não retorna a cobrança. Tente novamente em alguns segundos.",
        );
      }
    }
  }

  const locId = cob.loc?.id ?? null;
  let pixPayload = cob.pixCopiaECola ?? "";
  let qrCodeBase64 = "";
  if (locId != null) {
    // qrcode_get exige scope pix.read; se falhar (insufficient_scope, 404, etc.)
    // não invalidamos a cobrança — o pixCopiaECola da criação já é suficiente
    // (o cliente renderiza o QR a partir do payload).
    try {
      const qr = await efiQrCodeGet(locId);
      pixPayload = qr.qrcode || pixPayload;
      qrCodeBase64 = (qr.imagemQrcode ?? "").replace(/^data:image\/png;base64,/, "");
    } catch (err) {
      console.warn("[efi] qrcode_get failed, using pixCopiaECola fallback", err);
    }
  }


  return {
    txid,
    locId,
    pixPayload,
    qrCodeBase64,
    status: cob.status,
  };
}
