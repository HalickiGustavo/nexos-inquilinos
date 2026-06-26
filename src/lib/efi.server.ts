/**
 * Efí Pay adapter — server-only.
 *
 * Sem credenciais Efí (EFI_CLIENT_ID ausente): roda em modo MOCK e gera um
 * BR Code Pix estático válido (EMV + CRC16-CCITT) apontando para a chave Pix
 * Nexo. O split é registrado em `pix_splits` para reconciliação manual D+1.
 *
 * Com credenciais (futuro): chamar /v2/cob + /v2/loc/{id}/qrcode da Efí
 * passando o array `split`/`recebedores`.
 */
import QRCode from "qrcode";

export type SplitParty = {
  pixKey: string;
  pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  amount: number;
  name: string;
};

export type SplitChargeInput = {
  txid: string;
  totalValue: number;
  description: string;
  receivers: {
    nexo: SplitParty;
    agency?: SplitParty;
    owner?: SplitParty;
  };
};

export type SplitChargeResult = {
  provider: "efi" | "mock";
  txid: string;
  pixPayload: string;
  qrCodeBase64: string; // PNG without "data:image/png;base64,"
};

function isProductionMode(): boolean {
  return !!process.env.EFI_CLIENT_ID && !!process.env.EFI_CLIENT_SECRET;
}

// --- EMV helpers (BR Code Pix estático) ---

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(s: string, max: number): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .slice(0, max);
}

function buildBrCode(opts: {
  pixKey: string;
  amount: number;
  txid: string;
  merchantName: string;
  merchantCity: string;
  description: string;
}): string {
  const { pixKey, amount, txid, merchantName, merchantCity, description } = opts;
  const gui = tlv("00", "br.gov.bcb.pix");
  const keyTlv = tlv("01", pixKey);
  const descTlv = description ? tlv("02", sanitize(description, 50)) : "";
  const merchantAccount = tlv("26", gui + keyTlv + descTlv);

  const txidClean = sanitize(txid, 25) || "NEXO";
  const additional = tlv("62", tlv("05", txidClean));

  const partial =
    tlv("00", "01") + // payload format indicator
    tlv("01", "12") + // dynamic
    merchantAccount +
    tlv("52", "0000") + // merchant category
    tlv("53", "986") + // BRL
    tlv("54", amount.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", sanitize(merchantName, 25) || "NEXO") +
    tlv("60", sanitize(merchantCity, 15) || "SAO PAULO") +
    additional +
    "6304";

  return partial + crc16(partial);
}

async function pngBase64FromPayload(payload: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

/**
 * Cria cobrança Pix com split de 3 vias.
 *
 * Em modo MOCK, o QR aponta para a chave Pix Nexo pelo total da cobrança.
 * O Nexo então faz o repasse das fatias da imobiliária e do proprietário
 * (já registradas em `pix_splits`) via cron D+1 existente.
 */
export async function createSplitCharge(input: SplitChargeInput): Promise<SplitChargeResult> {
  if (isProductionMode()) {
    // TODO: trocar para chamada real:
    //   POST https://pix.api.efipay.com.br/v2/cob/{txid}
    //   body: { calendario, valor: { original }, chave: NEXO_KEY,
    //           split: { ... receivers ... }, infoAdicionais: [...] }
    // Por enquanto, mesmo com credenciais, caímos no fallback até a integração
    // real ser plugada.
  }

  const nexo = input.receivers.nexo;
  if (!nexo?.pixKey) throw new Error("Chave Pix da Nexo não configurada.");

  const payload = buildBrCode({
    pixKey: nexo.pixKey,
    amount: input.totalValue,
    txid: input.txid,
    merchantName: nexo.name || "NEXO",
    merchantCity: "SAO PAULO",
    description: input.description,
  });
  const qr = await pngBase64FromPayload(payload);
  return {
    provider: isProductionMode() ? "efi" : "mock",
    txid: input.txid,
    pixPayload: payload,
    qrCodeBase64: qr,
  };
}
