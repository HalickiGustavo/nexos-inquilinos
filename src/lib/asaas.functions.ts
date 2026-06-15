import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Build Asaas split[] using explicit fixedValue for auditability.
// - Owner receives baseValue + lateCharges (rent + fines).
// - NEXO receives nexoFee (platform fixed fee).
// When the payment is processed under the NEXO master key, the owner entry is
// enough — the residual stays in master (which is NEXO). When NEXO has a
// dedicated wallet distinct from master/owner, push an explicit entry so the
// fee lands in that specific subaccount instead of as silent residual.
function buildSplitEntries(opts: {
  ownerWalletId: string | null;
  ownerShare: number;
  nexoWalletId: string | null;
  nexoFee: number;
  totalValue: number;
  paidViaOwnerKey: boolean;
}): Array<{ walletId: string; fixedValue: number }> {
  const entries: Array<{ walletId: string; fixedValue: number }> = [];
  const { ownerWalletId, ownerShare, nexoWalletId, nexoFee, totalValue, paidViaOwnerKey } = opts;
  if (ownerWalletId && ownerShare > 0 && ownerShare < totalValue) {
    entries.push({ walletId: ownerWalletId, fixedValue: +ownerShare.toFixed(2) });
  }
  // Send explicit NEXO entry when:
  //  - we have a wallet configured,
  //  - the fee is positive and fits the total,
  //  - AND it differs from the owner wallet (don't double-split to same wallet).
  //  - OR the charge is being made via the owner's key (then NEXO needs an
  //    explicit destination because the residual would stay in the owner subaccount).
  const nexoDiffersOwner = nexoWalletId && nexoWalletId !== ownerWalletId;
  const shouldEmitNexo =
    nexoWalletId && nexoFee > 0 && nexoFee < totalValue && (paidViaOwnerKey || nexoDiffersOwner);
  if (shouldEmitNexo) {
    entries.push({ walletId: nexoWalletId!, fixedValue: +nexoFee.toFixed(2) });
  }
  return entries;
}


// ===== Get current owner's Asaas account state =====
export const getAsaasAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("asaas_accounts")
      .select("id, user_id, asaas_account_id, wallet_id, status, onboarding_url, kyc_status, kyc_reference_id, bank_code, bank_agency, bank_account, bank_account_digit, bank_account_type, auto_transfer_enabled, created_at, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { account: data };
  });

// ===== Create Asaas subaccount for the current owner =====
const createSubaccountInput = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  cpfCnpj: z.string().min(11).max(20),
  mobilePhone: z.string().min(10).max(20).optional(),
  birthDate: z.string().optional(),
  companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]).optional(),
  address: z.string().min(2).max(200),
  addressNumber: z.string().min(1).max(20),
  province: z.string().min(2).max(120),
  postalCode: z.string().min(8).max(15),
});

