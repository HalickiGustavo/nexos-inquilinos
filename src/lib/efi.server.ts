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
  document?: string | null;
  efiAccountNumber?: string | null;
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

function onlyDigits(value?: string | null): string {
  return String(value ?? "").replace(/\D/g, "");
}

function buildEfiSplitFavorecido(party: SplitParty, label: string): { cpf?: string; cnpj?: string; conta: string } {
  const conta = onlyDigits(party.efiAccountNumber);
  if (!conta) {
    throw new Error(
      `Split nativo da Efí exige o número da conta Efí do ${label}. Cadastre a conta Efí do favorecido antes de gerar o Pix.`,
    );
  }

  const docFromPixKey = party.pixKeyType === "CPF" || party.pixKeyType === "CNPJ" ? party.pixKey : null;
  const document = onlyDigits(party.document || docFromPixKey);
  if (document.length === 11) return { cpf: document, conta };
  if (document.length === 14) return { cnpj: document, conta };

  throw new Error(
    `Split nativo da Efí exige CPF/CNPJ do ${label} vinculado à conta Efí. Use uma chave Pix CPF/CNPJ ou cadastre o documento do favorecido.`,
  );
}

function formatEfiMoney(value: number): string {
  return Number(value).toFixed(2);
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

function normalizeDynamicPixLocation(location: string): string {
  const clean = location.trim().replace(/^https?:\/\//i, "");
  if (!clean) throw new Error("Efí retornou location vazio para o Pix dinâmico.");
  if (clean.length > 77) {
    throw new Error(`Location Pix dinâmico inválido: excede 77 caracteres (${clean.length}).`);
  }
  return clean;
}

function buildDynamicBrCode(opts: {
  location: string;
  amount: number;
  merchantName: string;
  merchantCity: string;
}): string {
  const gui = tlv("00", "br.gov.bcb.pix");
  const urlTlv = tlv("25", normalizeDynamicPixLocation(opts.location));
  const merchantAccount = tlv("26", gui + urlTlv);
  const additional = tlv("62", tlv("05", "***"));
  const partial =
    tlv("00", "01") +
    tlv("01", "12") +
    merchantAccount +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", opts.amount.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", sanitize(opts.merchantName, 25) || "NEXO") +
    tlv("60", sanitize(opts.merchantCity, 15) || "SAO PAULO") +
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
// Cliente HTTP -> Supabase Edge Function (mTLS roda no Deno)
// =====================================================================
//
// O Worker da Lovable não implementa ALPNProtocols, então o handshake mTLS
// da Efí falha aqui. Delegamos toda a chamada para a edge function
// `efi-pix-proxy` (Deno), que carrega o certificado P12 e proxia a request.

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

function efiRuntimeFlags(api: "pix" | "boleto") {
  return {
    api,
    transport: "supabase-edge-function:efi-pix-proxy",
    env: (process.env.EFI_ENV || "production").toLowerCase(),
    hasClientId: Boolean(process.env.EFI_CLIENT_ID),
    hasClientSecret: Boolean(process.env.EFI_CLIENT_SECRET),
    hasCertificateBase64: Boolean(process.env.EFI_CERTIFICATE_BASE64),
    hasPixKey: Boolean(process.env.EFI_PIX_KEY),
  };
}

async function efiFetch(
  api: "pix" | "boleto",
  path: string,
  init: { method: string; body?: any },
): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let invoked: { data: any; error: any };
  try {
    invoked = await supabaseAdmin.functions.invoke("efi-pix-proxy", {
      body: { api, path, method: init.method, body: init.body },
    });
  } catch (error) {
    const debug = {
      step: "edge-invoke",
      method: init.method,
      path,
      runtime: efiRuntimeFlags(api),
      error: serializeProviderError(error),
    };
    console.error("[efi] edge function invoke failed", debug);
    throw attachEfiDebug(new Error("Falha ao chamar o proxy mTLS da Efí."), debug);
  }

  if (invoked.error) {
    const debug = {
      step: "edge-error",
      method: init.method,
      path,
      runtime: efiRuntimeFlags(api),
      error: invoked.error,
    };
    console.error("[efi] edge function returned error", debug);
    throw attachEfiDebug(new Error("Proxy mTLS da Efí retornou erro."), debug);
  }

  const payload = invoked.data ?? {};
  if (!payload.ok) {
    const debug = {
      step: "efi-response",
      method: init.method,
      path,
      status: payload.status,
      response: payload.body ?? payload.error,
      runtime: efiRuntimeFlags(api),
    };
    console.error("[efi] api rejected via proxy", debug);
    throw attachEfiDebug(
      new Error(
        `Efí ${init.method} ${path} falhou (status ${payload.status ?? "?"}): ${
          typeof payload.body === "string"
            ? payload.body.slice(0, 200)
            : payload.error ?? JSON.stringify(payload.body ?? {}).slice(0, 200)
        }`,
      ),
      debug,
    );
  }
  return payload.body ?? {};
}

// =====================================================================
// PIX com split nativo
// =====================================================================

export async function createSplitCharge(input: SplitChargeInput): Promise<SplitChargeResult> {
  if (!isEfiProductionMode()) {
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

  // Produção — Split NATIVO da Efí (dinheiro cai já dividido nas contas dos
  // recebedores no momento da liquidação Pix).
  //
  // Fluxo Efí (3 passos):
  //   1) POST /v2/gn/split/config       → cria configuração e devolve {id}
  //   2) PUT  /v2/cob/:txid              → cria a cobrança Pix (sem split inline)
  //   3) PUT  /v2/gn/split/vinculo/cob/:txid/:idConfig → vincula split à cobrança
  //
  // Os recebedores (imobiliária / proprietário) precisam ter conta digital Efí.
  // A Efí identifica o favorecido por `conta` + CPF/CNPJ, não por chave Pix.
  const nexoKey = process.env.EFI_PIX_KEY || input.receivers.nexo.pixKey;

  // Monta os "repasses" (favorecidos diferentes da Nexo) em valor fixo.
  // Importante: o split nativo da Efí NÃO aceita chave Pix como favorecido.
  // Ele exige uma conta digital Efí (`conta`) + CPF/CNPJ dessa conta.
  const repasses: Array<{
    favorecido: { cpf?: string; cnpj?: string; conta: string };
    tipo: "fixo" | "porcentagem";
    valor: string;
  }> = [];
  if (input.receivers.agency?.pixKey && input.receivers.agency.amount > 0) {
    repasses.push({
      favorecido: buildEfiSplitFavorecido(input.receivers.agency, "imobiliária"),
      tipo: "fixo",
      valor: formatEfiMoney(input.receivers.agency.amount),
    });
  }
  if (input.receivers.owner?.pixKey && input.receivers.owner.amount > 0) {
    repasses.push({
      favorecido: buildEfiSplitFavorecido(input.receivers.owner, "proprietário"),
      tipo: "fixo",
      valor: formatEfiMoney(input.receivers.owner.amount),
    });
  }
  if (repasses.length === 0 && input.totalValue > input.receivers.nexo.amount) {
    throw new Error("Não há favorecido válido para o split nativo da Efí. Cadastre os dados de repasse do proprietário/imobiliária.");
  }

  // Nexo (recebedor principal) fica com `minhaParte`.
  const minhaParte = {
    tipo: "fixo" as const,
    valor: formatEfiMoney(input.receivers.nexo.amount),
  };

  console.info("[efi] split config payload", {
    txid: input.txid,
    total: formatEfiMoney(input.totalValue),
    minhaParte,
    repasses: repasses.map((r) => ({
      tipo: r.tipo,
      valor: r.valor,
      favorecido: {
        conta: r.favorecido.conta ? "***" : undefined,
        cpf: r.favorecido.cpf ? `${r.favorecido.cpf.slice(0, 3)}***${r.favorecido.cpf.slice(-2)}` : undefined,
        cnpj: r.favorecido.cnpj ? `${r.favorecido.cnpj.slice(0, 3)}***${r.favorecido.cnpj.slice(-2)}` : undefined,
      },
    })),
  });

  // 1) Cria a configuração de split antes da cobrança. Assim, se a Efí
  // recusar conta/documento/schema, não fica uma cobrança órfã sem split.
  let idConfig: string | null = null;
  if (repasses.length > 0) {
    const configBody = {
        descricao: `NEXO split ${input.txid}`.slice(0, 140),
        lancamento: { imediato: true },
        split: {
          divisaoTarifa: "assumir_total",
          minhaParte,
          repasses,
        },
      };
    const config = await efiFetch("pix", `/v2/gn/split/config`, {
      method: "POST",
      body: configBody,
    });
    idConfig = String(config?.id ?? config?.identificador ?? config?.split?.id ?? "");
    if (!idConfig) {
      throw new Error("Efí não devolveu id da config de split.");
    }
  }

  // 2) Cria a cobrança Pix na conta Nexo.
  const cob = await efiFetch("pix", `/v2/cob/${input.txid}`, {
    method: "PUT",
    body: {
      calendario: { expiracao: 3600 },
      valor: { original: input.totalValue.toFixed(2) },
      chave: nexoKey,
      solicitacaoPagador: input.description.slice(0, 140),
    },
  });

  // 3) Vincula a config de split à cobrança.
  if (idConfig) {
    try {
      await efiFetch("pix", `/v2/gn/split/vinculo/cob/${input.txid}/${idConfig}`, {
        method: "PUT",
      });
    } catch (splitErr: any) {
      // Mantém a cobrança viva mesmo se o vínculo falhar — operador pode
      // reprocessar via repasse D+1. Anexa contexto ao erro original.
      const debug = (splitErr as any)?.efiDebug ?? {};
      console.error("[efi] split vinculo falhou — cobrança seguirá sem split nativo", {
        txid: input.txid,
        repasses,
        minhaParte,
        debug,
      });
      throw splitErr;
    }
  }

  const locLocation = cob.loc?.location ?? cob.location;
  if (locLocation) {
    const pixPayload = buildDynamicBrCode({
      location: String(locLocation),
      amount: input.totalValue,
      merchantName: input.receivers.nexo.name || "NEXO",
      merchantCity: "SAO PAULO",
    });
    return {
      provider: "efi",
      txid: input.txid,
      pixPayload,
      qrCodeBase64: await pngBase64FromPayload(pixPayload),
    };
  }

  const locId = cob.loc?.id;
  if (!locId) throw new Error("Efí não retornou loc.location/loc.id para gerar QR Code");
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

// Consulta status de uma cobrança Pix (CONCLUIDA = paga).
export async function fetchPixCob(txid: string): Promise<any> {
  if (!isEfiProductionMode()) {
    return { status: "ATIVA", txid };
  }
  return await efiFetch("pix", `/v2/cob/${txid}`, { method: "GET" });
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
