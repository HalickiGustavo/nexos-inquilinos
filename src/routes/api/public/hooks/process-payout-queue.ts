import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

// Worker cron: drena payment_transfers PENDING e envia PIX via Stark.
export const Route = createFileRoute("/api/public/hooks/process-payout-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;

        try {
          const { runPayoutWorker, reconcileProcessing } = await import("@/lib/stark/worker.server");
          const r = await runPayoutWorker();
          await reconcileProcessing().catch(() => {});
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          console.error("[payout-worker] error", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
