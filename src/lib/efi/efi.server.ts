// Worker-side client for the Efí Bank integration.
//
// The Cloudflare Worker runtime does NOT support mTLS client-cert fetch,
// so all Efí calls are proxied through the `efi-proxy` Supabase Edge
// Function (Deno), which owns the .p12 certificate and the client_credentials
// flow. This module only knows the proxy URL + a shared secret.
//
// SERVER-ONLY — never import from client/route code at module scope.

export function isEfiConfigured(): boolean {
  return !!(process.env.EFI_PROXY_URL && process.env.EFI_PROXY_SECRET);
}

export function efiEnv(): "homologacao" | "producao" {
  return (process.env.EFI_ENV ?? "homologacao").toLowerCase() === "producao"
    ? "producao"
    : "homologacao";
}

type ProxyAction =
  | "healthcheck"
  | "oauth_token"
  | "cob_create"
  | "cob_get"
  | "qrcode_get"
  | "boleto_create"
  | "boleto_get";

export type EfiProxyError = {
  status: number;
  body: unknown;
  message: string;
};

async function callProxy<T = unknown>(action: ProxyAction, params?: unknown): Promise<T> {
  const url = process.env.EFI_PROXY_URL;
  const secret = process.env.EFI_PROXY_SECRET;
  if (!url || !secret) {
    throw new Error(
      "Efí não configurado. Faltam EFI_PROXY_URL / EFI_PROXY_SECRET (Fase 1: aguardando credenciais).",
    );
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-efi-proxy-secret": secret,
    },
    body: JSON.stringify({ action, params }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Efí Cobranças errors: { code, error, error_description }
    // Also may include { error: {...nested...} } from proxy; stringify to expose
    // whatever detail the API returned.
    const detail =
      body?.error_description ||
      (typeof body?.error === "string" ? body.error : null) ||
      (body?.mensagem ? `${body?.nome ?? "efi"}: ${body.mensagem}` : null) ||
      JSON.stringify(body);
    const err: EfiProxyError = {
      status: res.status,
      body,
      message: `efi-proxy ${action} failed (${res.status}) ${detail}`,
    };
    console.error("[efi-proxy]", action, res.status, body);
    throw Object.assign(new Error(err.message), err);
  }
  return body as T;
}

export async function efiHealthcheck() {
  return callProxy<{ ok: boolean; missing: string[] }>("healthcheck");
}

// Efí PIX cobrança imediata — https://dev.efipay.com.br/docs/api-pix/cob
export type EfiCobRequest = {
  calendario: { expiracao: number }; // seconds
  devedor: { cpf?: string; cnpj?: string; nome: string };
  valor: { original: string }; // "123.45"
  chave: string; // NEXO Pix key at Efí
  solicitacaoPagador?: string;
  infoAdicionais?: Array<{ nome: string; valor: string }>;
};

export type EfiCobResponse = {
  txid: string;
  revisao?: number;
  loc?: { id: number; location: string; tipoCob: string };
  location?: string;
  status: "ATIVA" | "CONCLUIDA" | "REMOVIDA_PELO_USUARIO_RECEBEDOR" | "REMOVIDA_PELO_PSP";
  pixCopiaECola?: string;
  [k: string]: unknown;
};

export async function efiCobCreate(txid: string, body: EfiCobRequest): Promise<EfiCobResponse> {
  return callProxy<EfiCobResponse>("cob_create", { txid, body });
}

export async function efiCobGet(txid: string): Promise<EfiCobResponse> {
  return callProxy<EfiCobResponse>("cob_get", { txid });
}

export async function efiQrCodeGet(locId: number | string): Promise<{
  qrcode: string;      // BR Code payload (copia e cola)
  imagemQrcode: string; // data:image/png;base64,...
  linkVisualizacao?: string;
}> {
  return callProxy("qrcode_get", { locId });
}

// ---------- Boleto (API Cobranças) ----------
export type EfiBoletoRequest = {
  items: Array<{ name: string; value: number; amount: number }>; // value em centavos
  payment: {
    banking_billet: {
      expire_at: string; // YYYY-MM-DD
      message?: string;
      customer: {
        name: string;
        cpf?: string;
        juridical_person?: { corporate_name: string; cnpj: string };
        phone_number?: string;
        email?: string;
      };
      fine?: number;      // % *100 (ex: 200 = 2%)
      interest?: number;  // % *100 ao mês
    };
  };
};

export type EfiBoletoResponse = {
  code: number;
  data: {
    charge_id: number;
    status: string;
    total: number;
    payment: string;
    barcode: string;
    pix?: { qrcode: string; qrcode_image: string };
    link: string;      // URL pública do boleto (HTML)
    pdf: { charge: string }; // URL pública do PDF
    expire_at: string;
  };
};

export async function efiBoletoCreate(body: EfiBoletoRequest): Promise<EfiBoletoResponse> {
  return callProxy<EfiBoletoResponse>("boleto_create", { body });
}

export async function efiBoletoGet(chargeId: number | string): Promise<EfiBoletoResponse> {
  return callProxy<EfiBoletoResponse>("boleto_get", { chargeId });
}
