import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

// Cron-triggered hook: emite Just-In-Time as cobranças `agendado` cujo
// vencimento está dentro do horizonte (default 15 dias).
//
// Autenticação: exige `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
// O service role key é estritamente server-only (nunca é exposto ao bundle
// do cliente como VITE_*), portanto serve como segredo compartilhado entre
// o pg_cron (executado dentro do banco) e este endpoint público.
export const Route = createFileRoute("/api/public/hooks/process-scheduled-invoices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const header = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
        const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
        const a = provided ? Buffer.from(provided) : null;
        const b = expected ? Buffer.from(expected) : null;
        const ok = !!a && !!b && a.length === b.length && timingSafeEqual(a, b);
        if (!ok) return new Response("Unauthorized", { status: 401 });

        try {
          const { runProcessScheduledInvoices } = await import("@/lib/asaas.functions");
          const result = await runProcessScheduledInvoices();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[process-scheduled-invoices] erro:", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