export const createAsaasSubaccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSubaccountInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { asaasFetch } = await import("./asaas.server");

    const existing = await supabase
      .from("asaas_accounts")
      .select("id, asaas_account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.data?.asaas_account_id) {
      throw new Error("Já existe uma subconta Asaas para este usuário.");
    }

    const payload: Record<string, unknown> = {
      name: data.name,
      email: data.email,
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
      address: data.address,
      addressNumber: data.addressNumber,
      province: data.province,
      postalCode: data.postalCode.replace(/\D/g, ""),
    };
    if (data.mobilePhone) payload.mobilePhone = data.mobilePhone.replace(/\D/g, "");
    if (data.birthDate) payload.birthDate = data.birthDate;
    if (data.companyType) payload.companyType = data.companyType;

    const account = await asaasFetch<any>("/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("asaas_accounts")
      .upsert(
        {
          user_id: userId,
          asaas_account_id: account.id ?? null,
          wallet_id: account.walletId ?? null,
          api_key: account.apiKey ?? null,
          status: account.id ? "active" : "pending",
          onboarding_url: account.onboardingUrl ?? null,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    return {
      ok: true,
      walletId: account.walletId ?? null,
      onboardingUrl: account.onboardingUrl ?? null,
    };
  });

// ===== Generate boleto + Pix for an installment =====
const generateInput = z.object({
  installmentId: z.string().uuid(),
  billingType: z.enum(["BOLETO", "PIX", "UNDEFINED"]).default("UNDEFINED"),
});

export const generateAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => generateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { asaasFetch, getNexoFee, getNexoWalletId } = await import("./asaas.server");

    const inst = await supabase
      .from("installments")
      .select("*, contract:contracts(*, tenant:tenants(*), property:properties(*))")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (inst.error) throw new Error(inst.error.message);
    if (!inst.data) throw new Error("Parcela não encontrada");
    // Idempotência local: se já gerou boleto, retorna o existente em vez de criar outro.
    if (inst.data.asaas_payment_id) {
      return {
        ok: true,
        paymentId: inst.data.asaas_payment_id,
        value: Number(inst.data.amount) + Number(inst.data.extra_fees ?? 0) + Number(inst.data.late_charges ?? 0),
        lateCharges: Number(inst.data.late_charges ?? 0),
        deduplicated: true as const,
      };
    }

    const contract = (inst.data as any).contract;
    const tenant = contract?.tenant;
    const property = contract?.property;
    if (!tenant) throw new Error("Contrato sem inquilino vinculado");
    const contractPayoutWalletId: string | null = contract?.payout_wallet_id ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key, status, wallet_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (acc.error) throw new Error(acc.error.message);
    const nexoWallet = getNexoWalletId();
    const payoutWalletId: string | null = contractPayoutWalletId || acc.data?.wallet_id || null;
    const shouldSplitToOwner = Boolean(payoutWalletId && payoutWalletId !== nexoWallet);
    // When we have an owner payout wallet, charge through NEXO master and split to that wallet.
    // If no payout wallet exists, fall back to the owner's subaccount key when available.
    const ownerApiKey = shouldSplitToOwner ? undefined : (acc.data?.api_key || undefined);

    const customerRow = await supabase
      .from("asaas_customers")
      .select("asaas_customer_id")
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    let customerId = customerRow.data?.asaas_customer_id ?? null;
    if (!customerId) {
      if (!tenant.document) throw new Error("Inquilino sem CPF/CNPJ cadastrado");
      const customer = await asaasFetch<any>("/customers", {
        method: "POST",
        apiKey: ownerApiKey,
        body: JSON.stringify({
          name: tenant.full_name,
          cpfCnpj: String(tenant.document).replace(/\D/g, ""),
          email: tenant.email ?? undefined,
          mobilePhone: tenant.phone ? String(tenant.phone).replace(/\D/g, "") : undefined,
          externalReference: tenant.id,
        }),
      });
      customerId = customer.id;
      await supabaseAdmin.from("asaas_customers").insert({
        user_id: userId,
        tenant_id: tenant.id,
        asaas_customer_id: customerId as string,
      });
    }

    const { data: setting } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "nexo_boleto_fee")
      .maybeSingle();
    const nexoFee = setting?.value ? Number(setting.value) : getNexoFee();
    const baseValue = Number(inst.data.amount) + Number(inst.data.extra_fees ?? 0);

    // Cálculo de juros/multa por atraso
    const todayStr = new Date().toISOString().slice(0, 10);
    const originalDue = inst.data.due_date as string;
    const isOverdue = originalDue < todayStr;
    const daysLate = isOverdue
      ? Math.max(0, Math.floor((Date.parse(todayStr) - Date.parse(originalDue)) / 86400000))
      : 0;
    const finePct = Number(contract?.late_fee_percent ?? 0);
    // O campo daily_interest_percent armazena o juros MENSAL do contrato
    // (padrão BR: ~1% a.m.). Convertemos para diário pro-rata (÷30).
    const monthlyInterestPct = Number(contract?.daily_interest_percent ?? 0);
    const dailyPct = monthlyInterestPct / 30;
    const fine = isOverdue ? +(baseValue * finePct / 100).toFixed(2) : 0;
    const interest = isOverdue ? +(baseValue * dailyPct / 100 * daysLate).toFixed(2) : 0;
    const lateCharges = +(fine + interest).toFixed(2);

    // A taxa NEXO é SEMPRE somada ao aluguel (não é deduzida do valor do proprietário).
    // O inquilino paga baseValue + encargos + nexoFee; o proprietário recebe baseValue+encargos via split; NEXO fica com a taxa.
    const addFee = nexoFee > 0 && (payoutWalletId || nexoWallet);
    const value = +(baseValue + lateCharges + (addFee ? nexoFee : 0)).toFixed(2);
    const effectiveDueDate = isOverdue ? todayStr : originalDue;
    const lateNote = isOverdue
      ? ` (venc. original ${originalDue}, ${daysLate} dia(s) de atraso: multa R$ ${fine.toFixed(2)} + juros R$ ${interest.toFixed(2)})`
      : "";

    const body: Record<string, unknown> = {
      customer: customerId as string,
      billingType: data.billingType,
      value,
      dueDate: effectiveDueDate,
      description: `Aluguel — ${property?.nickname ?? ""} — venc. ${originalDue}${lateNote}${addFee ? ` (inclui taxa NEXO de R$ ${nexoFee.toFixed(2)})` : ""}`,
      externalReference: inst.data.id,
    };
    const splitEntries = buildSplitEntries({
      ownerWalletId: shouldSplitToOwner ? payoutWalletId : null,
      ownerShare: +(baseValue + lateCharges).toFixed(2),
      nexoWalletId: nexoWallet,
      nexoFee,
      totalValue: value,
      paidViaOwnerKey: Boolean(ownerApiKey),
    });
    if (splitEntries.length > 0) body.split = splitEntries;


    // Idempotência remota: antes de POST /payments, checa se o Asaas já tem
    // uma cobrança com este externalReference (parcela id). Evita duplicar quando
    // o cliente reenviar a requisição (retry, double-click, race condition).
    let payment: any = null;
    try {
      const existingList = await asaasFetch<any>(
        `/payments?externalReference=${encodeURIComponent(inst.data.id)}&limit=1`,
        { apiKey: ownerApiKey },
      );
      if (existingList?.data?.length > 0) {
        payment = existingList.data[0];
      }
    } catch { /* segue e tenta criar */ }

    if (!payment) {
      payment = await asaasFetch<any>("/payments", {
        method: "POST",
        apiKey: ownerApiKey,
        body: JSON.stringify(body),
      });
    }

    let pix: { encodedImage?: string; payload?: string } = {};
    try {
      pix = await asaasFetch<any>(`/payments/${payment.id}/pixQrCode`, { apiKey: ownerApiKey });
    } catch { /* boleto-only */ }

    const upd = await supabaseAdmin
      .from("installments")
      .update({
        asaas_payment_id: payment.id,
        boleto_url: payment.bankSlipUrl ?? payment.invoiceUrl ?? null,
        barcode: payment.identificationField ?? null,
        pix_qrcode: pix.encodedImage ?? null,
        pix_payload: pix.payload ?? null,
        late_charges: lateCharges,
      })
      .eq("id", inst.data.id);
    if (upd.error) throw new Error(upd.error.message);

    return { ok: true, paymentId: payment.id, value, lateCharges };
  });


