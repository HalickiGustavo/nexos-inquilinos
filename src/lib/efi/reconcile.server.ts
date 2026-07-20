// Reconciliador de cobranças Efí.
//
// IMPORTANTE: PIX e Boleto usam endpoints DIFERENTES na API da Efí e
// identificadores incompatíveis:
//   - PIX     -> GET /v2/cob/{txid}     txid alfanumérico ^[a-zA-Z0-9]{26,35}$
//   - Boleto  -> GET /v1/charge/{id}    charge_id numérico
//
// Por isso filtramos por `kind` no banco e chamamos o endpoint correto para
// cada tipo. Nunca reutilizar um identificador entre fluxos.
//
// SERVER-ONLY.

import { efiCobGet, efiBoletoGet } from "./efi.server";
import { confirmEfiChargePaid, markBoletoChargePaid } from "./webhook.server";

const PIX_LOOKBACK_HOURS = 48;
const BOLETO_LOOKBACK_DAYS = 120; // boletos emitidos com até 15d antecedência + prazo pós-vencimento
const BATCH = 100;
const PIX_TXID_RE = /^[a-zA-Z0-9]{26,35}$/;
const BOLETO_ID_RE = /^\d+$/;

export async function reconcileEfiCharges(): Promise<{
  scanned: number;
  confirmed: number;
  errors: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const pixSince = new Date(Date.now() - PIX_LOOKBACK_HOURS * 3600 * 1000).toISOString();
  const boletoSince = new Date(Date.now() - BOLETO_LOOKBACK_DAYS * 86400 * 1000).toISOString();

  const [{ data: pixRows, error: pixErr }, { data: boletoRows, error: boletoErr }] = await Promise.all([
    supabaseAdmin
      .from("efi_charges" as any)
      .select("id, txid, installment_id, status, created_at, kind, amount")
      .not("txid", "is", null)
      .eq("kind", "pix")
      .in("status", ["created", "active", "pending"])
      .gte("created_at", pixSince)
      .order("created_at", { ascending: true })
      .limit(BATCH),
    supabaseAdmin
      .from("efi_charges" as any)
      .select("id, txid, installment_id, status, created_at, kind, amount")
      .not("txid", "is", null)
      .eq("kind", "boleto")
      .in("status", ["created", "waiting", "new", "identified", "approved", "unpaid"])
      .gte("created_at", boletoSince)
      .order("created_at", { ascending: true })
      .limit(BATCH),
  ]);

  if (pixErr || boletoErr) {
    console.error("[efi-reconcile-charges] db list failed", pixErr, boletoErr);
    return {
      scanned: 0,
      confirmed: 0,
      errors: [pixErr?.message, boletoErr?.message].filter(Boolean) as string[],
    };
  }

  const rows = [...((pixRows as any[]) ?? []), ...((boletoRows as any[]) ?? [])];
  console.log("[efi-reconcile-charges] start", {
    pix: pixRows?.length ?? 0,
    boleto: boletoRows?.length ?? 0,
  });

  let confirmed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const kind = String(row.kind ?? "").toLowerCase();
    const identifier = String(row.txid ?? "");

    try {
      if (kind === "pix") {
        if (!PIX_TXID_RE.test(identifier)) {
          console.warn("[efi-reconcile-charges] pix txid inválido, ignorando", identifier);
          await supabaseAdmin
            .from("efi_charges" as any)
            .update({ status: "ignored" })
            .eq("id", row.id);
          continue;
        }
        const started = Date.now();
        const cob: any = await efiCobGet(identifier);
        const status = cob?.status;
        console.log("[efi-reconcile-charges] pix cob status", {
          txid: identifier,
          status,
          ms: Date.now() - started,
        });

        if (status === "CONCLUIDA") {
          const paid = cob?.pix?.[0];
          await confirmEfiChargePaid({
            txid: identifier,
            paidAmount: Number(paid?.valor ?? cob?.valor?.original ?? 0),
            endToEndId: paid?.endToEndId,
          });
          confirmed += 1;
        } else if (
          status === "REMOVIDA_PELO_USUARIO_RECEBEDOR" ||
          status === "REMOVIDA_PELO_PSP"
        ) {
          await supabaseAdmin
            .from("efi_charges" as any)
            .update({ status: "cancelled" })
            .eq("id", row.id);
        }
      } else if (kind === "boleto") {
        if (!BOLETO_ID_RE.test(identifier)) {
          console.warn("[efi-reconcile-charges] boleto id inválido, ignorando", identifier);
          await supabaseAdmin
            .from("efi_charges" as any)
            .update({ status: "ignored" })
            .eq("id", row.id);
          continue;
        }
        const started = Date.now();
        const res: any = await efiBoletoGet(identifier);
        const data: any = res?.data ?? res;
        const status = String(data?.status ?? "").toLowerCase();
        console.log("[efi-reconcile-charges] boleto status", {
          chargeId: identifier,
          status,
          ms: Date.now() - started,
        });

        // Estados pagos no charge/{id} da Efí (v1): "paid" / "settled".
        if (status === "paid" || status === "settled") {
          const paidAt = data?.paid_at ?? new Date().toISOString();
          const rawAmount = Number(data?.total ?? data?.value ?? data?.payment?.value ?? 0);
          const paidAmount = rawAmount > 0 ? rawAmount / 100 : Number((row as any).amount ?? 0);
          await markBoletoChargePaid({ chargeId: identifier, paidAmount, paidAt });
          confirmed += 1;
        } else if (status === "canceled" || status === "expired" || status === "unpaid") {
          await supabaseAdmin
            .from("efi_charges" as any)
            .update({ status: status === "canceled" ? "cancelled" : status })
            .eq("id", row.id);
        }
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.warn("[efi-reconcile-charges] fetch failed", { kind, identifier, msg });
      errors.push(`${kind}:${identifier}: ${msg}`);
    }
  }

  console.log("[efi-reconcile-charges] done", { scanned: rows.length, confirmed });
  return { scanned: rows.length, confirmed, errors };
}
