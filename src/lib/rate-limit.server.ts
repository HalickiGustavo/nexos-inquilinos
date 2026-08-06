// Ad-hoc in-memory sliding-window rate limiter for public webhooks.
// NOTE: state is per Worker isolate (not global). Good enough to blunt bursts
// and repeated abuse from a single IP; NOT a substitute for a real limiter.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const MAX_KEYS = 5000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
};

/**
 * Rate limiter in-memory para mitigação básica de abusos em endpoints públicos.
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // opportunistic sweep to keep the map bounded
    if (buckets.size > MAX_KEYS) {
      // Deleta chaves expiradas
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }
    const b = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(key, b);
    return { ok: true, remaining: opts.limit - 1, resetAt: b.resetAt, retryAfterSec: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, opts.limit - existing.count);
  const ok = existing.count <= opts.limit;
  
  // Se exceder o limite, não reseta o resetAt para evitar lock perpétuo
  return {
    ok,
    remaining,
    resetAt: existing.resetAt,
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Extrai o IP do cliente de forma segura, priorizando headers de proxy confiáveis.
 */
export function clientIpFromRequest(request: Request): string {
  const h = request.headers;
  // CF-Connecting-IP é injetado pelo Cloudflare e é confiável se o worker estiver atrás do CF
  const cfIp = h.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  const xRealIp = h.get("x-real-ip");
  if (xRealIp) return xRealIp;

  const xForwardedFor = h.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  return "unknown";
}
