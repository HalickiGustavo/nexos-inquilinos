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

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // opportunistic sweep to keep the map bounded
    if (buckets.size > MAX_KEYS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    const b = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(key, b);
    return { ok: true, remaining: opts.limit - 1, resetAt: b.resetAt, retryAfterSec: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, opts.limit - existing.count);
  const ok = existing.count <= opts.limit;
  return {
    ok,
    remaining,
    resetAt: existing.resetAt,
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function clientIpFromRequest(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    (h.get("x-forwarded-for") ?? "").split(",")[0].trim() ??
    "unknown"
  );
}
