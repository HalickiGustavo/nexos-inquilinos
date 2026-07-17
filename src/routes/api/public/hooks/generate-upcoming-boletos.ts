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
          const { confirmChargePaid } = await import("@/lib/stark/webhook.server");

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
              // Nunca deixar erro de UMA parcela derrubar o cron inteiro.
              errors.push({ id: row.id, error: e?.message ?? String(e) });
            }
          }


          // 2) Reconciliação: verifica boletos ainda `created` para
          // detectar pagamentos perdidos (webhook falhou).
          const { data: openBoletos } = await supabaseAdmin
            .from("stark_charges")
            .select("stark_id")
            .eq("kind", "boleto")
            .eq("status", "created")
            .not("stark_id", "is", null)
            .limit(200);

          let reconciled = 0;
          for (const c of (openBoletos ?? []) as any[]) {
            try {
              const res = await getBoleto(c.stark_id);
              if (res.boleto?.status === "paid") {
                await confirmChargePaid({ starkId: c.stark_id, kind: "boleto" });
                reconciled++;
              }
            } catch {
              /* continua */
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
