import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

// Cron diário (D+1): transfere via PIX o valor líquido de cada parcela paga
// para o proprietário, já descontadas a taxa NEXO e o repasse da imobiliária.
// Autenticação por CRON_SECRET (Bearer).
export const Route = createFileRoute("/api/public/hooks/process-landlord-payouts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const header = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
        const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
        const a = provided ? Buffer.from(provided) : null;
        const b = expected ? Buffer.from(expected) : null;
        const ok = !!a && !!b && a.length === b.length && timingSafeEqual(a, b);
        if (!ok) return new Response("Unauthorized", { status: 401 });

        try {
          const { runProcessLandlordPayouts } = await import("@/lib/landlord-payouts.functions");
          const result = await runProcessLandlordPayouts();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[process-landlord-payouts] erro:", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
