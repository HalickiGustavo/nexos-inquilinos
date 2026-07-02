// Server functions da camada financeira (Stark Bank).
// Mantém a API antiga (generateTripleSplitPix, checkPixPayment) para
// preservar o front, mas a implementação agora usa Invoice (Stark).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ installmentId: z.string().uuid() });

export type TripleSplitResult =
  | {
      ok: true;
      provider: "stark";
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
      provider: "stark";
      url: string;
      barcode: string;
      pdfUrl: string;
      breakdown: { total: number; nexo: number; agency: number; owner: number };
    }
  | { ok: false; error: string };

function normalizeDoc(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

export const generateTripleSplitPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<TripleSplitResult> => {
    try {
      const { createInvoice, getInvoiceQrCodePng } = await import("@/lib/stark/charges.server");
      const { computeSplit } = await import("@/lib/stark/split-engine");
      const { isStarkConfigured } = await import("@/lib/stark/stark.server");
      if (!isStarkConfigured()) {
        return { ok: false, error: "Stark Bank não configurado. Faltam STARK_PROJECT_ID/STARK_PRIVATE_KEY." };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: inst, error } = await supabaseAdmin
        .from("installments")
        .select(
          "id, amount, due_date, contract_id, contract:contracts(id, user_id, tenant:tenants(id, full_name, document), property:properties(id, landlord_id, default_management_fee_percent))",
        )
        .eq("id", data.installmentId)
        .maybeSingle();
      if (error || !inst) return { ok: false, error: "Parcela não encontrada" };

      const contract = (inst as any).contract;
      const property = contract?.property;
      const tenant = contract?.tenant;
      const managerUserId = contract?.user_id;
      const landlordId: string | null = property?.landlord_id ?? null;
      const pct = Number(property?.default_management_fee_percent ?? 10);

      const payerDoc = normalizeDoc(tenant?.document);
      if (payerDoc.length < 11) {
        return { ok: false, error: "Inquilino sem CPF/CNPJ cadastrado — necessário para emitir Invoice PIX." };
      }
      const payerName = String(tenant?.full_name ?? "Inquilino").slice(0, 100);

      const [{ data: platform }, { data: agency }, { data: ownerProfile }] = await Promise.all([
        supabaseAdmin.from("platform_settings").select("nexo_platform_pix_key, nexo_flat_fee").limit(1).maybeSingle(),
        supabaseAdmin.from("agency_settings").select("pix_key").eq("manager_user_id", managerUserId).maybeSingle(),
        landlordId
          ? supabaseAdmin.from("profiles").select("pix_key").eq("id", landlordId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      const nexoPixKey = (platform as any)?.nexo_platform_pix_key ?? "66524872000167";
      const nexoFee = Number((platform as any)?.nexo_flat_fee ?? 24.99);
      const total = Number((inst as any).amount) + nexoFee;

      const split = computeSplit({
        paidAmount: total,
        nexoFee,
        managementFeePercent: pct,
        agencyPixKey: (agency as any)?.pix_key ?? null,
        ownerPixKey: (ownerProfile as any)?.pix_key ?? null,
        nexoPixKey,
      });

      // Stark exige due >= agora. Parcelas vencidas devem ser pagas via Boleto.
      const dueDateStr = String((inst as any).due_date ?? "");
      const isoMatch = dueDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!isoMatch) return { ok: false, error: "Parcela sem data de vencimento válida." };
      const dueEnd = new Date(Date.UTC(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3], 23, 59, 59));
      if (dueEnd.getTime() <= Date.now() + 60 * 60 * 1000) {
        return {
          ok: false,
          error: "Parcela vencida — o pagamento deve ser feito por Boleto, não por PIX.",
        };
      }
      // A API da Stark valida `due` como ISO UTC explícito. Offsets locais como
      // `-03:00` podem ser rejeitados com invalidDate em alguns endpoints/ambientes.
      const dueIso = dueEnd.toISOString().replace("Z", "+00:00");


      const invoice = await createInvoice({
        installmentId: data.installmentId,
        amount: total,
        payer: { taxId: payerDoc, name: payerName },
        due: dueIso,
        expirationSeconds: 86400,
        fine: 2,
        interest: 1,
        descriptions: [
          { key: "Aluguel", value: `Parcela ${data.installmentId.slice(0, 8)}` },
        ],
      });

      await supabaseAdmin.from("stark_charges").upsert({
        installment_id: data.installmentId,
        manager_user_id: managerUserId,
        kind: "pix",
        status: "created",
        amount: total,
        txid: invoice.id,
        stark_id: invoice.id,
        brcode: invoice.brcode,
        qrcode_image_url: invoice.link ?? null,
        external_id: invoice.externalId,
      } as any, { onConflict: "external_id" } as any);

      // QR Code oficial da Stark (PNG binário)
      const png = await getInvoiceQrCodePng(invoice.id);
      const b64 = btoa(String.fromCharCode(...png));

      return {
        ok: true,
        provider: "stark",
        qrCodeBase64: b64,
        pixPayload: invoice.brcode,
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
  .handler(async ({ data }): Promise<{ paid: boolean; status?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: inst } = await supabaseAdmin
        .from("installments")
        .select("status")
        .eq("id", data.installmentId)
        .maybeSingle();
      if ((inst as any)?.status === "pago") return { paid: true, status: "pago" };

      const { data: charge } = await supabaseAdmin
        .from("stark_charges")
        .select("stark_id")
        .eq("installment_id", data.installmentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const starkId = (charge as any)?.stark_id;
      if (!starkId) return { paid: false };

      const { confirmChargePaid } = await import("@/lib/stark/webhook.server");
      await confirmChargePaid({ starkId, kind: "pix" });

      const { data: inst2 } = await supabaseAdmin
        .from("installments")
        .select("status")
        .eq("id", data.installmentId)
        .maybeSingle();
      return { paid: (inst2 as any)?.status === "pago", status: (inst2 as any)?.status };
    } catch (e: any) {
      return { paid: false, status: e?.message ?? "erro" };
    }
  });

export const generateBoletoCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async (): Promise<BoletoResult> => {
    return { ok: false, error: "Boleto Stark ainda não habilitado — em breve." };
  });
