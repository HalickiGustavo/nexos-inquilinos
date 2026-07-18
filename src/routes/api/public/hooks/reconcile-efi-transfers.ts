import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

// Worker cron dedicado: consulta o endpoint oficial da Efí
// GET /v3/gn/pix/enviados/{idEnvio} ("Consultar Pix Enviado") para todas as
// transferências em status PROCESSING, aplica backoff exponencial e finaliza
// (COMPLETED / FAILED) conforme o estado retornado.
export const Route = createFileRoute("/api/public/hooks/reconcile-efi-transfers")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;

        if (!process.env.EFI_PROXY_URL || !process.env.EFI_PROXY_SECRET) {
          return Response.json({ ok: false, skipped: "efi not configured" });
        }

        try {
          const { reconcileEfiTransfers } = await import(
            "@/lib/efi/transfer-status-worker.server"
          );
          const result = await reconcileEfiTransfers();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[reconcile-efi-transfers] error", e);
          return Response.json(
            { ok: false, error: e?.message ?? String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
