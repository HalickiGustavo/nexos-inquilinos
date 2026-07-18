import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

// Cron cover para o webhook Efí: varre cobranças em aberto e confirma
// pagamentos que possam ter escapado. Também dispara reconciliação
// das transferências PIX enviadas que ainda estão EM_PROCESSAMENTO.
export const Route = createFileRoute("/api/public/hooks/reconcile-efi-charges")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;

        if (!process.env.EFI_PIX_KEY || !process.env.EFI_PROXY_URL) {
          return Response.json({ ok: false, skipped: "efi not configured" });
        }

        try {
          const { reconcileEfiCharges } = await import("@/lib/efi/reconcile.server");
          const { reconcileEfiPayouts } = await import("@/lib/efi/payout-worker.server");
          const charges = await reconcileEfiCharges();
          await reconcileEfiPayouts().catch((e) =>
            console.warn("[reconcile-efi] payouts reconcile failed", e?.message),
          );
          return Response.json({ ok: true, ...charges });
        } catch (e: any) {
          console.error("[reconcile-efi] error", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