// ===== Update existing Asaas charge (apply NEXO fee retroactively) =====
const updateInput = z.object({ installmentId: z.string().uuid() });

export const updateAsaasChargeFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { asaasFetch, getNexoFee, getNexoWalletId } = await import("./asaas.server");

    const inst = await supabase
      .from("installments")
      .select("id, amount, extra_fees, asaas_payment_id, due_date, status, contract:contracts(late_fee_percent, daily_interest_percent, payout_wallet_id)")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (inst.error) throw new Error(inst.error.message);
    if (!inst.data?.asaas_payment_id) throw new Error("Parcela ainda não possui boleto.");
    if (inst.data.status === "pago") throw new Error("Parcela já foi paga.");

    const contract = (inst.data as any).contract;
    const contractPayoutWalletId: string | null = contract?.payout_wallet_id ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key, wallet_id")
      .eq("user_id", userId)
      .maybeSingle();
    const nexoWallet = getNexoWalletId();
    const payoutWalletId: string | null = contractPayoutWalletId || acc.data?.wallet_id || null;
    const shouldSplitToOwner = Boolean(payoutWalletId && payoutWalletId !== nexoWallet);
    const ownerApiKey = shouldSplitToOwner ? undefined : (acc.data?.api_key || undefined);

    const { data: setting } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "nexo_boleto_fee")
      .maybeSingle();
    const nexoFee = setting?.value ? Number(setting.value) : getNexoFee();
    if (!payoutWalletId && (!nexoWallet || nexoFee <= 0)) throw new Error("Taxa NEXO não configurada.");

    const baseValue = Number(inst.data.amount) + Number(inst.data.extra_fees ?? 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const originalDue = inst.data.due_date as string;
    const isOverdue = originalDue < todayStr;
    const daysLate = isOverdue
      ? Math.max(0, Math.floor((Date.parse(todayStr) - Date.parse(originalDue)) / 86400000))
      : 0;
    const finePct = Number(contract?.late_fee_percent ?? 0);
    const dailyPct = Number(contract?.daily_interest_percent ?? 0);
    const fine = isOverdue ? +(baseValue * finePct / 100).toFixed(2) : 0;
    const interest = isOverdue ? +(baseValue * dailyPct / 100 * daysLate).toFixed(2) : 0;
    const lateCharges = +(fine + interest).toFixed(2);
    // Taxa NEXO sempre somada ao aluguel
    const value = +(baseValue + lateCharges + nexoFee).toFixed(2);
    const effectiveDueDate = isOverdue ? todayStr : originalDue;

    const body: Record<string, unknown> = {
      value,
      dueDate: effectiveDueDate,
    };
    const splitEntries = buildSplitEntries({
      ownerWalletId: shouldSplitToOwner ? payoutWalletId : null,
      ownerShare: +(baseValue + lateCharges).toFixed(2),
      nexoWalletId: nexoWallet,
      nexoFee,
      totalValue: value,
      paidViaOwnerKey: Boolean(ownerApiKey),
    });
    if (splitEntries.length > 0) body.split = splitEntries;


    const payment = await asaasFetch<any>(`/payments/${inst.data.asaas_payment_id}`, {
      method: "PUT",
      apiKey: ownerApiKey,
      body: JSON.stringify(body),
    });

    await supabaseAdmin
      .from("installments")
      .update({
        boleto_url: payment.bankSlipUrl ?? payment.invoiceUrl ?? null,
        barcode: payment.identificationField ?? null,
        late_charges: lateCharges,
      })
      .eq("id", inst.data.id);

    return { ok: true, value, lateCharges };
  });

