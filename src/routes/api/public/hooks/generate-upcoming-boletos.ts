// Cron diário: garante que toda parcela com vencimento nos próximos 15 dias
// tenha um Boleto Stark emitido. Também reconcilia boletos já criados
// (paid?) para não depender só do webhook.
import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/generate-upcoming-boletos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { issueBoletoForInstallmentEfi } = await import("@/lib/efi/boleto-issuer.server");
          const { efiBoletoGet } = await import("@/lib/efi/efi.server");
          const { markBoletoChargePaid } = await import("@/lib/efi/webhook.server");


          const today = new Date();
          const in15 = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
          const startISO = today.toISOString().slice(0, 10);
          const endISO = in15.toISOString().slice(0, 10);

          // 1) Emite boletos faltantes (janela 0..+15 dias)
          const { data: pending, error } = await supabaseAdmin
            .from("installments")
            .select("id, boleto_url, status, due_date")
            .gte("due_date", startISO)
            .lte("due_date", endISO)
            .neq("status", "pago")
            .is("boleto_url", null)
            .limit(500);

          if (error) throw error;

          let issued = 0;
          const errors: Array<{ id: string; error: string }> = [];
          for (const row of (pending ?? []) as any[]) {
            try {
              const r = await issueBoletoForInstallmentEfi(row.id);
              if (r.ok && !r.alreadyExisted) issued++;
              else if (!r.ok) errors.push({ id: row.id, error: r.error });
            } catch (e: any) {
              errors.push({ id: row.id, error: e?.message ?? String(e) });
            }
          }


          // 2) Reconciliação de boletos abertos (últimos 120 dias) — detecta
          // pagamentos perdidos e SEMPRE roteia via markBoletoChargePaid para
          // garantir cálculo de split + enfileiramento de repasse.
          const boletoSince = new Date(Date.now() - 120 * 86400 * 1000).toISOString();
          const { data: openBoletos } = await supabaseAdmin
            .from("efi_charges")
            .select("txid, installment_id, amount")
            .eq("kind", "boleto")
            .in("status", ["created", "waiting", "new", "identified", "approved", "unpaid"])
            .not("txid", "is", null)
            .gte("created_at", boletoSince)
            .limit(500);

          let reconciled = 0;
          const reconcileErrors: Array<{ chargeId: string; error: string }> = [];
          for (const c of (openBoletos ?? []) as any[]) {
            const chargeId = String(c.txid ?? "");
            if (!/^\d+$/.test(chargeId)) continue;
            const started = Date.now();
            try {
              const res: any = await efiBoletoGet(Number(chargeId));
              const data: any = res?.data ?? res;
              const status = String(data?.status ?? "").toLowerCase();
              console.log("[generate-upcoming-boletos] boleto status", {
                chargeId,
                status,
                ms: Date.now() - started,
              });
              if (status === "paid" || status === "settled") {
                const paidAt = data?.paid_at ?? new Date().toISOString();
                const rawAmount = Number(data?.total ?? data?.value ?? data?.payment?.value ?? 0);
                const paidAmount = rawAmount > 0 ? rawAmount / 100 : Number(c.amount ?? 0);
                await markBoletoChargePaid({ chargeId, paidAmount, paidAt });
                reconciled++;
              } else if (status === "canceled" || status === "expired") {
                await supabaseAdmin
                  .from("efi_charges")
                  .update({ status: status === "canceled" ? "cancelled" : status } as any)
                  .eq("txid", chargeId);
              }
            } catch (e: any) {
              const msg = e?.message ?? String(e);
              console.warn("[generate-upcoming-boletos] reconcile failed", { chargeId, msg });
              reconcileErrors.push({ chargeId, error: msg });
            }
          }

          return Response.json({
            ok: true,
            window: { start: startISO, end: endISO },
            scanned: pending?.length ?? 0,
            issued,
            reconciled,
            errors,
          });
        } catch (e: any) {
          return Response.json(
            { ok: false, error: e?.message ?? String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
