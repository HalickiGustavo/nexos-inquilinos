// Emite Boleto Efí Bank (API Cobranças) para uma parcela.
// Substitui o emissor Stark. A API Efí devolve URL pública do PDF (sem auth),
// então o inquilino pode abrir direto — sem proxy.

import { efiBoletoCreate, efiBoletoGet, isEfiConfigured } from "./efi.server";

export type IssueBoletoResult =
  | {
      ok: true;
      alreadyExisted: boolean;
      chargeId: number;
      barcode: string;
      pdfUrl: string;
      link: string;
    }
  | { ok: false; error: string };

function normDoc(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

// Retorna data no fmt YYYY-MM-DD garantindo que seja >= amanhã (Efí rejeita hoje).
function safeExpireAt(dueISO: string): string {
  const [y, m, d] = dueISO.split("-").map(Number);
  const due = new Date(Date.UTC(y, m - 1, d));
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const chosen = due >= tomorrow ? due : tomorrow;
  return chosen.toISOString().slice(0, 10);
}

export async function issueBoletoForInstallmentEfi(installmentId: string): Promise<IssueBoletoResult> {
  if (!isEfiConfigured()) return { ok: false, error: "Efí não configurado" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Já existe boleto Efí ativo para essa parcela?
  const { data: existing } = await supabaseAdmin
    .from("efi_charges")
    .select("txid, raw, status")
    .eq("installment_id", installmentId)
    .eq("kind", "boleto")
    .in("status", ["created", "paid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && (existing as any).txid) {
    const chargeId = Number((existing as any).txid);
    try {
      const res = await efiBoletoGet(chargeId);
      const p: any = (existing as any).raw ?? {};
      return {
        ok: true,
        alreadyExisted: true,
        chargeId,
        barcode: res.data?.barcode ?? p.barcode ?? "",
        pdfUrl: res.data?.pdf?.charge ?? p.pdfUrl ?? "",
        link: res.data?.link ?? p.link ?? "",
      };
    } catch {
      /* segue para recriar */
    }
  }

  const { data: inst, error } = await supabaseAdmin
    .from("installments")
    .select(
      "id, amount, due_date, contract_id, user_id, contract:contracts(id, user_id, tenant:tenants(full_name, document, email, phone))",
    )
    .eq("id", installmentId)
    .maybeSingle();
  if (error || !inst) return { ok: false, error: "Parcela não encontrada" };

  const contract = (inst as any).contract;
  const tenant = contract?.tenant;
  if (!tenant) return { ok: false, error: "Inquilino não encontrado" };

  const taxId = normDoc(tenant.document);
  if (taxId.length !== 11 && taxId.length !== 14) {
    return { ok: false, error: "Inquilino sem CPF/CNPJ válido" };
  }

  // Nexo cobra taxa fixa para boleto
  const { data: feeRow } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "nexo_boleto_fee")
    .maybeSingle();
  const nexoFee = Number((feeRow as any)?.value ?? 24.99);
  const total = Number((inst as any).amount) + nexoFee;
  const valueCents = Math.round(total * 100);

  const dueDate = String((inst as any).due_date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { ok: false, error: "Data de vencimento inválida" };
  }
  const expireAt = safeExpireAt(dueDate);

  const name = String(tenant.full_name ?? "Inquilino").slice(0, 100);
  const phone = normDoc(tenant.phone).slice(0, 20) || undefined;

  const customer: any = { name };
  if (taxId.length === 11) customer.cpf = taxId;
  else customer.juridical_person = { corporate_name: name, cnpj: taxId };
  if (phone) customer.phone_number = phone;
  if (tenant.email) customer.email = String(tenant.email);

  let created;
  try {
    created = await efiBoletoCreate({
      items: [{ name: `Aluguel - Parcela ${installmentId.slice(0, 8)}`, value: valueCents, amount: 1 }],
      payment: {
        banking_billet: {
          expire_at: expireAt,
          message: "Pagamento de aluguel via Nexo",
          customer,
          fine: 200,      // 2%
          interest: 100,  // 1% ao mês
        },
      },
    });
  } catch (e: any) {
    return { ok: false, error: `Efí rejeitou boleto: ${e?.message ?? String(e)}` };
  }

  const chargeId = created.data.charge_id;
  const pdfUrl = created.data.pdf?.charge ?? "";
  const barcode = created.data.barcode ?? "";
  const link = created.data.link ?? "";

  await supabaseAdmin.from("efi_charges").upsert(
    {
      installment_id: installmentId,
      manager_user_id: contract?.user_id ?? (inst as any).user_id,
      kind: "boleto",
      status: "created",
      amount: total,
      txid: String(chargeId),
      brcode: barcode,
      raw: { barcode, pdfUrl, link, expire_at: created.data.expire_at } as any,
    } as any,
    { onConflict: "txid" } as any,
  );

  await supabaseAdmin
    .from("installments")
    .update({
      boleto_url: pdfUrl,
      boleto_barcode: barcode,
      barcode,
      charge_provider: "efi",
    } as any)
    .eq("id", installmentId);

  return {
    ok: true,
    alreadyExisted: false,
    chargeId,
    barcode,
    pdfUrl,
    link,
  };
}
