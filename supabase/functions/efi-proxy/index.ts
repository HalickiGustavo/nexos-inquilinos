// Efí Bank mTLS proxy (Deno edge function).
//
// Runs on Supabase Edge Runtime, where Deno.createHttpClient({ cert, key })
// enables the client-certificate handshake that Cloudflare Workers cannot
// perform. The NEXO backend (Worker) calls this proxy with a shared secret
// and forwards signed calls to the Efí API (homologação/produção).
//
// Phase 1 actions:
//   - oauth_token       → POST /oauth/token (client_credentials)
//   - cob_create        → PUT  /v2/cob/{txid}
//   - cob_get           → GET  /v2/cob/{txid}
//   - qrcode_get        → GET  /v2/loc/{locId}/qrcode
//
// Auth: the caller MUST send `x-efi-proxy-secret: <EFI_PROXY_SECRET>`.
// Certificates: the .p12 (base64) + password are held ONLY inside this
// function's env — never exposed to the Worker or the browser.

// deno-lint-ignore-file no-explicit-any

const REQUIRED_ENV = [
  "EFI_CLIENT_ID",
  "EFI_CLIENT_SECRET",
  "EFI_CERT_P12_BASE64",
  "EFI_PROXY_SECRET",
] as const;

const EFI_PIX_SCOPES = [
  "cob.read",
  "cob.write",
  "pix.read",
  "pix.write",
  "webhook.read",
  "webhook.write",
].join(" ");

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function efiBaseUrl(): string {
  const env = (Deno.env.get("EFI_ENV") ?? "homologacao").toLowerCase();
  return env === "producao"
    ? "https://pix.api.efipay.com.br"
    : "https://pix-h.api.efipay.com.br";
}

// Convert base64 .p12 into a Deno HttpClient with client cert.
// Efí ships PKCS#12; Deno accepts PEM. We rely on the standard library's
// pkcs12 helper (available in Supabase Edge Runtime via std/crypto).
let _client: Deno.HttpClient | null = null;
async function getHttpClient(): Promise<Deno.HttpClient> {
  if (_client) return _client;
  const p12b64 = getEnv("EFI_CERT_P12_BASE64").replace(/\s+/g, "");
  // Homologação Efí: certificado SEM senha. Ignoramos EFI_CERT_PASSWORD e
  // tentamos todos os formatos aceitos por node-forge (undefined / "" / null)
  // até um deles decodificar o PKCS#12.
  const p12 = Uint8Array.from(atob(p12b64), (c) => c.charCodeAt(0));

  const forgeMod: any = await import("npm:node-forge");
  const forge: any = forgeMod.default ?? forgeMod;
  const p12Der = String.fromCharCode(...p12);
  const p12Asn1 = forge.asn1.fromDer(p12Der);

  const passwordCandidates: Array<string | undefined | null> = [undefined, "", null];
  let p12Obj: any = null;
  let lastErr: unknown = null;
  for (const pwd of passwordCandidates) {
    try {
      p12Obj = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pwd as any);
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!p12Obj) throw lastErr ?? new Error("failed to decode PKCS#12");

  let certPem = "";
  let keyPem = "";
  for (const safeContents of p12Obj.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.cert && !certPem) {
        certPem = forge.pki.certificateToPem(safeBag.cert);
      }
      if (safeBag.key && !keyPem) {
        keyPem = forge.pki.privateKeyToPem(safeBag.key);
      }
    }
  }
  if (!certPem || !keyPem) throw new Error("failed to extract cert/key from p12");

  _client = Deno.createHttpClient({ cert: certPem, key: keyPem });
  return _client;
}

let _token: { access_token: string; exp: number } | null = null;
async function getAccessToken(): Promise<string> {
  if (_token && _token.exp > Date.now() + 30_000) return _token.access_token;
  const client = await getHttpClient();
  const clientId = getEnv("EFI_CLIENT_ID");
  const clientSecret = getEnv("EFI_CLIENT_SECRET");
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${efiBaseUrl()}/oauth/token`, {
    method: "POST",
    // @ts-ignore Deno-only fetch option
    client,
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials", scope: EFI_PIX_SCOPES }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`oauth failed ${res.status}: ${JSON.stringify(body)}`);
  _token = {
    access_token: body.access_token,
    exp: Date.now() + Number(body.expires_in ?? 3600) * 1000,
  };
  return _token.access_token;
}

async function efiFetch(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const client = await getHttpClient();
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  return fetch(`${efiBaseUrl()}${path}`, {
    ...init,
    // @ts-ignore Deno-only
    client,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
}

async function efiJsonResponse(res: Response): Promise<Response> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok && data?.error === "insufficient_scope") {
    return json(res.status, {
      ...data,
      message:
        "A aplicação Efí não possui escopo suficiente para PIX. Habilite cob.write/cob.read na aplicação que gerou estas credenciais.",
      requestedScopes: EFI_PIX_SCOPES,
    });
  }
  return json(res.status, data);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const secret = req.headers.get("x-efi-proxy-secret");
  if (!secret || secret !== Deno.env.get("EFI_PROXY_SECRET")) {
    return json(401, { error: "unauthorized" });
  }

  // Report config status without touching Efí.
  const missing = REQUIRED_ENV.filter((k) => !Deno.env.get(k));
  const payload = (await req.json().catch(() => ({}))) as {
    action?: string;
    params?: any;
  };
  if (payload.action === "healthcheck") {
    return json(200, { ok: missing.length === 0, missing });
  }
  if (missing.length) return json(503, { error: "efi not configured", missing });

  try {
    switch (payload.action) {
      case "oauth_token": {
        const token = await getAccessToken();
        return json(200, { access_token: token });
      }
      case "cob_create": {
        const { txid, body } = payload.params ?? {};
        if (!txid) return json(400, { error: "missing txid" });
        const res = await efiFetch(`/v2/cob/${txid}`, { method: "PUT", json: body });
        return efiJsonResponse(res);
      }
      case "cob_get": {
        const { txid } = payload.params ?? {};
        if (!txid) return json(400, { error: "missing txid" });
        const res = await efiFetch(`/v2/cob/${txid}`, { method: "GET" });
        return efiJsonResponse(res);
      }
      case "qrcode_get": {
        const { locId } = payload.params ?? {};
        if (!locId) return json(400, { error: "missing locId" });
        const res = await efiFetch(`/v2/loc/${locId}/qrcode`, { method: "GET" });
        return efiJsonResponse(res);
      }
      default:
        return json(400, { error: `unknown action: ${payload.action}` });
    }
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
