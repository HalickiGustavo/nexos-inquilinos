/**
 * Efí Pay adapter — server-only.
 *
 * Modos:
 * - MOCK (sem EFI_CLIENT_ID): Pix gera BR Code estático válido apontando para
 *   a chave Pix Nexo; Boleto e sendPix retornam erro amigável.
 * - PRODUÇÃO (com credenciais): chama API real da Efí com split nativo
 *   (Pix), emite boletos e dispara transferências Pix para repasse D+1.
 *
 * Secrets esperados em produção:
 *   EFI_CLIENT_ID, EFI_CLIENT_SECRET, EFI_CERTIFICATE_BASE64,
 *   EFI_PIX_KEY, EFI_WEBHOOK_HMAC, EFI_ENV (sandbox|production).
 */
import QRCode from "qrcode";
import { createHmac, timingSafeEqual } from "node:crypto";

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
  qrCodeBase64: string;
};

export type BoletoChargeInput = {
  installmentId: string;
  totalValue: number;
  dueDate: string; // YYYY-MM-DD
  customer: {
    name: string;
    document: string; // CPF/CNPJ digits only
    email?: string;
    phone?: string;
  };
  description: string;
};

export type BoletoChargeResult = {
  provider: "efi" | "mock";
  chargeId: string;
  url: string;
  barcode: string;
  pdfUrl: string;
};

export type SendPixInput = {
  idEnvio: string;
  amount: number;
  pixKey: string;
  description: string;
};

export type SendPixResult = {
  provider: "efi" | "mock";
  e2eId: string;
  status: "PROCESSING" | "COMPLETED" | "MOCK";
};

export function isEfiProductionMode(): boolean {
  return !!process.env.EFI_CLIENT_ID && !!process.env.EFI_CLIENT_SECRET && !!process.env.EFI_CERTIFICATE_BASE64;
}

// =====================================================================
// EMV helpers (BR Code Pix estático — fallback MOCK)
// =====================================================================

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
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
    tlv("00", "01") +
    tlv("01", "12") +
    merchantAccount +
    tlv("52", "0000") +
    tlv("53", "986") +
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

// =====================================================================
// HTTPS + OAuth (mTLS com certificado P12)
// =====================================================================

let cachedToken: { value: string; expiresAt: number } | null = null;

function serializeProviderError(error: unknown) {
  const e = error as any;
  const cause = e?.cause as any;
  return {
    name: e?.name ?? null,
    message: e?.message ?? String(error),
    code: e?.code ?? null,
    causeName: cause?.name ?? null,
    causeMessage: cause?.message ?? null,
    causeCode: cause?.code ?? null,
  };
}

function attachEfiDebug(error: Error, debug: Record<string, unknown>) {
  (error as any).efiDebug = debug;
  return error;
}

function summarizeJsonText(text: string) {
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text.slice(0, 1200);
  }
}

function efiRuntimeFlags(api: "pix" | "boleto") {
  const certBytes = process.env.EFI_CERTIFICATE_BASE64
    ? Buffer.from(process.env.EFI_CERTIFICATE_BASE64, "base64").length
    : 0;
  return {
    api,
    env: (process.env.EFI_ENV || "production").toLowerCase(),
    hasClientId: Boolean(process.env.EFI_CLIENT_ID),
    hasClientSecret: Boolean(process.env.EFI_CLIENT_SECRET),
    hasCertificateBase64: Boolean(process.env.EFI_CERTIFICATE_BASE64),
    certificateBytes: certBytes,
    hasCertificatePassphrase: Boolean(process.env.EFI_CERTIFICATE_PASSPHRASE),
    hasPixKey: Boolean(process.env.EFI_PIX_KEY),
  };
}

function getEfiBaseUrl(api: "pix" | "boleto"): string {
  const env = (process.env.EFI_ENV || "production").toLowerCase();
  if (api === "pix") {
    return env === "sandbox"
      ? "https://pix-h.api.efipay.com.br"
      : "https://pix.api.efipay.com.br";
  }
  return env === "sandbox"
    ? "https://sandbox.gerencianet.com.br/v1"
    : "https://api.gerencianet.com.br/v1";
}