// ===== Simulate sandbox payment through credit card gateway (triggers split) =====
const simulateInput = z.object({ installmentId: z.string().uuid() });

export const simulateAsaasPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => simulateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { asaasFetch, getNexoFee, getNexoWalletId } = await import("./asaas.server");

    const inst = await supabase
      .from("installments")
      .select("id, amount, extra_fees, late_charges, asaas_payment_id, due_date, status, contract:contracts(payout_wallet_id, tenant:tenants(full_name, email, document, phone))")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (inst.error) throw new Error(inst.error.message);
    if (!inst.data) throw new Error("Parcela não encontrada");
    if (inst.data.status === "pago") throw new Error("Parcela já está paga.");

    // Auto-gera a cobrança no Asaas caso ainda não exista.
    if (!inst.data.asaas_payment_id) {
      await generateAsaasCharge({ data: { installmentId: data.installmentId } });
      const refreshed = await supabase
        .from("installments")
        .select("asaas_payment_id")
        .eq("id", data.installmentId)
        .maybeSingle();
      (inst.data as any).asaas_payment_id = refreshed.data?.asaas_payment_id ?? null;
      if (!(inst.data as any).asaas_payment_id) {
        throw new Error("Falha ao gerar cobrança no Asaas para simulação.");
      }
    }

    const contract = (inst.data as any).contract;
    const tenant = contract?.tenant;
    const contractPayoutWalletId: string | null = contract?.payout_wallet_id ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key, wallet_id")
      .eq("user_id", userId)
      .maybeSingle();
    const nexoWallet = getNexoWalletId();
    const payoutWalletId: string | null = contractPayoutWalletId || acc.data?.wallet_id || null;
    const shouldSplitToOwner = Boolean(payoutWalletId && payoutWalletId !== nexoWallet);
    const ownerApiKey = shouldSplitToOwner ? undefined : (acc.data?.api_key || undefined);

    // Muda billingType para CREDIT_CARD para permitir pagamento via cartão sandbox.
    // Esse fluxo passa pelo gateway → executa split (Azure recebe sua parte,
    // NEXO recebe a taxa). Diferente de receiveInCash, que NÃO dispara split.
    const current = await asaasFetch<any>(`/payments/${inst.data.asaas_payment_id}`, {
      method: "GET",
      apiKey: ownerApiKey,
    });
    const value = Number(current.value);
    const { data: setting } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "nexo_boleto_fee")
      .maybeSingle();
    const nexoFee = setting?.value ? Number(setting.value) : getNexoFee();
    const paymentUpdate: Record<string, unknown> = { billingType: "CREDIT_CARD" };
    const simSplit = buildSplitEntries({
      ownerWalletId: shouldSplitToOwner ? payoutWalletId : null,
      ownerShare: +(value - nexoFee).toFixed(2),
      nexoWalletId: nexoWallet,
      nexoFee,
      totalValue: value,
      paidViaOwnerKey: Boolean(ownerApiKey),
    });
    if (simSplit.length > 0) paymentUpdate.split = simSplit;

    await asaasFetch<any>(`/payments/${inst.data.asaas_payment_id}`, {
      method: "PUT",
      apiKey: ownerApiKey,
      body: JSON.stringify(paymentUpdate),
    });

    if (!tenant?.full_name || !tenant?.document) {
      throw new Error("Inquilino sem nome ou CPF/CNPJ — não é possível simular cartão.");
    }

    // Cartão de teste do sandbox Asaas (aprova automaticamente).
    // Docs: https://docs.asaas.com/docs/cobrancas-com-cartao-de-credito-sandbox
    const cleanDoc = String(tenant.document).replace(/\D/g, "");
    const cleanPhone = tenant.phone ? String(tenant.phone).replace(/\D/g, "") : "11999999999";
    const cleanCep = tenant.postal_code ? String(tenant.postal_code).replace(/\D/g, "") : "01001000";

    const ccPayload = {
      creditCard: {
        holderName: tenant.full_name,
        number: "5162306219378829",
        expiryMonth: "05",
        expiryYear: "2028",
        ccv: "318",
      },
      creditCardHolderInfo: {
        name: tenant.full_name,
        email: tenant.email || "sandbox+tenant@nexo.test",
        cpfCnpj: cleanDoc,
        postalCode: cleanCep,
        addressNumber: "0",
        phone: cleanPhone,
      },
    };

    await asaasFetch<any>(`/payments/${inst.data.asaas_payment_id}/payWithCreditCard`, {
      method: "POST",
      apiKey: ownerApiKey,
      body: JSON.stringify(ccPayload),
    });

    await supabaseAdmin
      .from("installments")
      .update({
        status: "pago",
        paid_amount: value,
        payment_date: new Date().toISOString(),
      })
      .eq("id", inst.data.id);

    return { ok: true, value };
  });




