import { createFileRoute } from "@tanstack/react-router";

// Worker cron: drena payment_transfers PENDING e envia PIX via Stark.
export const Route = createFileRoute("/api/public/hooks/process-payout-queue")({
  server: {
    handlers: {
      POST: async () => {
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
