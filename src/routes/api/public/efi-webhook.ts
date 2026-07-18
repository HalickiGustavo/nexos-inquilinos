// Webhook Efí Bank (Pix recebido).
//
// A Efí exige que a URL do webhook aceite `?hmac=<segredo>` para validação.
// Depois de validar assinatura + persistir o payload cru para auditoria,
// dispara o processamento REAL da cadeia:
//   1. Marca cobrança/parcela como paga
//   2. Calcula o split interno (Nexo / Imobiliária / Proprietário)
//   3. Enfileira repasses em payment_transfers
//   4. Dispara o worker Efí que envia os PIX de saída
//
// Sempre respondemos 200 (mesmo em erro) para evitar tempestade de retries
// da Efí — falhas são logadas em `efi_events.error` para reprocessamento.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/efi-webhook")({
  server: {
    handlers: {
      // A Efí faz um POST vazio na configuração inicial ("?hmac=<>") como
      // teste de disponibilidade. Aceitamos qualquer método POST com o
      // querystring válido.
      POST: async ({ request }) => handle(request),
    },
  },
});

export async function handle(request: Request) {
  const url = new URL(request.url);
  // Efí anexa "/pix" ao final da URL registrada como parte do path do webhook
  // (ex.: {URL}/pix). Quando a URL registrada contém query string, alguns
  // eventos chegam com "/pix" concatenado ao próprio valor do último parâmetro
  // (ex.: ?hmac=SECRET/pix). Aceitamos ambos os casos.
  const rawHmac = url.searchParams.get("hmac") ?? "";
  const provided = rawHmac.replace(/\/pix$/, "");
  const expected = process.env.EFI_WEBHOOK_HMAC_SECRET ?? "";
  if (!expected) return new Response("webhook not configured", { status: 503 });
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn("[efi-webhook] hmac mismatch", { pathname: url.pathname, providedLen: provided.length });
    return new Response("unauthorized", { status: 401 });
  }
  console.log("[efi-webhook] hmac ok", { pathname: url.pathname });

  let payload: any = null;
  try {
    payload = await request.json();
  } catch {
    // POST vazio (validação/callback de configuração) — responde 200.
    console.log("[efi-webhook] empty body (probe)");
    return new Response("ok", { status: 200 });
  }
  console.log("[efi-webhook] payload received", {
    pixCount: Array.isArray(payload?.pix) ? payload.pix.length : 0,
  });

  // 1) Persistência crua (auditoria + idempotência downstream)
  let eventId: string | null = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("efi_events" as any)
      .insert({
        event_type: "pix",
        payload: payload as any,
        received_at: new Date().toISOString(),
      } as any)
      .select("id")
      .maybeSingle();
    eventId = (data as any)?.id ?? null;
  } catch (e) {
    console.error("[efi-webhook] persist error", e);
  }

  // 2) Processamento (idempotente via efi_charges.status + external_id UNIQUE)
  try {
    const { processEfiWebhookPayload } = await import("@/lib/efi/webhook.server");
    const result = await processEfiWebhookPayload(payload);
    console.log("[efi-webhook] processed", { processed: result.processed, errors: result.errors });
    if (eventId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("efi_events" as any)
        .update({
          processed_at: new Date().toISOString(),
          ...(result.errors.length ? { error: result.errors.join(" | ").slice(0, 500) as any } : {}),
        } as any)
        .eq("id", eventId);
    }
  } catch (e: any) {
    console.error("[efi-webhook] processing error", e);
    if (eventId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("efi_events" as any)
          .update({ error: (e?.message ?? String(e)).slice(0, 500) } as any)
          .eq("id", eventId);
      } catch {}
    }
  }

  return new Response("ok", { status: 200 });
}