// ===== Invite a tenant to register on the platform =====
const inviteInput = z.object({
  tenantId: z.string().uuid(),
  // redirectUrl is accepted but the origin is validated server-side against
  // an allowlist to prevent open-redirect / phishing via the invite email.
  redirectUrl: z.string().url(),
});

// Allowed origins for invite/magic-link redirects. Tenant-supplied URLs whose
// origin is not in this list are rejected to defeat token-harvesting phishing.
function getAllowedRedirectOrigins(): string[] {
  const raw = [
    process.env.APP_ORIGIN,
    process.env.VITE_APP_ORIGIN,
    "https://nexos-inquilinos.lovable.app",
  ].filter(Boolean) as string[];
  return Array.from(new Set(raw));
}

export const inviteTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Validate redirect origin against allowlist (open-redirect defense).
    let safeRedirect: string;
    try {
      const parsed = new URL(data.redirectUrl);
      const allowed = getAllowedRedirectOrigins();
      if (!allowed.includes(parsed.origin)) {
        throw new Error(`redirectUrl origin não permitido: ${parsed.origin}`);
      }
      // Force the path to /tenant-setup regardless of what the client sent —
      // we only trust the origin, never the full path.
      parsed.pathname = "/tenant-setup";
      parsed.search = "";
      parsed.hash = "";
      safeRedirect = parsed.toString();
    } catch (e: any) {
      throw new Error(e?.message ?? "redirectUrl inválido");
    }

    const tenant = await supabase
      .from("tenants")
      .select("id, full_name, email")
      .eq("id", data.tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (tenant.error) throw new Error(tenant.error.message);
    if (!tenant.data) throw new Error("Inquilino não encontrado");
    if (!tenant.data.email) throw new Error("Inquilino sem e-mail cadastrado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(tenant.data.email, {
      redirectTo: safeRedirect,
      data: { full_name: tenant.data.full_name, tenant_invite: true },
    });
    if (error) {
      // If user already exists, send a magic link instead
      const link = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: tenant.data.email,
        options: { redirectTo: safeRedirect },
      });
      if (link.error) throw new Error(link.error.message);
    }
    return { ok: true };
  });


