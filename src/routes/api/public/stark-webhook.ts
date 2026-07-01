import { createFileRoute } from "@tanstack/react-router";

// Recebe eventos da Stark Bank. Valida assinatura ECDSA, persiste evento e
// dispara orquestração assíncrona. Nunca envia PIX aqui.
export const Route = createFileRoute("/api/public/stark-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature =
          request.headers.get("Digital-Signature") ??
          request.headers.get("digital-signature") ??
          request.headers.get("X-Digital-Signature");

        try {
          const { handleStarkWebhook } = await import("@/lib/stark/webhook.server");
          const r = await handleStarkWebhook(raw, signature);
          if (!r.ok) return new Response(r.error ?? "error", { status: r.status ?? 500 });
          return Response.json({ ok: true });
        } catch (e: any) {
          console.error("[stark-webhook] fatal", e);
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, service: "stark-webhook" }),
    },
  },
});