async function getEfiAgent(): Promise<any> {
  // Carrega o certificado P12 e cria um https.Agent. Import dinâmico para
  // não quebrar o build quando rodando em modo mock.
  const https = await import("node:https");
  const pfxB64 = process.env.EFI_CERTIFICATE_BASE64!;
  const pfx = Buffer.from(pfxB64, "base64");
  return new https.Agent({ pfx, passphrase: process.env.EFI_CERTIFICATE_PASSPHRASE || "" });
}

async function efiOAuthToken(api: "pix" | "boleto"): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;

  const baseUrl = getEfiBaseUrl(api);
  const id = process.env.EFI_CLIENT_ID!;
  const secret = process.env.EFI_CLIENT_SECRET!;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  const agent = await getEfiAgent();
  // Node fetch via undici não aceita https.Agent; usamos undici diretamente.
  const { fetch: undiciFetch, Agent } = await import("undici");
  const dispatcher = new Agent({ connect: { pfx: (agent as any).options.pfx, passphrase: (agent as any).options.passphrase } });

  let res: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    res = await undiciFetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${basic}` },
      body: JSON.stringify({ grant_type: "client_credentials" }),
      dispatcher,
    } as any);
  } catch (error) {
    const debug = {
      step: "oauth-fetch",
      method: "POST",
      url: `${baseUrl}/oauth/token`,
      runtime: efiRuntimeFlags(api),
      error: serializeProviderError(error),
    };
    console.error("[efi] OAuth fetch failed", debug);
    throw attachEfiDebug(new Error("Falha de conexão com a Efí ao autenticar."), debug);
  }

  if (!res.ok) {
    const txt = await res.text();
    const debug = {
      step: "oauth-response",
      method: "POST",
      url: `${baseUrl}/oauth/token`,
      status: res.status,
      statusText: res.statusText,
      response: summarizeJsonText(txt),
      runtime: efiRuntimeFlags(api),
    };
    console.error("[efi] OAuth rejected", debug);
    throw attachEfiDebug(new Error(`Efí OAuth falhou: ${res.status}`), debug);
  }
  const data: any = await res.json();
  cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function efiFetch(api: "pix" | "boleto", path: string, init: { method: string; body?: any }): Promise<any> {
  const token = await efiOAuthToken(api);
  const baseUrl = getEfiBaseUrl(api);
  const { fetch: undiciFetch, Agent } = await import("undici");
  const pfx = Buffer.from(process.env.EFI_CERTIFICATE_BASE64!, "base64");
  const dispatcher = new Agent({ connect: { pfx, passphrase: process.env.EFI_CERTIFICATE_PASSPHRASE || "" } });

  let res: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    res = await undiciFetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: init.body ? JSON.stringify(init.body) : undefined,
      dispatcher,
    } as any);
  } catch (error) {
    const debug = {
      step: "api-fetch",
      method: init.method,
      url: `${baseUrl}${path}`,
      runtime: efiRuntimeFlags(api),
      error: serializeProviderError(error),
    };
    console.error("[efi] API fetch failed", debug);
    throw attachEfiDebug(new Error(`Falha de conexão com a Efí em ${init.method} ${path}.`), debug);
  }

  const text = await res.text();
  if (!res.ok) {
    const debug = {
      step: "api-response",
      method: init.method,
      url: `${baseUrl}${path}`,
      status: res.status,
      statusText: res.statusText,
      response: summarizeJsonText(text),
      runtime: efiRuntimeFlags(api),
    };
    console.error("[efi] API rejected", debug);
    throw attachEfiDebug(new Error(`Efí ${init.method} ${path} falhou com status ${res.status}.`), debug);
  }
  return text ? JSON.parse(text) : {};
}

// =====================================================================
// PIX com split nativo
// =====================================================================

export async function createSplitCharge(input: SplitChargeInput): Promise<SplitChargeResult> {
  if (!isEfiProductionMode()) {
    // Sem credenciais Efí: gera BR Code estático apontando direto para o
    // PROPRIETÁRIO (preferido) ou imobiliária; sem split, mas o dinheiro
    // cai na conta certa. Nexo é último fallback.
    const target =
      input.receivers.owner?.pixKey
        ? input.receivers.owner
        : input.receivers.agency?.pixKey
          ? input.receivers.agency
          : input.receivers.nexo;
    if (!target?.pixKey) throw new Error("Nenhuma chave Pix disponível (proprietário/imobiliária/Nexo).");
    const payload = buildBrCode({
      pixKey: target.pixKey,
      amount: input.totalValue,
      txid: input.txid,
      merchantName: target.name || "NEXO",
      merchantCity: "SAO PAULO",
      description: input.description,
    });
    const qr = await pngBase64FromPayload(payload);
    return { provider: "mock", txid: input.txid, pixPayload: payload, qrCodeBase64: qr };
  }

  // Produção — split nativo Efí
  const nexoKey = process.env.EFI_PIX_KEY || input.receivers.nexo.pixKey;
  const splits: Array<{ identificador: string; valor: string; chave: string }> = [];
  if (input.receivers.agency) {
    splits.push({
      identificador: `agency-${input.txid}`.slice(0, 35),
      valor: input.receivers.agency.amount.toFixed(2),
      chave: input.receivers.agency.pixKey,
    });
  }
  if (input.receivers.owner) {
    splits.push({
      identificador: `owner-${input.txid}`.slice(0, 35),
      valor: input.receivers.owner.amount.toFixed(2),
      chave: input.receivers.owner.pixKey,
    });
  }

  const cob = await efiFetch("pix", `/v2/cob/${input.txid}`, {
    method: "PUT",
    body: {
      calendario: { expiracao: 3600 },
      valor: { original: input.totalValue.toFixed(2) },
      chave: nexoKey,
      solicitacaoPagador: input.description.slice(0, 140),
      ...(splits.length ? { split: { divisao: splits } } : {}),
    },
  });

  const locId = cob.loc?.id;
  if (!locId) throw new Error("Efí não retornou loc.id para gerar QR Code");
  const qr = await efiFetch("pix", `/v2/loc/${locId}/qrcode`, { method: "GET" });

  return {
    provider: "efi",
    txid: input.txid,
    pixPayload: qr.qrcode,
    qrCodeBase64: (qr.imagemQrcode || "").replace(/^data:image\/png;base64,/, ""),
  };
}

// =====================================================================
// BOLETO (cai 100% na conta Efí da Nexo; repasse via sendPix D+1)
// =====================================================================

export async function createBoletoCharge(input: BoletoChargeInput): Promise<BoletoChargeResult> {
  if (!isEfiProductionMode()) {
    throw new Error(
      "Boleto indisponível em modo mock. Cadastre as credenciais da Efí Pay para emitir boletos.",
    );
  }

  const docDigits = input.customer.document.replace(/\D/g, "");
  const isCnpj = docDigits.length === 14;

  const body = {
    items: [
      { name: input.description.slice(0, 60), value: Math.round(input.totalValue * 100), amount: 1 },
    ],
    payment: {
      banking_billet: {
        expire_at: input.dueDate,
        message: `Aluguel processado por NEXO`,
        customer: {
          name: input.customer.name,
          email: input.customer.email,
          phone_number: (input.customer.phone || "").replace(/\D/g, "") || undefined,
          [isCnpj ? "juridical_person" : "cpf"]: isCnpj
            ? { corporate_name: input.customer.name, cnpj: docDigits }
            : (docDigits as any),
        },
      },
    },
  };

  const created = await efiFetch("boleto", "/charge/one-step", { method: "POST", body });
  const data = created.data ?? created;
  return {
    provider: "efi",
    chargeId: String(data.charge_id ?? data.id),
    url: data.link ?? data.charge?.link ?? "",
    barcode: data.barcode ?? data.charge?.barcode ?? "",
    pdfUrl: data.pdf?.charge ?? data.charge?.pdf ?? "",
  };
}

// =====================================================================
// sendPix — repasse para imobiliária / proprietário
// =====================================================================

export async function sendPix(input: SendPixInput): Promise<SendPixResult> {
  if (!isEfiProductionMode()) {
    return { provider: "mock", e2eId: `mock-${input.idEnvio}`, status: "MOCK" };
  }
  const body = {
    valor: input.amount.toFixed(2),
    pagador: { chave: process.env.EFI_PIX_KEY!, infoPagador: input.description.slice(0, 140) },
    favorecido: { chave: input.pixKey },
  };
  const res = await efiFetch("pix", `/v3/gn/pix/${input.idEnvio}`, { method: "PUT", body });
  return { provider: "efi", e2eId: res.e2eId ?? res.endToEndId ?? input.idEnvio, status: "PROCESSING" };
}

// =====================================================================
// Webhook HMAC
// =====================================================================

export function verifyEfiWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.EFI_WEBHOOK_HMAC;
  if (!secret) return false; // sem segredo, bloqueia
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
