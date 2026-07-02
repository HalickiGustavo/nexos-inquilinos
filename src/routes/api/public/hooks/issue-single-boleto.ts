// Endpoint de teste: emite boleto para UMA parcela específica.
// Uso interno — não é chamado por cron.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/issue-single-boleto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const installmentId: string | undefined = body?.installment_id;
          if (!installmentId) {
            return Response.json({ ok: false, error: "installment_id obrigatório" }, { status: 400 });
          }
          const { issueBoletoForInstallment } = await import("@/lib/stark/boleto-issuer.server");
          const r = await issueBoletoForInstallment(installmentId);
          return Response.json(r);
        } catch (e: any) {
          console.error("[issue-single-boleto] error", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
