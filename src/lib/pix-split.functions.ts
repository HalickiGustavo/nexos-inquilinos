// Server functions da camada financeira.
// Mantém a API antiga para preservar o front, mas a implementação agora prioriza Efí.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeSplit } from "@/lib/financial-engine.server";

const inputSchema = z.object({ installmentId: z.string().uuid() });

export type TripleSplitResult =
  | {
      ok: true;
      provider: "efi";
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
  | { ok: false; error: string; debug?: string | null };

export type BoletoResult =
  | {
      ok: true;
      provider: "efi";
      url: string;
      barcode: string;
      pdfUrl: string;
      breakdown: { total: number; nexo: number; agency: number; owner: number };
    }
  | { ok: false; error: string };

function normalizeDoc(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

// Nome do pagador para APIs: mínimo 2 caracteres, remove caracteres especiais
function sanitizePayerName(raw: string): string | null {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  if (cleaned.length < 2 || !/[A-Za-z]/.test(cleaned)) return null;
  return cleaned;
}

export const generateTripleSplitPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<TripleSplitResult> => {
    try {
      const { isEfiConfigured } = await import("@/lib/efi/efi.server");
      const useEfi = isEfiConfigured() && !!process.env.EFI_PIX_KEY;
      
      if (!useEfi) {
        return { ok: false, error: "Integração Efí Bank não configurada corretamente." };
      }

      const { data: ownedInst, error: ownedErr } = await context.supabase
        .from("installments")
        .select("id")
        .eq("id", data.installmentId)
        .maybeSingle();
        
      if (ownedErr || !ownedInst) {
        return { ok: false, error: "Parcela não encontrada ou acesso negado." };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: inst, error } = await supabaseAdmin
        .from("installments")
        .select(
          "id, amount, due_date, status, contract_id, contract:contracts(id, user_id, tenant:tenants(id, full_name, document), property:properties(id, landlord_id, default_management_fee_percent))",
        )
        .eq("id", data.installmentId)
        .maybeSingle();

      if (error || !inst) return { ok: false, error: "Parcela não encontrada" };
      if ((inst as any).status === "pago") {
        return { ok: false, error: "Parcela já paga." };
      }

      const contract = (inst as any).contract;
      const property = contract?.property;
      const tenant = contract?.tenant;
      const managerUserId = contract?.user_id;
      const landlordId: string | null = property?.landlord_id ?? null;
      const pct = Number(property?.default_management_fee_percent ?? 10);

      const payerDoc = normalizeDoc(tenant?.document);
      const payerName = sanitizePayerName(String(tenant?.full_name ?? ""));
      
      if (!payerName) {
        return { ok: false, error: "Nome do inquilino é obrigatório." };
      }

      const [{ data: platform }, { data: agency }, { data: ownerProfile }] = await Promise.all([
        supabaseAdmin.from("platform_settings").select("nexo_platform_pix_key, nexo_flat_fee").limit(1).maybeSingle(),
        supabaseAdmin.from("agency_settings").select("agency_pix_key").eq("manager_user_id", managerUserId).maybeSingle(),
        landlordId
          ? supabaseAdmin.from("profiles").select("pix_key").eq("id", landlordId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      const nexoPixKey = (platform as any)?.nexo_platform_pix_key ?? process.env.EFI_PIX_KEY ?? "66524872000167";
      const nexoFee = Number((platform as any)?.nexo_flat_fee ?? 24.99);
      const total = Number((inst as any).amount) + nexoFee;

      const split = computeSplit({
        paidAmount: total,
        nexoFee,
        managementFeePercent: pct,
        agencyPixKey: (agency as any)?.agency_pix_key ?? null,
        ownerPixKey: (ownerProfile as any)?.pix_key ?? null,
        nexoPixKey,
      });

      const { createOrReuseEfiPix } = await import("@/lib/efi/cob.server");
      const efi = await createOrReuseEfiPix({
        installmentId: data.installmentId,
        amount: total,
        payer: { taxId: payerDoc, name: payerName },
        pixKey: process.env.EFI_PIX_KEY!,
        descriptions: [{ key: "Aluguel", value: `Parcela ${data.installmentId.slice(0, 8)}` }],
      });

      await supabaseAdmin.from("efi_charges" as any).upsert({
        installment_id: data.installmentId,
        manager_user_id: managerUserId,
        kind: "pix",
        status: efi.status,
        amount: total,
        txid: efi.txid,
        loc_id: efi.locId,
        brcode: efi.pixPayload,
      } as any, { onConflict: "txid" } as any);

      return {
        ok: true,
        provider: "efi",
        qrCodeBase64: efi.qrCodeBase64,
        pixPayload: efi.pixPayload,
        breakdown: {
          total: split.total,
          nexo: split.nexo.amount,
          agency: split.agency.amount,
          owner: split.owner.amount,
          nexoKey: split.nexo.pixKey ?? "",
          agencyKey: split.agency.pixKey,
          ownerKey: split.owner.pixKey,
        },
      };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message ?? String(e),
        debug: e?.body ? JSON.stringify(e.body).slice(0, 2000) : null,
      };
    }
  });

export const checkPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ paid: boolean; status?: string }> => {
    try {
      const { data: owned, error: ownedErr } = await context.supabase
        .from("installments")
        .select("id")
        .eq("id", data.installmentId)
        .maybeSingle();
      if (ownedErr || !owned) return { paid: false, status: "forbidden" };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: inst } = await supabaseAdmin
        .from("installments")
        .select("status")
        .eq("id", data.installmentId)
        .maybeSingle();
      if ((inst as any)?.status === "pago") return { paid: true, status: "pago" };

      const { data: efiCharge } = await supabaseAdmin
        .from("efi_charges" as any)
        .select("txid, status")
        .eq("installment_id", data.installmentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const txid = (efiCharge as any)?.txid;
      if (txid) {
        try {
          const { efiCobGet } = await import("@/lib/efi/efi.server");
          const cob: any = await efiCobGet(txid);
          if (cob?.status === "CONCLUIDA") {
            const paidAmount = Number(cob?.valor?.original ?? 0);
            const endToEndId = cob?.pix?.[0]?.endToEndId;
            const { confirmEfiChargePaid } = await import("@/lib/efi/webhook.server");
            await confirmEfiChargePaid({ txid, paidAmount, endToEndId });
            
            try {
              const { runEfiPayoutWorker } = await import("@/lib/efi/payout-worker.server");
              await runEfiPayoutWorker({ limit: 20 });
            } catch (e) {
              console.warn("[checkPixPayment] payout worker error", e);
            }
            return { paid: true, status: "pago" };
          }
          return { paid: false, status: cob?.status ?? "pending" };
        } catch (e) {
          console.warn("[checkPixPayment] efi cob_get failed", e);
        }
      }

      return { paid: false };
    } catch (e: any) {
      return { paid: false, status: e?.message ?? "erro" };
    }
  });

export const generateBoletoCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async (): Promise<BoletoResult> => {
    return { ok: false, error: "Boleto Efí deve ser gerado através do fluxo padrão." };
  });
