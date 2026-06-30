import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ installmentId: z.string().uuid() });

export type TripleSplitResult =
  | {
      ok: true;
      provider: "efi" | "mock";
      qrCodeBase64: string;
      pixPayload: string;
      breakdown: {
        total: number;
        nexo: number;
        agency: number;
        owner: number;
        nexoKey: string;
        agencyKey: string | null;
        ownerKey: string | null;
      };
    }
  | { ok: false; error: string; debug?: PixDebugInfo };

export type PixDebugInfo = {
  at: string;
  installmentId: string;
  txid?: string;
  error: {
    name: string | null;
    message: string;
    code: string | null;
    causeName: string | null;
    causeMessage: string | null;
    causeCode: string | null;
  };
  efi: string | null;
  context?: {
    total: number;
    nexoAmount: number;
    agencyAmount: number;
    ownerAmount: number;
    hasAgencyPixKey: boolean;
    agencyPixKeyType: string | null;
    agencyPixKeyMasked: string | null;
    hasOwnerPixKey: boolean;
    ownerPixKeyType: string | null;
    ownerPixKeyMasked: string | null;
    hasOwnerEfiAccount: boolean;
    hasAgencyEfiAccount: boolean;
    hasNexoPixKey: boolean;
  };
};

export type BoletoResult =
  | {
      ok: true;
      provider: "efi" | "mock";
      url: string;
      barcode: string;
      pdfUrl: string;
      breakdown: {
        total: number;
        nexo: number;
        agency: number;
        owner: number;
      };
    }
  | { ok: false; error: string };

// Chave Pix mestra da plataforma Nexo — fixa em código.
const NEXO_MASTER_PIX_KEY = "66524872000167";
const NEXO_MASTER_PIX_KEY_TYPE = "CNPJ";

function maskPixKey(key?: string | null) {
  if (!key) return null;
  const clean = String(key).trim();
  if (clean.length <= 6) return `${clean.slice(0, 1)}***${clean.slice(-1)}`;
  return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
}

function serializeError(error: unknown) {
  const e = error as any;
  const cause = e?.cause as any;
  return {
    name: e?.name ?? null,
    message: e?.message ?? String(error),
    code: e?.code ?? null,
    causeName: cause?.name ?? null,
    causeMessage: cause?.message ?? null,
    causeCode: cause?.code ?? null,
  };
}

