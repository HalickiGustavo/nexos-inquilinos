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
  // Envio de PIX via chave (repasses NEXO → proprietário / imobiliária)
  "gn.pix.send.read",
  "gn.pix.send.write",
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

// Cobranças (boleto) API — endpoints diferentes do PIX, sem mTLS.
function efiCobrancasBaseUrl(): string {
  const env = (Deno.env.get("EFI_ENV") ?? "homologacao").toLowerCase();
  return env === "producao"
    ? "https://cobrancas.api.efipay.com.br"
    : "https://cobrancas-h.api.efipay.com.br";
}

// Convert base64 .p12 into a Deno HttpClient with client cert.
// Efí ships PKCS#12; Deno accepts PEM. We rely on the standard library's
// pkcs12 helper (available in Supabase Edge Runtime via std/crypto).
let _client: Deno.HttpClient | null = null;
async function getHttpClient(): Promise<Deno.HttpClient> {
  if (_client) return _client;
  const p12b64 = getEnv("EFI_CERT_P12_BASE64").replace(/\s+/g, "");
  // Usa EFI_CERT_PASSWORD quando presente; cai em vazios/nulos como fallback
  // (homologação Efí normalmente vem sem senha).
  const p12 = Uint8Array.from(atob(p12b64), (c) => c.charCodeAt(0));

  const forgeMod: any = await import("npm:node-forge");
  const forge: any = forgeMod.default ?? forgeMod;
  const p12Der = String.fromCharCode(...p12);
  const p12Asn1 = forge.asn1.fromDer(p12Der);

  const envPwd = Deno.env.get("EFI_CERT_PASSWORD");
  const passwordCandidates: Array<string | undefined | null> = [];
  if (envPwd && envPwd.length > 0) passwordCandidates.push(envPwd);
  passwordCandidates.push(undefined, "", null);

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
  const url = `${efiBaseUrl()}${path}`;
  const started = Date.now();
  const res = await fetch(url, {
    ...init,
    // @ts-ignore Deno-only
    client,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  console.log(
    `[efi-proxy] ${init.method ?? "GET"} ${path} → ${res.status} ${Date.now() - started}ms`,
  );
  return res;
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

// ---------- API Cobranças (Boleto) ----------
let _cobrancasToken: { access_token: string; exp: number } | null = null;
async function getCobrancasToken(): Promise<string> {
  if (_cobrancasToken && _cobrancasToken.exp > Date.now() + 30_000) {
    return _cobrancasToken.access_token;
  }
  const clientId = getEnv("EFI_CLIENT_ID");
  const clientSecret = getEnv("EFI_CLIENT_SECRET");
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${efiCobrancasBaseUrl()}/v1/authorize`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`cobrancas oauth ${res.status}: ${JSON.stringify(body)}`);
  _cobrancasToken = {
    access_token: body.access_token,
    exp: Date.now() + Number(body.expires_in ?? 3600) * 1000,
  };
  return _cobrancasToken.access_token;
}

async function cobrancasFetch(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const token = await getCobrancasToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("api-sdk", "nexo-lovable-1.0.0");
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const started = Date.now();
  const res = await fetch(`${efiCobrancasBaseUrl()}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  console.log(
    `[efi-proxy][cobrancas] ${init.method ?? "GET"} ${path} → ${res.status} ${Date.now() - started}ms`,
  );
  return res;
}

async function cobrancasJsonResponse(res: Response, ctx?: { action?: string; path?: string }): Promise<Response> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[efi-proxy][cobrancas] error", {
      action: ctx?.action,
      path: ctx?.path,
      status: res.status,
      body: data,
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
      case "boleto_create": {
        const { body } = payload.params ?? {};
        if (!body) return json(400, { error: "missing body" });
        const res = await cobrancasFetch(`/v1/charge/one-step`, { method: "POST", json: body });
        return cobrancasJsonResponse(res);
      }
      case "boleto_get": {
        const { chargeId } = payload.params ?? {};
        if (!chargeId) return json(400, { error: "missing chargeId" });
        const res = await cobrancasFetch(`/v1/charge/${chargeId}`, { method: "GET" });
        return cobrancasJsonResponse(res);
      }
      // Envio de PIX (repasse) — /v3/gn/pix/:idEnvio
      case "pix_send": {
        const { idEnvio, body } = payload.params ?? {};
        if (!idEnvio) return json(400, { error: "missing idEnvio" });
        const res = await efiFetch(`/v3/gn/pix/${idEnvio}`, { method: "PUT", json: body });
        return efiJsonResponse(res);
      }
      // Consulta oficial "Consultar Pix Enviado":
      //   • GET /v2/gn/pix/enviados/{e2eId}
      //   • GET /v2/gn/pix/enviados/id-envio/{idEnvio}
      // A rota /v3/gn/pix/enviados/{idEnvio} NÃO EXISTE — retorna 404.
      case "pix_send_get": {
        const { idEnvio, e2eId } = payload.params ?? {};
        if (!idEnvio && !e2eId) return json(400, { error: "missing idEnvio or e2eId" });
        // Prioriza e2eId (endpoint canônico); cai para idEnvio se necessário.
        if (e2eId) {
          const byE2E = await efiFetch(`/v2/gn/pix/enviados/${encodeURIComponent(e2eId)}`, { method: "GET" });
          if (byE2E.ok || byE2E.status !== 404) return efiJsonResponse(byE2E);
        }
        const res = await efiFetch(
          `/v2/gn/pix/enviados/id-envio/${encodeURIComponent(idEnvio)}`,
          { method: "GET" },
        );
        return efiJsonResponse(res);
      }
      // Saldo PIX — GET /v2/gn/saldo. Retorna { saldo: "0.00" }.
      case "saldo_get": {
        const res = await efiFetch(`/v2/gn/saldo`, { method: "GET" });
        return efiJsonResponse(res);
      }

      // Configuração de webhook Pix — /v2/webhook/{chave}
      case "webhook_put": {
        const { chave, body } = payload.params ?? {};
        if (!chave) return json(400, { error: "missing chave" });
        // Efí exige mTLS na URL do webhook por padrão. Como nosso callback
        // roda no Cloudflare Worker (sem cliente-cert), enviamos o header
        // `x-skip-mtls-checking: true` para desabilitar essa checagem.
        const res = await efiFetch(`/v2/webhook/${encodeURIComponent(chave)}`, {
          method: "PUT",
          headers: { "x-skip-mtls-checking": "true" },
          json: body,
        });
        return efiJsonResponse(res);
      }

      case "webhook_get": {
        const { chave } = payload.params ?? {};
        if (!chave) return json(400, { error: "missing chave" });
        const res = await efiFetch(`/v2/webhook/${encodeURIComponent(chave)}`, { method: "GET" });
        return efiJsonResponse(res);
      }
      default:
        return json(400, { error: `unknown action: ${payload.action}` });
    }
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
