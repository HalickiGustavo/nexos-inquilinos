import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

// Worker cron: drena payment_transfers PENDING e envia PIX.
// Prioriza Efí quando EFI_PIX_KEY está configurada; cai em Stark como legado.
export const Route = createFileRoute("/api/public/hooks/process-payout-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;

        try {
          if (process.env.EFI_PIX_KEY && process.env.EFI_PROXY_URL) {
            const { runEfiPayoutWorker, reconcileEfiPayouts } = await import(
              "@/lib/efi/payout-worker.server"
            );
            const r = await runEfiPayoutWorker();
            await reconcileEfiPayouts().catch(() => {});
            return Response.json({ ok: true, provider: "efi", ...r });
          }
          const { runPayoutWorker, reconcileProcessing } = await import(
            "@/lib/stark/worker.server"
          );
          const r = await runPayoutWorker();
          await reconcileProcessing().catch(() => {});
          return Response.json({ ok: true, provider: "stark", ...r });
        } catch (e: any) {
          console.error("[payout-worker] error", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
