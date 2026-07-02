// Emite Boleto Stark para uma parcela específica.
// Usado tanto pelo cron diário (15 dias antes do vencimento) quanto por
// chamadas manuais quando a parcela já está vencida.

import { createBoleto } from "./charges.server";
import { computeSplit } from "./split-engine";

export type IssueBoletoResult =
  | {
      ok: true;
      alreadyExisted: boolean;
      starkId: string;
      barcode: string;
      line: string;
      pdfUrl: string;
    }
  | { ok: false; error: string };

function normDoc(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}
function onlyDigits(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

export async function issueBoletoForInstallment(installmentId: string): Promise<IssueBoletoResult> {
  const { isStarkConfigured } = await import("./stark.server");
  if (!isStarkConfigured()) return { ok: false, error: "Stark não configurado" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Já existe boleto ativo para essa parcela?
  const { data: existing } = await supabaseAdmin
    .from("stark_charges")
    .select("stark_id, brcode, qrcode_image_url, status")
    .eq("installment_id", installmentId)
    .eq("kind", "boleto")
    .in("status", ["created", "paid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && (existing as any).stark_id) {
    const starkId = (existing as any).stark_id as string;
    const { getBoleto, getBoletoPdfUrl } = await import("./charges.server");
    const res = await getBoleto(starkId).catch(() => null);
    return {
      ok: true,
      alreadyExisted: true,
      starkId,
      barcode: res?.boleto?.barCode ?? "",
      line: res?.boleto?.line ?? "",
      pdfUrl: getBoletoPdfUrl(starkId),
    };
  }

  const { data: inst, error } = await supabaseAdmin
    .from("installments")
    .select(
      "id, amount, due_date, contract_id, user_id, contract:contracts(id, user_id, tenant:tenants(full_name, document), property:properties(id, address, neighborhood, city, state, zip_code, landlord_id, default_management_fee_percent))",
    )
    .eq("id", installmentId)
    .maybeSingle();
  if (error || !inst) return { ok: false, error: "Parcela não encontrada" };

  const contract = (inst as any).contract;
  const property = contract?.property;
  const tenant = contract?.tenant;
  if (!property) return { ok: false, error: "Imóvel não encontrado" };
  if (!tenant) return { ok: false, error: "Inquilino não encontrado" };

  const taxId = normDoc(tenant.document);
  if (taxId.length < 11) return { ok: false, error: "Inquilino sem CPF/CNPJ" };

  const zipDigits = onlyDigits(property.zip_code);
  if (zipDigits.length !== 8) return { ok: false, error: "CEP do imóvel inválido" };
  const zip = `${zipDigits.slice(0, 5)}-${zipDigits.slice(5)}`; // Stark exige @@@@@-@@@
  const stateCode = String(property.state ?? "").trim().toUpperCase().slice(0, 2);
  if (stateCode.length !== 2) return { ok: false, error: "Estado (UF) do imóvel ausente" };
  const city = String(property.city ?? "").trim();
  if (!city) return { ok: false, error: "Cidade do imóvel ausente" };
  const streetLine1 = String(property.address ?? "").trim();
  if (!streetLine1) return { ok: false, error: "Endereço do imóvel ausente" };
  const district = String(property.neighborhood ?? "Centro").trim() || "Centro";

  // Nexo cobra taxa fixa para boleto
  const { data: feeRow } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "nexo_boleto_fee")
    .maybeSingle();
  const nexoFee = Number((feeRow as any)?.value ?? 24.99);
  const total = Number((inst as any).amount) + nexoFee;

  const dueDate = String((inst as any).due_date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { ok: false, error: "Data de vencimento inválida" };
  }

  let boleto;
  try {
    boleto = await createBoleto({
      installmentId,
      amount: total,
      due: dueDate,
      payer: {
        name: String(tenant.full_name ?? "Inquilino").slice(0, 100),
        taxId,
        streetLine1: streetLine1.slice(0, 100),
        district: district.slice(0, 100),
        city: city.slice(0, 100),
        stateCode,
        zipCode: zip,
      },
      fine: 2,
      interest: 1,
      descriptions: [
        { text: `Aluguel - Parcela ${installmentId.slice(0, 8)}` },
      ],
    });
  } catch (e: any) {
    return { ok: false, error: `Stark rejeitou boleto: ${e?.message ?? String(e)}` };
  }


  const { getBoletoPdfUrl } = await import("./charges.server");
  const pdfUrl = getBoletoPdfUrl(boleto.id);

  await supabaseAdmin.from("stark_charges").upsert(
    {
      installment_id: installmentId,
      manager_user_id: contract?.user_id ?? (inst as any).user_id,
      kind: "boleto",
      status: "created",
      amount: total,
      txid: boleto.id,
      stark_id: boleto.id,
      brcode: boleto.line,
      qrcode_image_url: pdfUrl,
      external_id: boleto.externalId,
    } as any,
    { onConflict: "external_id" } as any,
  );

  await supabaseAdmin
    .from("installments")
    .update({
      boleto_url: pdfUrl,
      boleto_barcode: boleto.barCode,
      barcode: boleto.line,
      charge_provider: "stark",
      stark_charge_id: boleto.id,
    } as any)
    .eq("id", installmentId);

  // Log para split (registra qual quebra será feita no pagamento)
  try {
    computeSplit({
      paidAmount: total,
      nexoFee,
      managementFeePercent: Number(property?.default_management_fee_percent ?? 10),
      agencyPixKey: null,
      ownerPixKey: null,
      nexoPixKey: "",
    });
  } catch {
    /* split é opcional aqui — cai no fluxo normal do webhook `boleto` */
  }

  return {
    ok: true,
    alreadyExisted: false,
    starkId: boleto.id,
    barcode: boleto.barCode,
    line: boleto.line,
    pdfUrl,
  };
}