// ===== Link an authenticated user to a tenant record (called from /tenant-setup) =====
export const linkTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr) throw new Error(userErr.message);
    const email = userRes.user?.email?.toLowerCase();
    if (!email) throw new Error("Usuário sem e-mail");

    const { data: matched, error: mErr } = await supabaseAdmin
      .from("tenants")
      .select("id, user_id_link")
      .ilike("email", email);
    if (mErr) throw new Error(mErr.message);
    if (!matched || matched.length === 0) {
      return { ok: false, reason: "no_match" };
    }

    // Link all matching tenant rows
    const ids = matched.map((t) => t.id);
    const { error: updErr } = await supabaseAdmin
      .from("tenants")
      .update({ user_id_link: userId })
      .in("id", ids);
    if (updErr) throw new Error(updErr.message);

    // Replace any auto-assigned 'owner' role with 'tenant' for this user
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "tenant" });
    if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);

    return { ok: true, linked: ids.length };
  });

// ===== Get NEXO fee from Supabase settings =====
export const getNexoFeeSetting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await (supabaseAdmin as any)
        .from("platform_settings")
        .select("value")
        .eq("key", "nexo_boleto_fee")
        .maybeSingle();
      const fee = data?.value ? Number(data.value) : 24.99;
      return { fee };
    } catch {
      return { fee: 24.99 };
    }
  });

// ===== Tenant: ensure PIX charge exists for own installment (MASTER PIX + split) =====
const ensurePixInput = z.object({ installmentId: z.string().uuid() });

