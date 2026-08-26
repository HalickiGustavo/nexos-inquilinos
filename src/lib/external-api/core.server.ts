// Camada central da API Externa da NEXO.
// Responsável por: validação de API Key, permissões, rate limit, logs e respostas padronizadas.
import { rateLimit } from "@/lib/rate-limit.server";

export const EXTERNAL_API_PREFIX = "nexo_live_";

export type ApiKeyRecord = {
  id: string;
  name: string;
  permissions: string[];
  active: boolean;
  expires_at: string | null;
  allowed_ips: string[] | null;
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function ok(data: unknown, extra?: Record<string, unknown>) {
  return jsonResponse({ success: true, data, ...(extra ?? {}) });
}

export function fail(error: string, status: number, details?: unknown) {
  return jsonResponse({ success: false, error, ...(details ? { details } : {}) }, status);
}

/** Gera uma chave criptograficamente segura no padrão nexo_live_<hex32>. */
export function generateApiKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${EXTERNAL_API_PREFIX}${hex}`;
}

/** SHA-256 hex — a chave original nunca é persistida. */
export async function hashApiKey(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function keyPrefixOf(raw: string): string {
  return raw.slice(0, EXTERNAL_API_PREFIX.length + 4);
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export type AuthResult =
  | { okAuth: true; key: ApiKeyRecord; ip: string }
  | { okAuth: false; response: Response };

/**
 * Middleware centralizado: valida formato, hash, status, expiração, IP, permissão e rate limit.
 */
export async function validateExternalApiKey(
  request: Request,
  requiredPermission: string,
): Promise<AuthResult> {
  const ip = clientIp(request);

  if (process.env["NEXO_EXTERNAL_API_ENABLED"] === "false") {
    return { okAuth: false, response: fail("External API disabled", 403) };
  }

  const header =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!header.startsWith(EXTERNAL_API_PREFIX) || header.length < EXTERNAL_API_PREFIX.length + 16) {
    return { okAuth: false, response: fail("Unauthorized", 401) };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await hashApiKey(header);

  const { data, error } = await (supabaseAdmin as any)
    .from("external_api_keys")
    .select("id, name, permissions, active, expires_at, allowed_ips")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error) {
    console.error("[external-api] key lookup failed", error.message);
    return { okAuth: false, response: fail("Internal Server Error", 500) };
  }
  if (!data) return { okAuth: false, response: fail("Unauthorized", 401) };

  const key = data as ApiKeyRecord;

  if (!key.active) return { okAuth: false, response: fail("Forbidden", 403) };
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return { okAuth: false, response: fail("Unauthorized", 401) };
  }
  if (key.allowed_ips?.length && !key.allowed_ips.includes(ip)) {
    return { okAuth: false, response: fail("Forbidden", 403) };
  }
  if (!key.permissions?.includes(requiredPermission)) {
    return { okAuth: false, response: fail("Forbidden", 403) };
  }

  const limit = Number(process.env["NEXO_EXTERNAL_API_RATE_LIMIT"] ?? 300);
  const rl = rateLimit(`extapi:${key.id}`, { limit, windowMs: 60_000 });
  if (!rl.ok) {
    return { okAuth: false, response: fail("Rate limit exceeded", 429) };
  }

  return { okAuth: true, key, ip };
}

/** Registra o uso da chave e a chamada (nunca guarda a API Key completa). */
export async function logExternalRequest(params: {
  apiKeyId: string | null;
  method: string;
  endpoint: string;
  status: number;
  startedAt: number;
  ip: string;
}) {
  if (process.env["NEXO_EXTERNAL_API_LOG_REQUESTS"] === "false") return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("external_api_logs").insert({
      api_key_id: params.apiKeyId,
      method: params.method,
      endpoint: params.endpoint,
      status_code: params.status,
      response_time_ms: Math.max(0, Math.round(Date.now() - params.startedAt)),
      ip: params.ip,
    });
    if (params.apiKeyId) {
      await (supabaseAdmin as any)
        .from("external_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", params.apiKeyId);
    }
  } catch (e: any) {
    console.error("[external-api] log failed", e?.message);
  }
}

/**
 * Wrapper que aplica autenticação + log em um handler de rota externa.
 */
export async function handleExternal(
  request: Request,
  permission: string,
  handler: (ctx: { key: ApiKeyRecord; url: URL }) => Promise<Response>,
): Promise<Response> {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const auth = await validateExternalApiKey(request, permission);

  if (!auth.okAuth) {
    await logExternalRequest({
      apiKeyId: null,
      method: request.method,
      endpoint: url.pathname,
      status: auth.response.status,
      startedAt,
      ip: clientIp(request),
    });
    return auth.response;
  }

  let response: Response;
  try {
    response = await handler({ key: auth.key, url });
  } catch (e: any) {
    console.error("[external-api] request failed", url.pathname, e?.message);
    response = fail("Internal Server Error", 500);
  }

  await logExternalRequest({
    apiKeyId: auth.key.id,
    method: request.method,
    endpoint: url.pathname,
    status: response.status,
    startedAt,
    ip: auth.ip,
  });
  return response;
}
