import { createFileRoute } from "@tanstack/react-router";

// Cron diário: processa repasses Pix D+1 para boletos Efí pagos.
// Autenticado via apikey (Supabase anon key) — padrão de cron deste projeto.
export const Route = createFileRoute("/api/public/hooks/process-efi-payouts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("x-cron-secret") ??
          (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null);
        const candidates = [
          process.env.SUPABASE_ANON_KEY,
          process.env.SUPABASE_PUBLISHABLE_KEY,
          process.env.CRON_SECRET,
        ].filter(Boolean) as string[];
        if (!provided || !candidates.includes(provided)) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { runProcessEfiBoletoPayouts } = await import("@/lib/efi-payouts.server");
          const result = await runProcessEfiBoletoPayouts();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[process-efi-payouts] erro:", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
