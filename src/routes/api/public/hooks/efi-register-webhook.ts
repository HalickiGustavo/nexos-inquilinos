import { createFileRoute } from "@tanstack/react-router";

// Cadastra (PUT) ou consulta (GET) o webhook Pix da Efí para a chave Nexo.
// Autenticado via CRON_SECRET (header x-cron-secret) — só admin/cron chama.
//
// Uso:
//   curl -X POST https://dashboard.usenexoapp.com/api/public/hooks/efi-register-webhook \
//     -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" \
//     -d '{"action":"register"}'    # ou {"action":"get"} ou {"action":"delete"}
export const Route = createFileRoute("/api/public/hooks/efi-register-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret") ?? request.headers.get("apikey");
        if (!cronSecret || provided !== cronSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const pixKey = process.env.EFI_PIX_KEY;
        if (!pixKey) {
          return Response.json({ ok: false, error: "EFI_PIX_KEY não configurada." }, { status: 500 });
        }

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          /* empty body ok */
        }
        const action: "register" | "get" | "delete" = body?.action ?? "register";
        const webhookUrl: string =
          body?.webhookUrl ?? "https://dashboard.usenexoapp.com/api/public/efi-webhook";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const path = `/v2/webhook/${encodeURIComponent(pixKey)}`;
        let invokeBody: any;
        if (action === "register") {
          invokeBody = {
            api: "pix",
            path,
            method: "PUT",
            // x-skip-mtls-checking: a Efí aceita o webhook sem exigir mTLS
            // na nossa URL (compensamos com HMAC em EFI_WEBHOOK_HMAC).
            headers: { "x-skip-mtls-checking": "true" },
            body: { webhookUrl },
          };
        } else if (action === "get") {
          invokeBody = { api: "pix", path, method: "GET" };
        } else if (action === "delete") {
          invokeBody = { api: "pix", path, method: "DELETE" };
        } else {
          return Response.json({ ok: false, error: "action inválida" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.functions.invoke("efi-pix-proxy", {
          body: invokeBody,
        });
        if (error) {
          return Response.json({ ok: false, error: error.message ?? String(error) }, { status: 502 });
        }
        return Response.json({ ok: true, action, pixKey, webhookUrl, efi: data });
      },
    },
  },
});
