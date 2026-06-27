import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Webhook Efí Pay — recebe notificações de Pix recebido (split nativo) e
// boleto pago. Verifica HMAC, marca pix_splits/installments como pagos e,
// para boletos, agenda repasse D+1 via cron.
export const Route = createFileRoute("/api/public/efi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig =
          request.headers.get("x-signature") ??
          request.headers.get("x-efi-signature") ??
          request.headers.get("signature");

        const { verifyEfiWebhookSignature, isEfiProductionMode } = await import("@/lib/efi.server");

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
          // ---------------- PIX recebido ----------------
          const pixEvents: Array<any> = Array.isArray(payload?.pix) ? payload.pix : [];
          for (const evt of pixEvents) {
            const txid = evt?.txid;
            if (!txid) continue;
            const { data: split } = await supabaseAdmin
              .from("pix_splits")
              .select("id, installment_id, charge_type")
              .eq("psp_txid", txid)
              .maybeSingle();
            if (!split) continue;

            await supabaseAdmin
              .from("pix_splits")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("id", split.id);
            await supabaseAdmin
              .from("installments")
              .update({ status: "pago", payment_date: new Date().toISOString() })
              .eq("id", split.installment_id);
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
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              await supabaseAdmin
                .from("pix_splits")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                  payout_status: "scheduled",
                  payout_scheduled_for:
                    split.payout_scheduled_for ?? tomorrow.toISOString().slice(0, 10),
                })
                .eq("id", split.id);
              await supabaseAdmin
                .from("installments")
                .update({ status: "pago", payment_date: new Date().toISOString() })
                .eq("id", split.installment_id);
            }
          }
        } catch (e: any) {
          console.error("[efi-webhook] erro:", e);
          return new Response(JSON.stringify({ ok: false, error: e?.message }), { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
