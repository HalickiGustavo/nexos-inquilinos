import { createFileRoute } from "@tanstack/react-router";

// Reconciliação: consulta cobranças `created` na Stark para pegar
// pagamentos que perderam o webhook.
export const Route = createFileRoute("/api/public/hooks/reconcile-stark-charges")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { getInvoice, getBoleto } = await import("@/lib/stark/charges.server");
          const { confirmChargePaid } = await import("@/lib/stark/webhook.server");

          const { data } = await supabaseAdmin
            .from("stark_charges")
            .select("id, stark_id, kind, status")
            .eq("status", "created")
            .not("stark_id", "is", null)
            .limit(100);

          let paid = 0;
          for (const c of ((data as any[]) ?? [])) {
            try {
              if (c.kind === "boleto") {
                const res = await getBoleto(c.stark_id);
                if (res.boleto?.status === "paid") {
                  await confirmChargePaid({ starkId: c.stark_id, kind: "boleto" });
                  paid++;
                }
              } else {
                const res = await getInvoice(c.stark_id);
                if (res.invoice?.status === "paid") {
                  await confirmChargePaid({ starkId: c.stark_id, kind: "pix" });
                  paid++;
                }
              }
            } catch {
              /* próxima janela tenta de novo */
            }
          }
          return Response.json({ ok: true, scanned: data?.length ?? 0, confirmed: paid });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
