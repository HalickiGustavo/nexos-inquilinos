import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

// Cron-triggered hook: emite Just-In-Time as cobranças `agendado` cujo
// vencimento está dentro do horizonte (default 15 dias). Autenticação via
// header `apikey` com o anon key do projeto (mesmo padrão usado pelos demais
// jobs pg_cron desta plataforma).
export const Route = createFileRoute("/api/public/hooks/process-scheduled-invoices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") ?? request.headers.get("Apikey");
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