function serializeDebugValue(value: unknown) {
  if (value == null) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildPixDebug(error: unknown, installmentId: string, txid?: string, ctx?: Awaited<ReturnType<typeof loadContext>>) {
  const e = error as any;
  return {
    at: new Date().toISOString(),
    installmentId,
    txid,
    error: serializeError(error),
    efi: serializeDebugValue(e?.efiDebug),
    context: ctx
      ? {
          total: ctx.total,
          nexoAmount: ctx.nexoAmount,
          agencyAmount: ctx.agencyAmount,
          ownerAmount: ctx.ownerAmount,
          hasAgencyPixKey: Boolean(ctx.agency?.agency_pix_key),
          agencyPixKeyType: ctx.agency?.agency_pix_key_type ?? null,
          agencyPixKeyMasked: maskPixKey(ctx.agency?.agency_pix_key),
          hasOwnerPixKey: Boolean(ctx.ownerPixKey),
          ownerPixKeyType: ctx.ownerPixKeyType,
          ownerPixKeyMasked: maskPixKey(ctx.ownerPixKey),
          hasOwnerEfiAccount: Boolean(ctx.ownerEfiAccountNumber),
          hasAgencyEfiAccount: Boolean(ctx.agency?.agency_efi_account_number),
          hasNexoPixKey: Boolean(ctx.nexoKey),
        }
      : undefined,
  };
}

async function loadContext(supabase: any, installmentId: string) {
  const { data: inst, error: e1 } = await supabase
    .from("installments")
    .select(
      "id, amount, due_date, contract_id, user_id, contracts!inner(id, rent_amount, agency_admin_fee_percentage, property_id, user_id, tenant_id)",
    )
    .eq("id", installmentId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!inst) throw new Error("Parcela não encontrada.");

  const contract: any = (inst as any).contracts;
  const managerUserId: string = contract.user_id;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: prop }, { data: agency }, { data: settingsRows }, { data: tenant }] =
    await Promise.all([
      supabaseAdmin
        .from("properties")
        .select("id, nickname, landlord_id, owner_pix_key, owner_pix_key_type")
        .eq("id", contract.property_id)
        .maybeSingle(),
      supabaseAdmin
        .from("agency_settings")
        .select("agency_pix_key, agency_pix_key_type, agency_efi_account_number, agency_document")
        .eq("manager_user_id", managerUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("platform_settings")
        .select("key, value")
        .in("key", ["nexo_flat_fee"]),
      supabaseAdmin
        .from("tenants")
        .select("full_name, document, email, phone")
        .eq("id", contract.tenant_id)
        .maybeSingle(),
    ]);

  const settings: Record<string, string> = {};
  (settingsRows ?? []).forEach((r: any) => (settings[r.key] = r.value));

  // Busca a chave Pix do proprietário vinculado ao imóvel (profiles.pix_key).
  // Mantém compat com properties.owner_pix_key como fallback se ainda não houver vínculo.
  let ownerPixKey: string | null = null;
  let ownerPixKeyType: string | null = null;
  let ownerDocument: string | null = null;
  let ownerEfiAccountNumber: string | null = null;
  if ((prop as any)?.landlord_id) {
    const { data: landlordProfile } = await supabaseAdmin
      .from("profiles")
      .select("pix_key, pix_key_type, document, efi_account_number")
      .eq("id", (prop as any).landlord_id)
      .maybeSingle();
    ownerPixKey = (landlordProfile as any)?.pix_key ?? null;
    const t = (landlordProfile as any)?.pix_key_type as string | null;
    ownerPixKeyType = t ? t.toUpperCase() : null;
    ownerDocument = (landlordProfile as any)?.document ?? null;
    ownerEfiAccountNumber = (landlordProfile as any)?.efi_account_number ?? null;
  }
  if (!ownerPixKey) {
    ownerPixKey = (prop as any)?.owner_pix_key ?? null;
    ownerPixKeyType = (prop as any)?.owner_pix_key_type ?? null;
  }

  const nexoKey = NEXO_MASTER_PIX_KEY;
  const nexoFee = Number(settings.nexo_flat_fee ?? "24.99");

  const rent = Number(contract.rent_amount);
  const hasAgency = Boolean((agency as any)?.agency_pix_key);
  const feePct = hasAgency ? Number(contract.agency_admin_fee_percentage ?? 10) : 0;
  const nexoAmount = +nexoFee.toFixed(2);
  // Sem imobiliária no contrato → split 2 vias (Nexo + Proprietário).
  // Com imobiliária → split 3 vias (Nexo + Imobiliária + Proprietário).
  const agencyAmount = hasAgency ? +((rent * feePct) / 100).toFixed(2) : 0;
  // Taxa Nexo cobrada ON TOP do aluguel — inquilino paga rent + nexoFee.
  // Proprietário recebe o aluguel inteiro menos a taxa de administração da imobiliária (0 quando não há).
  const total = +(rent + nexoAmount).toFixed(2);
  const ownerAmount = +(rent - agencyAmount).toFixed(2);
  if (ownerAmount < 0) {
    throw new Error(
      `Valor do proprietário negativo (R$ ${ownerAmount.toFixed(2)}). Revise a taxa de administração da imobiliária.`,
    );
  }

  return {
    inst,
    contract,
    managerUserId,
    prop,
    agency,
    settings,
    tenant,
    supabaseAdmin,
    nexoKey,
    nexoKeyType: NEXO_MASTER_PIX_KEY_TYPE,
    ownerPixKey,
    ownerPixKeyType,
    ownerDocument,
    ownerEfiAccountNumber,
    nexoAmount,
    agencyAmount,
    ownerAmount,
    total,
  };
}

