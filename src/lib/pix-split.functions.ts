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
  | { ok: false; error: string };

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
        .select("agency_pix_key, agency_pix_key_type")
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
  if ((prop as any)?.landlord_id) {
    const { data: landlordProfile } = await supabaseAdmin
      .from("profiles")
      .select("pix_key, pix_key_type")
      .eq("id", (prop as any).landlord_id)
      .maybeSingle();
    ownerPixKey = (landlordProfile as any)?.pix_key ?? null;
    const t = (landlordProfile as any)?.pix_key_type as string | null;
    ownerPixKeyType = t ? t.toUpperCase() : null;
  }
  if (!ownerPixKey) {
    ownerPixKey = (prop as any)?.owner_pix_key ?? null;
    ownerPixKeyType = (prop as any)?.owner_pix_key_type ?? null;
  }

  const nexoKey = NEXO_MASTER_PIX_KEY;
  const nexoFee = Number(settings.nexo_flat_fee ?? "24.99");

  const rent = Number(contract.rent_amount);
  const total = Number((inst as any).amount);
  const feePct = Number(contract.agency_admin_fee_percentage ?? 10);
  const agencyAmount = +((rent * feePct) / 100).toFixed(2);
  const nexoAmount = +Math.min(nexoFee, total).toFixed(2);
  const ownerAmount = +(total - nexoAmount - agencyAmount).toFixed(2);
  if (ownerAmount < 0) {
    throw new Error(
      `Valor do proprietário negativo (R$ ${ownerAmount.toFixed(2)}). Revise a taxa Nexo e/ou a taxa de administração.`,
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
    try {
      const ctx = await loadContext(context.supabase, data.installmentId);
      const { createSplitCharge } = await import("./efi.server");
      const txid = `NEXO${String(data.installmentId).replace(/-/g, "").slice(0, 21)}`;
      const charge = await createSplitCharge({
        txid,
        totalValue: ctx.total,
        description: `Aluguel Mensal - Processado por NEXO`,
        receivers: {
          nexo: {
            pixKey: ctx.nexoKey,
            pixKeyType: (ctx.settings.nexo_platform_pix_key_type as any) || "EVP",
            amount: ctx.nexoAmount,
            name: "NEXO",
          },
          agency: ctx.agency?.agency_pix_key
            ? {
                pixKey: ctx.agency.agency_pix_key,
                pixKeyType: (ctx.agency.agency_pix_key_type as any) || "EVP",
                amount: ctx.agencyAmount,
                name: "IMOBILIARIA",
              }
            : undefined,
          owner: ctx.prop?.owner_pix_key
            ? {
                pixKey: ctx.prop.owner_pix_key,
                pixKeyType: (ctx.prop.owner_pix_key_type as any) || "EVP",
                amount: ctx.ownerAmount,
                name: "PROPRIETARIO",
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
          owner_pix_key: ctx.prop?.owner_pix_key ?? null,
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
          ownerKey: ctx.prop?.owner_pix_key ?? null,
        },
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
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
          owner_pix_key: ctx.prop?.owner_pix_key ?? null,
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
