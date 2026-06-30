// Edge Function: proxy mTLS para a Efí Pay.
// Por que existe: o runtime Worker da Lovable (TanStack Start) não implementa
// `ALPNProtocols` no módulo TLS, o que impede a autenticação mTLS exigida pela
// Efí. Deno (Supabase Edge Functions) suporta mTLS nativo via
// `Deno.createHttpClient({ cert, key })`.
//
// Contrato:
//   POST { api: "pix"|"boleto", path: string, method: string, body?: any }
//   ->   { ok: boolean, status: number, body: any, debug?: any }
//
// O proxy gerencia seu próprio cache de token OAuth in-memory (TTL ~50min).
// O caller (src/lib/efi.server.ts) só lida com a resposta de negócio.

// @ts-ignore - esm.sh resolve em runtime Deno
import forge from "https://esm.sh/node-forge@1.3.1";

type Api = "pix" | "boleto";

const EFI_ENV = (Deno.env.get("EFI_ENV") || "production").toLowerCase();
const CLIENT_ID = Deno.env.get("EFI_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("EFI_CLIENT_SECRET") || "";
const CERT_B64 = Deno.env.get("EFI_CERTIFICATE_BASE64") || "";
// Efí gera P12 SEM senha por padrão — sempre passamos string vazia.
const CERT_PASS = "";

function baseUrl(api: Api): string {
  if (api === "pix") {
    return EFI_ENV === "sandbox"
      ? "https://pix-h.api.efipay.com.br"
      : "https://pix.api.efipay.com.br";
  }
  // API Cobranças (boleto). NÃO inclui /v1 no base; o caller passa o path
  // completo (`/v1/charge/one-step`, etc).
  return EFI_ENV === "sandbox"
    ? "https://cobrancas-h.api.efipay.com.br"
    : "https://cobrancas.api.efipay.com.br";
}

// Endpoint OAuth diverge por API: Pix usa /oauth/token, Cobranças usa /v1/authorize.
function oauthPath(api: Api): string {
  return api === "pix" ? "/oauth/token" : "/v1/authorize";
}

// ---------------------------------------------------------------------------
// Conversão PKCS12 -> PEM (cert + key) executada apenas no cold-start.
// ---------------------------------------------------------------------------

let pemPair: { cert: string; key: string } | null = null;
let pemError: string | null = null;

function loadPem(): { cert: string; key: string } {
  if (pemPair) return pemPair;
  if (pemError) throw new Error(pemError);
  if (!CERT_B64) {
    pemError = "EFI_CERTIFICATE_BASE64 não configurada na edge function.";
    throw new Error(pemError);
  }
  try {
    const der = forge.util.decode64(CERT_B64);
    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, CERT_PASS);

    let certPem = "";
    let keyPem = "";
    for (const sc of p12.safeContents) {
      for (const bag of sc.safeBags) {
        if (bag.type === forge.pki.oids.certBag && bag.cert) {
          certPem += forge.pki.certificateToPem(bag.cert);
        } else if (
          (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag ||
            bag.type === forge.pki.oids.keyBag) &&
          bag.key
        ) {
          keyPem += forge.pki.privateKeyToPem(bag.key);
        }
      }
    }
    if (!certPem || !keyPem) {
      pemError = "P12 não contém certificado/chave reconhecíveis.";
      throw new Error(pemError);
    }
    pemPair = { cert: certPem, key: keyPem };
    return pemPair;
  } catch (e) {
    pemError = `Falha ao processar EFI_CERTIFICATE_BASE64: ${(e as Error).message}`;
    throw new Error(pemError);
  }
}

let cachedClient: Deno.HttpClient | null = null;
function getHttpClient(): Deno.HttpClient {
  if (cachedClient) return cachedClient;
  const { cert, key } = loadPem();
  // @ts-ignore - createHttpClient existe em Deno Deploy/Supabase Edge
  cachedClient = Deno.createHttpClient({ cert, key });
  return cachedClient!;
}

// ---------------------------------------------------------------------------
// OAuth token cache
// ---------------------------------------------------------------------------

const tokenCache = new Map<Api, { value: string; expiresAt: number }>();

async function getToken(api: Api): Promise<string> {
  const now = Date.now();
  const c = tokenCache.get(api);
  if (c && c.expiresAt > now + 60_000) return c.value;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("EFI_CLIENT_ID/EFI_CLIENT_SECRET não configurados na edge function.");
  }
  const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  // mTLS é obrigatório no Pix; a API Cobranças (boleto) usa apenas Basic Auth.
  const client = api === "pix" ? getHttpClient() : null;
  const scope =
    api === "pix"
      ? [
          "cob.write",
          "cob.read",
          "cobv.write",
          "cobv.read",
          "pix.write",
          "pix.read",
          "pix.send",
          "loterias.read",
          "webhook.write",
          "webhook.read",
          "location.write",
          "location.read",
          "gn.balance.read",
          "gn.settings.write",
          "gn.settings.read",
          "gn.split.write",
          "gn.split.read",
        ].join(" ")
      : "";
  const res = await fetch(`${baseUrl(api)}${oauthPath(api)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basic}`,
    },
    body: JSON.stringify(scope ? { grant_type: "client_credentials", scope } : { grant_type: "client_credentials" }),
    // @ts-ignore - Deno fetch aceita client
    ...(client ? { client } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OAuth Efí ${api} falhou (${res.status}): ${text.slice(0, 400)}`);
  }
  const data = JSON.parse(text);
  tokenCache.set(api, {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  });
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Handler HTTP
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let payload: { api?: Api; path?: string; method?: string; body?: unknown; headers?: Record<string, string> };
  try {
    payload = await req.json();
  } catch {
    return Response.json(
      { ok: false, status: 400, error: "JSON inválido" },
      { status: 200, headers: corsHeaders },
    );
  }

  const { api, method = "GET", body, headers: extraHeaders } = payload;
  let path = payload.path;
  // Substitui $EFI_PIX_KEY no path pela chave configurada no env do proxy.
  if (path && path.includes("$EFI_PIX_KEY")) {
    const k = Deno.env.get("EFI_PIX_KEY") || "";
    if (!k) {
      return Response.json(
        { ok: false, status: 500, error: "EFI_PIX_KEY ausente no proxy." },
        { status: 200, headers: corsHeaders },
      );
    }
    path = path.replaceAll("$EFI_PIX_KEY", encodeURIComponent(k));
  }
  if (!api || (api !== "pix" && api !== "boleto") || !path) {
    return Response.json(
      { ok: false, status: 400, error: "Parâmetros api/path obrigatórios." },
      { status: 200, headers: corsHeaders },
    );
  }

  try {
    const token = await getToken(api);
    const client = api === "pix" ? getHttpClient() : null;
    const url = `${baseUrl(api)}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(extraHeaders ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      // @ts-ignore - Deno
      ...(client ? { client } : {}),
    });
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return Response.json(
      { ok: res.ok, status: res.status, body: parsed },
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    const err = e as Error;
    console.error("[efi-pix-proxy]", err.message);
    return Response.json(
      {
        ok: false,
        status: 0,
        error: err.message,
        runtime: {
          env: EFI_ENV,
          hasClientId: !!CLIENT_ID,
          hasClientSecret: !!CLIENT_SECRET,
          hasCertificate: !!CERT_B64,
          hasPassphrase: !!CERT_PASS,
        },
      },
      { status: 200, headers: corsHeaders },
    );
  }
});
