// Registra (ou atualiza) o webhook Pix na Efí apontando para
// /api/public/efi-webhook?hmac=<EFI_WEBHOOK_HMAC_SECRET>.
//
// Protegido por header `x-admin-token: <EFI_WEBHOOK_HMAC_SECRET>`.
// A chave PIX de recebimento vem de EFI_PIX_KEY (secret do projeto).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/register-efi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminToken = request.headers.get("x-admin-token") ?? "";
        const expected = process.env.EFI_WEBHOOK_HMAC_SECRET ?? "";
        if (!expected || adminToken !== expected) {
          return new Response("unauthorized", { status: 401 });
        }

        const chave = process.env.EFI_PIX_KEY;
        if (!chave) return Response.json({ ok: false, error: "EFI_PIX_KEY not set" }, { status: 500 });

        const webhookUrl = `https://dashboard.usenexoapp.com/api/public/efi-webhook?hmac=${encodeURIComponent(expected)}`;

        try {
          const { efiProxyCall } = await import("@/lib/efi/efi.server");
          const put = await efiProxyCall("webhook_put", {
            chave,
            body: { webhookUrl },
          });
          const get = await efiProxyCall("webhook_get", { chave }).catch((e: any) => ({
            error: e?.message ?? String(e),
          }));
          return Response.json({ ok: true, chave, webhookUrl, put, get });
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
