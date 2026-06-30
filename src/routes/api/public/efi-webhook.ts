import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Webhook Efí Pay — recebe notificações de Pix recebido (split nativo) e
// boleto pago. Verifica HMAC, marca pix_splits/installments como pagos e,
// para boletos, agenda repasse D+1 via cron.
export const Route = createFileRoute("/api/public/efi-webhook")({
  server: {
    handlers: {
      // Efí valida a URL do webhook fazendo uma chamada GET/POST sem corpo.
      // Precisa responder 2xx senão recusa o cadastro com `webhook_invalido`.
      GET: async () => new Response("ok", { status: 200 }),
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig =
          request.headers.get("x-signature") ??
          request.headers.get("x-efi-signature") ??
          request.headers.get("signature");

        // Ping de validação da Efí (sem corpo, sem assinatura) — responder 200.
        if (!raw || raw.trim() === "" || raw.trim() === "{}") {
          return new Response("ok", { status: 200 });
        }

        const { verifyEfiWebhookSignature, isEfiProductionMode } = await import("@/lib/efi.server");

        // Validação inicial da Efí: envia POST sem header de assinatura. Sem
        // essa exceção, ela cai no 401 e o cadastro do webhook falha com
        // `webhook_invalido`. Aceitamos apenas se não houver payload
        // acionável (`pix`/`event`/`notification`) — eventos reais sempre vêm
        // com assinatura HMAC.
        let earlyParsed: any = null;
        try { earlyParsed = JSON.parse(raw); } catch { /* segue como string */ }
        const hasActionable =
          earlyParsed && typeof earlyParsed === "object" && (
            Array.isArray(earlyParsed.pix) ||
            Boolean(earlyParsed.event) ||
            Boolean(earlyParsed.notification)
          );
        if (!sig && !hasActionable) {
          return new Response("ok", { status: 200 });
        }

        // Em modo mock (sem HMAC configurado) ainda aceitamos para facilitar
        // testes locais, mas só em ambiente não-produção.
        if (isEfiProductionMode() && !verifyEfiWebhookSignature(raw, sig)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Efí Pix: payload.pix = [{ txid, valor, endToEndId, ... }]
        // Efí Boleto: payload.notification ou { event: 'charge.paid', charge_id }
        try {
          const { runInstantPayoutForSplit } = await import("@/lib/efi-payouts.server");

          // ---------------- PIX recebido ----------------
          const pixEvents: Array<any> = Array.isArray(payload?.pix) ? payload.pix : [];
          for (const evt of pixEvents) {
            const txid = evt?.txid;
            if (!txid) continue;
            const { data: split } = await supabaseAdmin
              .from("pix_splits")
              .select("id, installment_id, charge_type, payout_scheduled_for, status")
              .eq("psp_txid", txid)
              .maybeSingle();
            if (!split) continue;

            if (split.status !== "paid") {
              const today = new Date().toISOString().slice(0, 10);
              await supabaseAdmin
                .from("pix_splits")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                  payout_status: "scheduled",
                  payout_scheduled_for: today,
                })
                .eq("id", split.id);
              await supabaseAdmin
                .from("installments")
                .update({ status: "pago", payment_date: new Date().toISOString() })
                .eq("id", split.installment_id);
            }

            // Dispara repasse instantâneo (idempotente via claim atômico).
            await runInstantPayoutForSplit(split.id).catch((err) =>
              console.error("[efi-webhook] instant payout failed", split.id, err),
            );
          }

          // ---------------- BOLETO pago ----------------
          const event = z.string().optional().parse(payload?.event ?? payload?.notification?.event);
          const chargeId =
            payload?.charge_id ??
            payload?.notification?.charge_id ??
            payload?.data?.charge_id;

          if (chargeId && (event === "charge.paid" || event === "paid")) {
            const { data: split } = await supabaseAdmin
              .from("pix_splits")
              .select("id, installment_id, charge_type, payout_scheduled_for")
              .eq("psp_txid", String(chargeId))
              .eq("charge_type", "boleto")
              .maybeSingle();

            if (split) {
              const today = new Date().toISOString().slice(0, 10);
              await supabaseAdmin
                .from("pix_splits")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                  payout_status: "scheduled",
                  payout_scheduled_for: today,
                })
                .eq("id", split.id);
              await supabaseAdmin
                .from("installments")
                .update({ status: "pago", payment_date: new Date().toISOString() })
                .eq("id", split.installment_id);

              await runInstantPayoutForSplit(split.id).catch((err) =>
                console.error("[efi-webhook] instant boleto payout failed", split.id, err),
              );
            }
          }
        } catch (e: any) {
          // Nunca propagar erro de repasse: o evento já foi persistido (ou
          // tentado) e a Efí precisa receber 200 para não reenviar em loop.
          // Falhas de repasse ficam registradas em efi_payouts.status=failed
          // e serão reprocessadas pelo cron D+1.
          console.error("[efi-webhook] erro pós-persistência (ignorado):", e);
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
