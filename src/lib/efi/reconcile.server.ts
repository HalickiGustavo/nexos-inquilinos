// Reconciliador de cobranças Efí: varre `efi_charges` em status não-final
// (created/active) das últimas 48h e, para cada uma, consulta a Efí em
// /v2/cob/{txid}. Se estiver CONCLUIDA, chama `confirmEfiChargePaid` que
// marca a parcela como paga, calcula o split e enfileira os repasses.
// Serve de rede de segurança para eventos que o webhook eventualmente perdeu.
//
// SERVER-ONLY.

import { efiCobGet } from "./efi.server";
import { confirmEfiChargePaid } from "./webhook.server";

const LOOKBACK_HOURS = 48;
const BATCH = 50;

export async function reconcileEfiCharges(): Promise<{
  scanned: number;
  confirmed: number;
  errors: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("efi_charges" as any)
    .select("id, txid, installment_id, status, created_at")
    .not("txid", "is", null)
    .in("status", ["created", "active", "pending"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("[efi-reconcile-charges] db list failed", error);
    return { scanned: 0, confirmed: 0, errors: [error.message] };
  }

  const rows = (data as any[]) ?? [];
  console.log("[efi-reconcile-charges] start", { candidates: rows.length });

  let confirmed = 0;
  const errors: string[] = [];

  const TXID_RE = /^[a-zA-Z0-9]{26,35}$/;

  for (const row of rows) {
    // Efí exige txid alfanumérico 26–35 chars. Registros com IDs numéricos
    // curtos são de boleto (charge_id), não de cobrança PIX — pula e marca
    // como ignorado para não repetir a consulta.
    if (!TXID_RE.test(String(row.txid))) {
      await supabaseAdmin
        .from("efi_charges" as any)
        .update({ status: "ignored" })
        .eq("id", row.id);
      continue;
    }
    try {
      const cob: any = await efiCobGet(row.txid);
      const status = cob?.status;
      console.log("[efi-reconcile-charges] cob status", { txid: row.txid, status });

      if (status === "CONCLUIDA") {
        const paid = cob?.pix?.[0];
        await confirmEfiChargePaid({
          txid: row.txid,
          paidAmount: Number(paid?.valor ?? cob?.valor?.original ?? 0),
          endToEndId: paid?.endToEndId,
        });
        confirmed += 1;
      } else if (status === "REMOVIDA_PELO_USUARIO_RECEBEDOR" || status === "REMOVIDA_PELO_PSP") {
        // Cobrança cancelada — marca no banco para não repetir consulta
        await supabaseAdmin
          .from("efi_charges" as any)
          .update({ status: "cancelled" })
          .eq("id", row.id);
      }
      // ATIVA => permanece aguardando pagamento
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.warn("[efi-reconcile-charges] cob fetch failed", row.txid, msg);
      errors.push(`${row.txid}: ${msg}`);
    }
  }


  console.log("[efi-reconcile-charges] done", { scanned: rows.length, confirmed });
  return { scanned: rows.length, confirmed, errors };
}