export const ensureTenantPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ensurePixInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { asaasFetch, getNexoFee, getNexoWalletId } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // RLS garante que o inquilino só vê suas próprias parcelas.
    const inst = await supabase
      .from("installments")
      .select("id, amount, extra_fees, late_charges, asaas_payment_id, pix_qrcode, pix_payload, boleto_url, due_date, status, contract:contracts(user_id, payout_wallet_id, late_fee_percent, daily_interest_percent, tenant:tenants(id, full_name, email, document, phone), property:properties(nickname))")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (inst.error) throw new Error(inst.error.message);
    if (!inst.data) throw new Error("Parcela não encontrada");
    if (inst.data.status === "pago") throw new Error("Parcela já está paga.");

    if (inst.data.asaas_payment_id && inst.data.pix_qrcode && inst.data.pix_payload) {
      return {
        ok: true,
        paymentId: inst.data.asaas_payment_id,
        pixQrCode: inst.data.pix_qrcode,
        pixPayload: inst.data.pix_payload,
        boletoUrl: inst.data.boleto_url ?? null,
      };
    }

    const contract = (inst.data as any).contract;
    const tenant = contract?.tenant;
    const property = contract?.property;
    if (!tenant) throw new Error("Contrato sem inquilino vinculado");
    const ownerUserId: string = contract.user_id;

    // SEMPRE usa a chave MASTER (sem ownerApiKey). Dinheiro entra na conta
    // MASTER e o split direciona a parte do aluguel para a wallet do proprietário.
    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("wallet_id")
      .eq("user_id", ownerUserId)
      .maybeSingle();
    const nexoWallet = getNexoWalletId();
    const payoutWalletId: string | null = contract?.payout_wallet_id || acc.data?.wallet_id || null;
    const shouldSplitToOwner = Boolean(payoutWalletId && payoutWalletId !== nexoWallet);

    const customerRow = await supabaseAdmin
      .from("asaas_customers")
      .select("asaas_customer_id")
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    let customerId = customerRow.data?.asaas_customer_id ?? null;
    if (!customerId) {
      if (!tenant.document) throw new Error("Inquilino sem CPF/CNPJ cadastrado");
      const customer = await asaasFetch<any>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: tenant.full_name,
          cpfCnpj: String(tenant.document).replace(/\D/g, ""),
          email: tenant.email ?? undefined,
          mobilePhone: tenant.phone ? String(tenant.phone).replace(/\D/g, "") : undefined,
          externalReference: tenant.id,
        }),
      });
      customerId = customer.id;
      await supabaseAdmin.from("asaas_customers").insert({
        user_id: ownerUserId,
        tenant_id: tenant.id,
        asaas_customer_id: customerId as string,
      });
    }

    const { data: setting } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "nexo_boleto_fee")
      .maybeSingle();
    const nexoFee = setting?.value ? Number(setting.value) : getNexoFee();
    const baseValue = Number(inst.data.amount) + Number(inst.data.extra_fees ?? 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const originalDue = inst.data.due_date as string;
    const isOverdue = originalDue < todayStr;
    const daysLate = isOverdue
      ? Math.max(0, Math.floor((Date.parse(todayStr) - Date.parse(originalDue)) / 86400000))
      : 0;
    const finePct = Number(contract?.late_fee_percent ?? 0);
    const monthlyInterestPct = Number(contract?.daily_interest_percent ?? 0);
    const dailyPct = monthlyInterestPct / 30;
    const fine = isOverdue ? +(baseValue * finePct / 100).toFixed(2) : 0;
    const interest = isOverdue ? +(baseValue * dailyPct / 100 * daysLate).toFixed(2) : 0;
    const lateCharges = +(fine + interest).toFixed(2);
    const addFee = nexoFee > 0 && (payoutWalletId || nexoWallet);
    const value = +(baseValue + lateCharges + (addFee ? nexoFee : 0)).toFixed(2);
    const effectiveDueDate = isOverdue ? todayStr : originalDue;

    let paymentId = inst.data.asaas_payment_id as string | null;

    if (!paymentId) {
      try {
        const existingList = await asaasFetch<any>(
          `/payments?externalReference=${encodeURIComponent(inst.data.id)}&limit=1`,
        );
        if (existingList?.data?.length > 0) paymentId = existingList.data[0].id;
      } catch { /* segue */ }
    }

    if (!paymentId) {
      const body: Record<string, unknown> = {
        customer: customerId as string,
        billingType: "PIX",
        value,
        dueDate: effectiveDueDate,
        description: `Aluguel — ${property?.nickname ?? ""} — venc. ${originalDue}${addFee ? ` (inclui taxa NEXO de R$ ${nexoFee.toFixed(2)})` : ""}`,
        externalReference: inst.data.id,
      };
      const splitEntries = buildSplitEntries({
        ownerWalletId: shouldSplitToOwner ? payoutWalletId : null,
        ownerShare: +(baseValue + lateCharges).toFixed(2),
        nexoWalletId: nexoWallet,
        nexoFee,
        totalValue: value,
        paidViaOwnerKey: false, // tenant flow always uses MASTER key
      });
      if (splitEntries.length > 0) body.split = splitEntries;

      const created = await asaasFetch<any>("/payments", {
        method: "POST",
        body: JSON.stringify(body),
      });
      paymentId = created.id;
    } else {
      try {
        await asaasFetch<any>(`/payments/${paymentId}`, {
          method: "PUT",
          body: JSON.stringify({ billingType: "PIX", value, dueDate: effectiveDueDate }),
        });
      } catch { /* ignora */ }
    }

    const pix = await asaasFetch<any>(`/payments/${paymentId}/pixQrCode`);
    const paymentInfo = await asaasFetch<any>(`/payments/${paymentId}`);

    await supabaseAdmin
      .from("installments")
      .update({
        asaas_payment_id: paymentId,
        boleto_url: paymentInfo.bankSlipUrl ?? paymentInfo.invoiceUrl ?? null,
        pix_qrcode: pix.encodedImage ?? null,
        pix_payload: pix.payload ?? null,
        late_charges: lateCharges,
      })
      .eq("id", inst.data.id);

    return {
      ok: true,
      paymentId,
      pixQrCode: pix.encodedImage ?? null,
      pixPayload: pix.payload ?? null,
      boletoUrl: paymentInfo.bankSlipUrl ?? paymentInfo.invoiceUrl ?? null,
    };
  });

// ===== Configure landlord settlement bank account + auto-transfer =====
const bankAccountInput = z.object({
  bankCode: z.string().min(1).max(10),
  agency: z.string().min(1).max(10),
  account: z.string().min(1).max(20),
  accountDigit: z.string().min(1).max(3),
  accountType: z.enum(["CONTA_CORRENTE", "CONTA_POUPANCA"]),
  enableAutoTransfer: z.boolean().default(true),
});

