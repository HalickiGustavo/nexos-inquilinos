// Webhook Efí Bank (Pix recebido).
//
// A Efí exige que a URL do webhook aceite um query param `?hmac=<segredo>`
// como validação simples (documentado em https://dev.efipay.com.br/docs/api-pix/webhooks).
// Validamos com timing-safe comparação e persistimos o evento cru em
// `efi_events` para auditoria/reprocessamento. A confirmação de pagamento
// da parcela é feita em passo seguinte (Fase 1.1 — reconciler).
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/efi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const provided = url.searchParams.get("hmac") ?? "";
        const expected = process.env.EFI_WEBHOOK_HMAC_SECRET ?? "";
        if (!expected) {
          return new Response("webhook not configured", { status: 503 });
        }
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("unauthorized", { status: 401 });
        }

        let payload: unknown = null;
        try {
          payload = await request.json();
        } catch {
          // Efí envia { pix: [...] } — se falhar parse, ainda respondemos 200
          // para não gerar retries infinitos (Efí ~10 min ~5x).
          return new Response("ok", { status: 200 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("efi_events" as any).insert({
            event_type: "pix",
            payload: payload as any,
            received_at: new Date().toISOString(),
          } as any);
        } catch (e) {
          console.error("[efi-webhook] persist error", e);
        }

        // Sempre 200 para evitar retries agressivos; processamento assíncrono.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
