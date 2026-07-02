import { timingSafeEqual } from "node:crypto";

/**
 * Valida o header Authorization: Bearer <CRON_SECRET> em rotas de cron/admin.
 * Retorna null se ok, ou uma Response 401/500 pronta para retornar do handler.
 * Comparação em tempo constante para não vazar bytes do secret.
 */
export function requireCronAuth(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("Server misconfigured: CRON_SECRET not set", { status: 500 });
  }
  const header =
    request.headers.get("authorization") ??
    request.headers.get("Authorization") ??
    "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = provided ? Buffer.from(provided) : null;
  const b = Buffer.from(expected);
  const ok = !!a && a.length === b.length && timingSafeEqual(a, b);
  if (!ok) return new Response("Unauthorized", { status: 401 });
  return null;
}