export const linkAsaasBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bankAccountInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { asaasFetch } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key, asaas_account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (acc.error) throw new Error(acc.error.message);
    const apiKey = acc.data?.api_key;
    if (!apiKey) throw new Error("Subconta Asaas ainda não foi criada. Conclua o onboarding primeiro.");

    // 1) Vincular conta bancária de liquidação
    await asaasFetch<any>("/bankAccounts", {
      method: "POST",
      apiKey,
      body: JSON.stringify({
        bank: { code: data.bankCode },
        agency: data.agency.replace(/\D/g, ""),
        account: data.account.replace(/\D/g, ""),
        accountDigit: data.accountDigit.replace(/\D/g, ""),
        bankAccountType: data.accountType,
      }),
    });

    // 2) Configurar transferência automática
    if (data.enableAutoTransfer) {
      try {
        await asaasFetch<any>("/accountConfiguration", {
          method: "POST",
          apiKey,
          body: JSON.stringify({
            autoTransferEnabled: true,
            autoTransferFrequency: "DAILY",
          }),
        });
      } catch (e: any) {
        // Sandbox pode não suportar — não derrubar o fluxo, só logar
        console.warn("[Asaas] accountConfiguration falhou:", e?.message);
      }
    }

    const upd = await supabaseAdmin
      .from("asaas_accounts")
      .update({
        bank_code: data.bankCode,
        bank_agency: data.agency,
        bank_account: data.account,
        bank_account_digit: data.accountDigit,
        bank_account_type: data.accountType,
        auto_transfer_enabled: data.enableAutoTransfer,
      })
      .eq("user_id", userId);
    if (upd.error) throw new Error(upd.error.message);

    return { ok: true };
  });

// ===== KYC document pass-through upload (NEVER persisted locally) =====
// Aceita base64 do arquivo, transcodifica em memória e faz stream para o Asaas.
// O arquivo NÃO é salvo em disco, Storage, nem em nenhuma tabela.
const kycInput = z.object({
  documentType: z.enum(["IDENTIFICATION", "ADDRESS", "SELFIE", "ENTREPRENEUR_DOCUMENT"]),
  filename: z.string().min(1).max(160),
  mimeType: z.enum(["image/jpeg", "image/png", "image/jpg", "application/pdf"]),
  base64: z.string().min(10).max(8_500_000), // ~6MB binário após decode
});

export const uploadAsaasKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => kycInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { ASAAS_BASE_URL } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key")
      .eq("user_id", userId)
      .maybeSingle();
    if (acc.error) throw new Error(acc.error.message);
    const apiKey = acc.data?.api_key;
    if (!apiKey) throw new Error("Subconta Asaas ainda não foi criada. Conclua o onboarding primeiro.");

    // Decodifica base64 em memória → Uint8Array (sem tocar em disco/Storage).
    let bytes: Uint8Array;
    try {
      const bin = atob(data.base64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      throw new Error("Arquivo inválido: falha ao decodificar base64.");
    }
    // Limite defensivo de 5MB (em bytes decodificados)
    if (bytes.byteLength > 5 * 1024 * 1024) {
      throw new Error("Arquivo excede 5MB.");
    }

    // Monta multipart e faz pass-through direto para o Asaas
    const form = new FormData();
    form.append("type", data.documentType);
    form.append("documentFile", new Blob([bytes], { type: data.mimeType }), data.filename);

    const res = await fetch(`${ASAAS_BASE_URL}/myAccount/documents`, {
      method: "POST",
      headers: { access_token: apiKey, "User-Agent": "Nexo/1.0" },
      body: form,
    });
    // Liberar buffer imediatamente
    // @ts-expect-error - GC hint
    bytes = undefined;

    const text = await res.text();
    const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
    if (!res.ok) {
      const msg =
        (body && typeof body === "object" && Array.isArray((body as any).errors)
          ? (body as any).errors.map((e: any) => e.description).join("; ")
          : null) || `Asaas ${res.status}`;
      throw new Error(msg);
    }

    const referenceId =
      (body && typeof body === "object" && ((body as any).id ?? (body as any).reference)) || null;

    await supabaseAdmin
      .from("asaas_accounts")
      .update({
        kyc_status: "EM_ANALISE",
        kyc_reference_id: referenceId ?? null,
      })
      .eq("user_id", userId);

    return { ok: true, referenceId };
  });