export const generateTripleSplitPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<TripleSplitResult> => {
    let ctx: Awaited<ReturnType<typeof loadContext>> | undefined;
    let txid: string | undefined;
    try {
      ctx = await loadContext(context.supabase, data.installmentId);
      const { createSplitCharge } = await import("./efi.server");
      // Efí exige txid ^[a-zA-Z0-9]{26,35}$ e recusa reuso (409 txid_duplicado).
      // Combina installmentId + timestamp base36 + sufixo aleatório para garantir unicidade por tentativa.
      const instPart = String(data.installmentId).replace(/-/g, "").slice(0, 14);
      const tsPart = Date.now().toString(36);
      const randPart = (globalThis.crypto?.randomUUID?.() ?? `${Math.random()}`)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 10);
      txid = `NEXO${instPart}${tsPart}${randPart}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
      if (txid.length < 26) txid = (txid + "0000000000").slice(0, 26);
      const charge = await createSplitCharge({
        txid,
        totalValue: ctx.total,
        description: `Aluguel Mensal - Processado por NEXO`,
        receivers: {
          nexo: {
            pixKey: ctx.nexoKey,
            pixKeyType: ctx.nexoKeyType as any,
            amount: ctx.nexoAmount,
            name: "NEXO",
          },
          agency: ctx.agency?.agency_pix_key
            ? {
                pixKey: ctx.agency.agency_pix_key,
                pixKeyType: (ctx.agency.agency_pix_key_type as any) || "EVP",
                amount: ctx.agencyAmount,
                name: "IMOBILIARIA",
                document: (ctx.agency as any)?.agency_document ?? null,
                efiAccountNumber: (ctx.agency as any)?.agency_efi_account_number ?? null,
              }
            : undefined,
          owner: ctx.ownerPixKey
            ? {
                pixKey: ctx.ownerPixKey,
                pixKeyType: (ctx.ownerPixKeyType as any) || "EVP",
                amount: ctx.ownerAmount,
                name: "PROPRIETARIO",
                document: ctx.ownerDocument,
                efiAccountNumber: ctx.ownerEfiAccountNumber,
              }
            : undefined,
        },
      });

      await ctx.supabaseAdmin.from("pix_splits").upsert(
        {
          installment_id: data.installmentId,
          user_id: ctx.managerUserId,
          provider: charge.provider,
          charge_type: "pix",
          nexo_amount: ctx.nexoAmount,
          agency_amount: ctx.agencyAmount,
          owner_amount: ctx.ownerAmount,
          nexo_pix_key: ctx.nexoKey,
          agency_pix_key: ctx.agency?.agency_pix_key ?? null,
          owner_pix_key: ctx.ownerPixKey ?? null,
          psp_txid: charge.txid,
          psp_qrcode_base64: charge.qrCodeBase64,
          psp_pix_payload: charge.pixPayload,
          status: "pending",
          payout_status: charge.provider === "efi" ? "pending" : "pending",
        },
        { onConflict: "installment_id" } as any,
      );

      await ctx.supabaseAdmin
        .from("installments")
        .update({
          pix_qrcode: charge.qrCodeBase64,
          pix_payload: charge.pixPayload,
          charge_provider: "efi",
        })
        .eq("id", data.installmentId);

      return {
        ok: true,
        provider: charge.provider,
        qrCodeBase64: charge.qrCodeBase64,
        pixPayload: charge.pixPayload,
        breakdown: {
          total: ctx.total,
          nexo: ctx.nexoAmount,
          agency: ctx.agencyAmount,
          owner: ctx.ownerAmount,
          nexoKey: ctx.nexoKey,
          agencyKey: ctx.agency?.agency_pix_key ?? null,
          ownerKey: ctx.ownerPixKey ?? null,
        },
      };
    } catch (e: any) {
      const debug = buildPixDebug(e, data.installmentId, txid, ctx);
      console.error("[pix-split] generateTripleSplitPix failed", debug);
      return {
        ok: false,
        error: e?.message && e.message !== "fetch failed" ? e.message : "Falha ao gerar QR Pix na Efí.",
        debug,
      };
    }
  });

// Consulta status atual da cobrança na Efí e marca como paga se CONCLUIDA.
// Usado como polling no client + fallback quando o webhook não chega.
export const checkPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<{ paid: boolean; status?: string; error?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: split } = await supabaseAdmin
        .from("pix_splits")
        .select("id, psp_txid, status, charge_type")
        .eq("installment_id", data.installmentId)
        .maybeSingle();
      if (!split?.psp_txid) return { paid: false, error: "Cobrança não encontrada." };
      if (split.status === "paid") return { paid: true, status: "CONCLUIDA" };
      if (split.charge_type !== "pix") return { paid: false };

      const { fetchPixCob } = await import("./efi.server");
      const cob = await fetchPixCob(split.psp_txid);
      const status = String(cob?.status ?? "").toUpperCase();
      if (status === "CONCLUIDA") {
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
          .eq("id", data.installmentId);

        // Dispara repasse instantâneo (claim atômico garante idempotência com o webhook).
        const { runInstantPayoutForSplit } = await import("./efi-payouts.server");
        runInstantPayoutForSplit(split.id).catch((err) =>
          console.error("[checkPixPayment] instant payout failed", split.id, err),
        );
        return { paid: true, status };
      }
      return { paid: false, status };
    } catch (e: any) {
      return { paid: false, error: e?.message ?? String(e) };
    }
  });

export const generateBoletoCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<BoletoResult> => {
    try {
      const ctx = await loadContext(context.supabase, data.installmentId);
      if (!ctx.tenant?.document) {
        return { ok: false, error: "CPF/CNPJ do inquilino é obrigatório para emitir boleto." };
      }
      const { createBoletoCharge } = await import("./efi.server");

      const boleto = await createBoletoCharge({
        installmentId: data.installmentId,
        totalValue: ctx.total,
        dueDate: (ctx.inst as any).due_date,
        customer: {
          name: ctx.tenant.full_name,
          document: ctx.tenant.document,
          email: ctx.tenant.email ?? undefined,
          phone: ctx.tenant.phone ?? undefined,
        },
        description: `Aluguel Nexo - parcela ${(ctx.inst as any).due_date}`,
      });

      // Agenda repasse D+1 da imobiliária/proprietário
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const scheduledFor = tomorrow.toISOString().slice(0, 10);

      await ctx.supabaseAdmin.from("pix_splits").upsert(
        {
          installment_id: data.installmentId,
          user_id: ctx.managerUserId,
          provider: boleto.provider,
          charge_type: "boleto",
          nexo_amount: ctx.nexoAmount,
          agency_amount: ctx.agencyAmount,
          owner_amount: ctx.ownerAmount,
          nexo_pix_key: ctx.nexoKey,
          agency_pix_key: ctx.agency?.agency_pix_key ?? null,
          owner_pix_key: ctx.ownerPixKey ?? null,
          psp_txid: boleto.chargeId,
          boleto_url: boleto.url,
          boleto_barcode: boleto.barcode,
          status: "pending",
          payout_status: "pending",
          payout_scheduled_for: scheduledFor,
        },
        { onConflict: "installment_id" } as any,
      );

      await ctx.supabaseAdmin
        .from("installments")
        .update({
          boleto_url: boleto.url,
          boleto_barcode: boleto.barcode,
          barcode: boleto.barcode,
          charge_provider: "efi",
        })
        .eq("id", data.installmentId);

      return {
        ok: true,
        provider: boleto.provider,
        url: boleto.url,
        barcode: boleto.barcode,
        pdfUrl: boleto.pdfUrl,
        breakdown: {
          total: ctx.total,
          nexo: ctx.nexoAmount,
          agency: ctx.agencyAmount,
          owner: ctx.ownerAmount,
        },
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  });
