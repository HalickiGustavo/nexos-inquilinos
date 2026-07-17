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

function toStarkUtcDue(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

// Stark exige CPF/CNPJ VÁLIDO (dígito verificador correto).
// Um documento com 11/14 dígitos porém checksum errado retorna
// "invalid tax id" da API — motivo comum do PIX não ser gerado.
function isValidCPF(cpf: string) {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (const c of base) sum += parseInt(c, 10) * factor--;
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === +cpf[9] && d2 === +cpf[10];
}

function isValidCNPJ(cnpj: string) {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 13), w2);
  return d1 === +cnpj[12] && d2 === +cnpj[13];
}

function validateTaxId(doc: string): string | null {
  if (doc.length === 11) return isValidCPF(doc) ? null : "CPF inválido — verifique os dígitos.";
  if (doc.length === 14) return isValidCNPJ(doc) ? null : "CNPJ inválido — verifique os dígitos.";
  return "CPF/CNPJ com quantidade de dígitos inválida (esperado 11 para CPF ou 14 para CNPJ).";
}

// Nome do pagador para Stark: mínimo 2 caracteres, remove caracteres
// especiais problemáticos e garante ao menos uma letra.
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
      const { createInvoice, getInvoiceQrCodePng } = await import("@/lib/stark/charges.server");
      const { computeSplit } = await import("@/lib/stark/split-engine");
      const { isStarkConfigured } = await import("@/lib/stark/stark.server");
      const { isEfiConfigured } = await import("@/lib/efi/efi.server");
      const useEfi = isEfiConfigured() && !!process.env.EFI_PIX_KEY;
      if (!useEfi && !isStarkConfigured()) {
        return { ok: false, error: "Nenhum provedor PIX configurado (Efí ou Stark)." };
      }

      // Ownership check via RLS-scoped client — retorna null se o caller
      // (manager/landlord/tenant) não tem visibilidade da parcela.
      const { data: ownedInst, error: ownedErr } = await context.supabase
        .from("installments")
        .select("id")
        .eq("id", data.installmentId)
        .maybeSingle();
      if (ownedErr || !ownedInst) {
        return { ok: false, error: "Parcela não encontrada" };
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
        return { ok: false, error: "Parcela já paga — não é possível gerar nova cobrança." };
      }


      // Idempotência: reutiliza cobrança PIX ativa (created) da mesma parcela
      // para evitar múltiplas invoices concorrentes que dupliquem confirmações.
      const { data: existingCharge } = await supabaseAdmin
        .from("stark_charges")
        .select("stark_id, brcode, amount, external_id")
        .eq("installment_id", data.installmentId)
        .eq("kind", "pix")
        .eq("status", "created")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();


      const contract = (inst as any).contract;
      const property = contract?.property;
      const tenant = contract?.tenant;
      const managerUserId = contract?.user_id;
      const landlordId: string | null = property?.landlord_id ?? null;
      const pct = Number(property?.default_management_fee_percent ?? 10);

      const payerDoc = normalizeDoc(tenant?.document);
      const docError = validateTaxId(payerDoc);
      if (docError) {
        return { ok: false, error: `Inquilino sem CPF/CNPJ válido: ${docError} Atualize o cadastro do inquilino antes de gerar o PIX.` };
      }
      const payerName = sanitizePayerName(String(tenant?.full_name ?? ""));
      if (!payerName) {
        return { ok: false, error: "Nome do inquilino é obrigatório (mínimo 2 letras) para emitir a cobrança PIX." };
      }

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

      // ---- Efí branch ------------------------------------------------------
      // Quando EFI_* estão configurados, geramos via proxy mTLS (Deno) em
      // vez da Stark. Split/repasse fica para uma segunda fase (Pix Split Efí).
      if (useEfi) {
        try {
          const { createOrReuseEfiPix } = await import("@/lib/efi/cob.server");
          const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
          const efi = await createOrReuseEfiPix({
            installmentId: data.installmentId,
            amount: total,
            payer: { taxId: payerDoc, name: payerName },
            pixKey: process.env.EFI_PIX_KEY!,
            descriptions: [{ key: "Aluguel", value: `Parcela ${data.installmentId.slice(0, 8)}` }],
          });
          await admin.from("efi_charges" as any).upsert({
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
            provider: "stark",
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
            error: e?.message ?? "Falha ao gerar PIX na Efí.",
            debug: e?.body ? JSON.stringify(e.body).slice(0, 2000) : null,
          };
        }
      }
      // ---- /Efí branch -----------------------------------------------------


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
      const dueDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      // A Stark recomenda data simples para cobranças agendadas com juros/multa.
      // Mantemos UTC ISO como fallback para ambientes que exigem datetime.
      const dueUtcIso = toStarkUtcDue(dueEnd);


      const invoiceInput = {
        installmentId: data.installmentId,
        amount: total,
        payer: { taxId: payerDoc, name: payerName },
        due: dueDate,
        expirationSeconds: 86400,
        fine: 2,
        interest: 1,
        descriptions: [
          { key: "Aluguel", value: `Parcela ${data.installmentId.slice(0, 8)}` },
        ],
      };

      let invoice: any;
      let externalId: string;

      if (existingCharge && (existingCharge as any).stark_id) {
        // Reconfirma status na Stark — se ainda 'created', reutiliza.
        const { getInvoice } = await import("@/lib/stark/charges.server");
        const cur = await getInvoice((existingCharge as any).stark_id).catch(() => null);
        const st = cur?.invoice?.status;
        if (st === "created") {
          invoice = { id: (existingCharge as any).stark_id, brcode: (existingCharge as any).brcode ?? cur!.invoice.brcode, link: cur!.invoice.link };
          externalId = (existingCharge as any).external_id;
        } else if (st === "paid") {
          // Confirma no DB e retorna erro claro.
          const { confirmChargePaid } = await import("@/lib/stark/webhook.server");
          await confirmChargePaid({ starkId: (existingCharge as any).stark_id, kind: "pix" });
          return { ok: false, error: "Parcela já paga — não é possível gerar nova cobrança." };
        } else {
          // canceled/overdue/voided → marca no DB e segue para criar nova.
          await supabaseAdmin
            .from("stark_charges")
            .update({ status: st ?? "canceled" } as any)
            .eq("stark_id", (existingCharge as any).stark_id);
        }
      }

      if (!invoice) {
        try {
          invoice = await createInvoice(invoiceInput);
        } catch (err: any) {
          const invalidDue = JSON.stringify(err?.body ?? err?.message ?? err).includes("due");
          if (!invalidDue) throw err;
          invoice = await createInvoice({ ...invoiceInput, due: dueUtcIso });
        }
        externalId = invoice.externalId;

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
          external_id: externalId,
        } as any, { onConflict: "external_id" } as any);
      }

      // QR Code oficial da Stark (PNG binário) — busca sempre pelo id atual
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
  .handler(async ({ data, context }): Promise<{ paid: boolean; status?: string }> => {
    try {
      // Ownership check via RLS-scoped client
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
