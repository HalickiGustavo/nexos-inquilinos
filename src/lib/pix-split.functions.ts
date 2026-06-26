import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ installmentId: z.string().uuid() });

export type TripleSplitResult = {
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
} | { ok: false; error: string };

export const generateTripleSplitPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<TripleSplitResult> => {
    const { supabase, userId } = context;

    // 1. Carrega parcela + contrato + imóvel
    const { data: inst, error: e1 } = await supabase
      .from("installments")
      .select(
        "id, amount, due_date, contract_id, user_id, contracts!inner(id, rent_amount, agency_admin_fee_percentage, property_id, user_id)",
      )
      .eq("id", data.installmentId)
      .maybeSingle();
    if (e1) return { ok: false, error: e1.message };
    if (!inst) return { ok: false, error: "Parcela não encontrada." };

    const contract: any = (inst as any).contracts;
    const managerUserId: string = contract.user_id;

    const { data: prop, error: e2 } = await supabase
      .from("properties")
      .select("id, nickname, owner_pix_key, owner_pix_key_type")
      .eq("id", contract.property_id)
      .maybeSingle();
    if (e2) return { ok: false, error: e2.message };

    // 2. Agency settings + platform settings via admin (políticas RLS limitam)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: agency } = await supabaseAdmin
      .from("agency_settings")
      .select("agency_pix_key, agency_pix_key_type")
      .eq("manager_user_id", managerUserId)
      .maybeSingle();

    const { data: settingsRows } = await supabaseAdmin
      .from("platform_settings")
      .select("key, value")
      .in("key", ["nexo_platform_pix_key", "nexo_platform_pix_key_type", "nexo_flat_fee"]);
    const settings: Record<string, string> = {};
    (settingsRows ?? []).forEach((r: any) => (settings[r.key] = r.value));

    const nexoKey = settings.nexo_platform_pix_key?.trim();
    const nexoFee = Number(settings.nexo_flat_fee ?? "24.99");
    if (!nexoKey) {
      return { ok: false, error: "Chave Pix da plataforma Nexo não configurada (admin)." };
    }

    const rent = Number(contract.rent_amount);
    const total = Number((inst as any).amount);
    const feePct = Number(contract.agency_admin_fee_percentage ?? 10);
    const agencyAmount = +((rent * feePct) / 100).toFixed(2);
    const nexoAmount = +Math.min(nexoFee, total).toFixed(2);
    const ownerAmount = +(total - nexoAmount - agencyAmount).toFixed(2);

    if (ownerAmount < 0) {
      return {
        ok: false,
        error: `Valor do proprietário negativo (R$ ${ownerAmount.toFixed(2)}). Revise a taxa Nexo e/ou a taxa de administração.`,
      };
    }

    // 3. Adapter Efí (mock)
    const { createSplitCharge } = await import("./efi.server");
    const txid = `NEXO${String(data.installmentId).replace(/-/g, "").slice(0, 21)}`;
    const charge = await createSplitCharge({
      txid,
      totalValue: total,
      description: `Aluguel Mensal - Processado por NEXO`,
      receivers: {
        nexo: {
          pixKey: nexoKey,
          pixKeyType: (settings.nexo_platform_pix_key_type as any) || "EVP",
          amount: nexoAmount,
          name: "NEXO",
        },
        agency: agency?.agency_pix_key
          ? {
              pixKey: agency.agency_pix_key,
              pixKeyType: (agency.agency_pix_key_type as any) || "EVP",
              amount: agencyAmount,
              name: "IMOBILIARIA",
            }
          : undefined,
        owner: prop?.owner_pix_key
          ? {
              pixKey: prop.owner_pix_key,
              pixKeyType: (prop.owner_pix_key_type as any) || "EVP",
              amount: ownerAmount,
              name: "PROPRIETARIO",
            }
          : undefined,
      },
    });

    // 4. Upsert pix_splits + grava no installment para reuso (cache)
    await supabaseAdmin.from("pix_splits").upsert(
      {
        installment_id: data.installmentId,
        user_id: managerUserId,
        provider: charge.provider,
        nexo_amount: nexoAmount,
        agency_amount: agencyAmount,
        owner_amount: ownerAmount,
        nexo_pix_key: nexoKey,
        agency_pix_key: agency?.agency_pix_key ?? null,
        owner_pix_key: prop?.owner_pix_key ?? null,
        psp_txid: charge.txid,
        psp_qrcode_base64: charge.qrCodeBase64,
        psp_pix_payload: charge.pixPayload,
        status: "pending",
      },
      { onConflict: "installment_id" } as any,
    );

    await supabaseAdmin
      .from("installments")
      .update({
        pix_qrcode: charge.qrCodeBase64,
        pix_payload: charge.pixPayload,
      })
      .eq("id", data.installmentId);

    return {
      ok: true,
      provider: charge.provider,
      qrCodeBase64: charge.qrCodeBase64,
      pixPayload: charge.pixPayload,
      breakdown: {
        total,
        nexo: nexoAmount,
        agency: agencyAmount,
        owner: ownerAmount,
        nexoKey,
        agencyKey: agency?.agency_pix_key ?? null,
        ownerKey: prop?.owner_pix_key ?? null,
      },
    };
  });
