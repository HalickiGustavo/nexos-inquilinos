import { createFileRoute } from "@tanstack/react-router";

// Endpoint auxiliar (chamada manual pelo admin) — cria/atualiza a webhook
// subscription na conta Stark apontando para /api/public/stark-webhook.
// Docs oficiais: POST /webhook body { webhook: { url, subscriptions } }
// Assinaturas usadas pelo Nexo: invoice (PIX reconciliado), boleto, transfer.
export const Route = createFileRoute("/api/public/hooks/register-stark-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-admin-token");
        if (!token || token !== process.env.STARK_WEBHOOK_SECRET) {
          return new Response("unauthorized", { status: 401 });
        }
        try {
          const { starkFetch } = await import("@/lib/stark/stark.server");
          const url = "https://nexos-inquilinos.lovable.app/api/public/stark-webhook";
          const subscriptions = ["invoice", "boleto", "transfer"];
          const res = await starkFetch({
            method: "POST",
            path: "/webhook",
            body: { webhook: { url, subscriptions } },
          });
          return Response.json({ ok: true, webhook: res });
        } catch (e: any) {
          return Response.json(
            { ok: false, error: e?.message ?? String(e), body: e?.body ?? null },
            { status: 500 },
          );
        }
      },
    },
  },
});
