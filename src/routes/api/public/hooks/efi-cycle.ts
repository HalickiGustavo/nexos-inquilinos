import { createFileRoute } from "@tanstack/react-router";

// Cron unificado do ciclo Efí: varre cobranças pagas, gera boletos D-15 e
// processa repasses D+1. Autenticado via apikey (Supabase anon key).
export const Route = createFileRoute("/api/public/hooks/efi-cycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_ANON_KEY;
        const provided = request.headers.get("apikey");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runSweepPaidEfiCharges, runAutoGenerateBoletos } = await import("@/lib/efi-sweep.server");
          const { runProcessEfiBoletoPayouts } = await import("@/lib/efi-payouts.server");
          const sweep = await runSweepPaidEfiCharges();
          const boletos = await runAutoGenerateBoletos();
          const payouts = await runProcessEfiBoletoPayouts();
          return Response.json({ ok: true, sweep, boletos, payouts });
        } catch (e: any) {
          console.error("[efi-cycle] erro:", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
