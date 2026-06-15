import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        const token = request.headers.get("asaas-access-token") ?? request.headers.get("Asaas-Access-Token");
        // Constant-time comparison to defeat timing side-channel attacks
        // that could otherwise leak the webhook token byte-by-byte.
        const tokenBuf = token ? Buffer.from(token) : null;
        const expectedBuf = expected ? Buffer.from(expected) : null;
        const ok =
          !!tokenBuf &&
          !!expectedBuf &&
          tokenBuf.length === expectedBuf.length &&
          timingSafeEqual(tokenBuf, expectedBuf);
        if (!ok) {
          return new Response("Unauthorized", { status: 401 });
        }


        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        const event: string = body?.event ?? "";
        const payment = body?.payment;
        if (!payment?.id) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const paid = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_RECEIVED_IN_CASH"].includes(event);
        const refunded = ["PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_DELETED"].includes(event);
        const overdue = event === "PAYMENT_OVERDUE";

        // Modelo B: cobranças são emitidas em diferentes subcontas. Usamos o
        // externalReference (= installment.id) como identificador canônico,
        // independente de qual subconta disparou o evento. Fallback: asaas_payment_id.
        const externalRef: string | null =
          (typeof payment.externalReference === "string" && payment.externalReference) ||
          (typeof payment.externalMetadata?.installmentId === "string" && payment.externalMetadata.installmentId) ||
          null;

        const applyUpdate = (patch: Record<string, unknown>) => {
          const q = supabaseAdmin.from("installments").update(patch as any);
          return externalRef ? q.eq("id", externalRef) : q.eq("asaas_payment_id", payment.id);
        };

        if (paid) {
          const paidValue = Number(payment.netValue ?? payment.value ?? 0);
          await applyUpdate({
            status: "pago",
            paid_amount: paidValue,
            payment_date: payment.paymentDate ?? payment.clientPaymentDate ?? new Date().toISOString(),
            asaas_payment_id: payment.id,
          });
        } else if (refunded) {
          await applyUpdate({ status: "pendente", paid_amount: 0, payment_date: null });
        } else if (overdue) {
          // status stays 'pendente'; UI calculates 'atrasado' via due_date
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
