import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// === Modelo B (cobrança na subconta + split para a wallet master) ===
// O boleto/Pix é emitido DENTRO da subconta do proprietário (landlord), usando
// a `api_key` armazenada em `asaas_accounts`. O saldo do aluguel permanece
// naturalmente na subconta que emitiu a cobrança; o split apenas transfere a
// taxa fixa da plataforma (NEXO) para a wallet master da Nexo.
function buildPlatformSplit(opts: {
  masterWalletId: string;
  nexoFee: number;
  totalValue: number;
}): Array<{ walletId: string; fixedValue: number }> {
  const { masterWalletId, nexoFee, totalValue } = opts;
  if (!masterWalletId || nexoFee <= 0 || nexoFee >= totalValue) return [];
  return [{ walletId: masterWalletId, fixedValue: +nexoFee.toFixed(2) }];
}

async function getLandlordAsaasCredentials(supabaseAdmin: any, landlordUserId: string) {
  const acc = await supabaseAdmin
    .from("asaas_accounts")
    .select("api_key, asaas_account_id, wallet_id, status")
    .eq("user_id", landlordUserId)
    .maybeSingle();
  if (acc.error) throw new Error(acc.error.message);
  const d = acc.data;
  if (!d?.api_key || !d?.asaas_account_id) {
    throw new Error("Imobiliária/Proprietário não possui subconta de recebimento configurada.");
  }
  return {
    apiKey: d.api_key as string,
    accountId: d.asaas_account_id as string,
    walletId: (d.wallet_id ?? null) as string | null,
  };
}

async function getMasterPlatformWalletId(supabaseAdmin: any): Promise<string> {
  const envWallet = process.env.NEXO_MASTER_WALLET_ID || process.env.ASAAS_NEXO_WALLET_ID;
  if (envWallet) return envWallet;
  const { data } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "nexo_wallet_id")
    .maybeSingle();
  if (data?.value) return String(data.value);
  throw new Error("Carteira master da plataforma não configurada (NEXO_MASTER_WALLET_ID).");
}

function mapAsaasError(e: any): Error {
  const status = e?.status;
  if (status === 401 || status === 403) {
    return new Error("Credenciais da subconta inválidas ou expiradas junto ao gateway.");
  }
  if (e instanceof Error) return e;
  return new Error(String(e?.message ?? e));
}


// ===== Get current owner's Asaas account state =====
export const getAsaasAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("asaas_accounts")
      .select("id, user_id, asaas_account_id, wallet_id, status, onboarding_url, kyc_status, kyc_reference_id, bank_code, bank_agency, bank_account, bank_account_digit, bank_account_type, auto_transfer_enabled, created_at, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Sincroniza CRON_SECRET no Vault de forma idempotente quando um
    // owner/manager autenticado acessa este endpoint. Mantém o cron job
    // funcional sem expor a chave anônima como segredo de autenticação.
    try {
      const secret = process.env.CRON_SECRET;
      if (secret) {
        const [{ data: isManager }, { data: isOwner }] = await Promise.all([
          supabase.rpc("has_role", { _user_id: userId, _role: "manager" as any }),
          supabase.rpc("has_role", { _user_id: userId, _role: "owner" as any }),
        ]);
        if (isManager || isOwner) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as any).rpc("sync_cron_secret", { _secret: secret });
        }
      }
    } catch (e) {
      console.warn("[cron-secret] sync skipped:", (e as any)?.message);
    }

    return { account: data };
  });



// ===== Create Asaas subaccount for the current owner =====
const createSubaccountInput = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  cpfCnpj: z.string().min(11).max(20),
  mobilePhone: z.string().min(10).max(20),
  birthDate: z.string().optional(),
  companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]).optional(),
  address: z.string().min(2).max(200),
  addressNumber: z.string().min(1).max(20),
  province: z.string().min(2).max(120),
  postalCode: z.string().min(8).max(15),
  incomeValue: z.coerce.number().positive(),
  // Conta bancária de liquidação — OPCIONAL no onboarding (modelo wallet-lite).
  // Pode ser cadastrada depois, pelo painel "Conta bancária e KYC", apenas quando
  // o usuário for sacar o saldo acumulado via split.
  bankCode: z.string().max(10).optional().or(z.literal("")),
  bankAgency: z.string().max(10).optional().or(z.literal("")),
  bankAccount: z.string().max(20).optional().or(z.literal("")),
  bankAccountDigit: z.string().max(3).optional().or(z.literal("")),
  bankAccountType: z.enum(["CONTA_CORRENTE", "CONTA_POUPANCA"]).optional(),
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

    const digits = data.mobilePhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11 || (digits.length === 11 && digits[2] !== "9")) {
      throw new Error("Informe um celular válido com DDD (ex.: 41 99999-9999).");
    }

    const payload: Record<string, unknown> = {
      name: data.name,
      email: data.email,
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
      mobilePhone: digits,
      incomeValue: Number(data.incomeValue),
      address: data.address,
      addressNumber: data.addressNumber,
      province: data.province,
      postalCode: data.postalCode.replace(/\D/g, ""),
    };
    if (data.birthDate) payload.birthDate = data.birthDate;
    if (data.companyType) payload.companyType = data.companyType;

    const account = await asaasFetch<any>("/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Vincula conta bancária + auto-transfer (best-effort).
    // No modelo wallet-lite os dados bancários são OPCIONAIS no onboarding.
    // Se não vierem, a subconta já fica apta a receber split; o usuário
    // completa os dados bancários depois no painel "Conta bancária e KYC"
    // quando quiser sacar o saldo acumulado.
    let bankWarning: string | null = null;
    const hasBankData = !!(
      data.bankCode &&
      data.bankAgency &&
      data.bankAccount &&
      data.bankAccountDigit &&
      data.bankAccountType
    );
    const newApiKey: string | null = account.apiKey ?? null;
    if (newApiKey && hasBankData) {
      try {
        await asaasFetch<any>("/bankAccounts", {
          method: "POST",
          apiKey: newApiKey,
          body: JSON.stringify({
            bank: { code: data.bankCode },
            agency: data.bankAgency!.replace(/\D/g, ""),
            account: data.bankAccount!.replace(/\D/g, ""),
            accountDigit: data.bankAccountDigit!.replace(/\D/g, ""),
            bankAccountType: data.bankAccountType,
          }),
        });
        try {
          await asaasFetch<any>("/accountConfiguration", {
            method: "POST",
            apiKey: newApiKey,
            body: JSON.stringify({ autoTransferEnabled: true, autoTransferFrequency: "DAILY" }),
          });
        } catch (e: any) {
          console.warn("[Asaas] accountConfiguration falhou:", e?.message);
        }
      } catch (e: any) {
        bankWarning = e?.message ?? "Falha ao vincular conta bancária — refaça pelo painel.";
      }
    }

    const persistBank = hasBankData && !bankWarning;
    const { error } = await supabaseAdmin
      .from("asaas_accounts")
      .upsert(
        {
          user_id: userId,
          asaas_account_id: account.id ?? null,
          wallet_id: account.walletId ?? null,
          api_key: newApiKey,
          status: account.id ? "active" : "pending",
          onboarding_url: account.onboardingUrl ?? null,
          bank_code: persistBank ? data.bankCode : null,
          bank_agency: persistBank ? data.bankAgency : null,
          bank_account: persistBank ? data.bankAccount : null,
          bank_account_digit: persistBank ? data.bankAccountDigit : null,
          bank_account_type: persistBank ? data.bankAccountType : null,
          auto_transfer_enabled: persistBank,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    return {
      ok: true,
      walletId: account.walletId ?? null,
      onboardingUrl: account.onboardingUrl ?? null,
      bankWarning,
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
    const { asaasFetch, getNexoFee } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const inst = await supabase
      .from("installments")
      .select("*, contract:contracts(*, tenant:tenants(*), property:properties(*))")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (inst.error) throw new Error(inst.error.message);
    if (!inst.data) throw new Error("Parcela não encontrada");
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

    // Modelo B: cobrança gerada DENTRO da subconta do landlord (context.userId).
    const landlord = await getLandlordAsaasCredentials(supabaseAdmin, userId);
    const masterWalletId = await getMasterPlatformWalletId(supabaseAdmin);

    try {
      const customerRow = await supabaseAdmin
        .from("asaas_customers")
        .select("asaas_customer_id")
        .eq("tenant_id", tenant.id)
        .eq("user_id", userId)
        .maybeSingle();

      let customerId = customerRow.data?.asaas_customer_id ?? null;

      // Valida customer cacheado — após reset de subconta o ID antigo
      // não existe mais e o Asaas devolve "Customer inválido ou não informado".
      if (customerId) {
        try {
          await asaasFetch<any>(`/customers/${customerId}`, { apiKey: landlord.apiKey });
        } catch {
          await supabaseAdmin
            .from("asaas_customers")
            .delete()
            .eq("tenant_id", tenant.id)
            .eq("user_id", userId);
          customerId = null;
        }
      }

      if (!customerId) {
        if (!tenant.document) throw new Error("Inquilino sem CPF/CNPJ cadastrado");
        const customer = await asaasFetch<any>("/customers", {
          method: "POST",
          apiKey: landlord.apiKey,
          body: JSON.stringify({
            name: tenant.full_name,
            cpfCnpj: String(tenant.document).replace(/\D/g, ""),
            email: tenant.email ?? undefined,
            mobilePhone: tenant.phone ? String(tenant.phone).replace(/\D/g, "") : undefined,
            externalReference: tenant.id,
          }),
        });
        customerId = customer.id;
        await supabaseAdmin.from("asaas_customers").upsert({
          user_id: userId,
          tenant_id: tenant.id,
          asaas_customer_id: customerId as string,
        }, { onConflict: "user_id,tenant_id" });
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

      const value = +(baseValue + lateCharges + nexoFee).toFixed(2);
      const effectiveDueDate = isOverdue ? todayStr : originalDue;
      const lateNote = isOverdue
        ? ` (venc. original ${originalDue}, ${daysLate} dia(s) de atraso: multa R$ ${fine.toFixed(2)} + juros R$ ${interest.toFixed(2)})`
        : "";

      const body: Record<string, unknown> = {
        customer: customerId as string,
        billingType: data.billingType,
        value,
        dueDate: effectiveDueDate,
        description: `Aluguel — ${property?.nickname ?? ""} — venc. ${originalDue}${lateNote} (inclui taxa NEXO de R$ ${nexoFee.toFixed(2)})`,
        externalReference: inst.data.id,
        externalMetadata: {
          installmentId: inst.data.id,
          contractId: contract?.id ?? null,
          landlordUserId: userId,
        },
      };
      const split = buildPlatformSplit({ masterWalletId, nexoFee, totalValue: value });
      if (split.length > 0) body.split = split;

      // Idempotência remota
      let payment: any = null;
      try {
        const existingList = await asaasFetch<any>(
          `/payments?externalReference=${encodeURIComponent(inst.data.id)}&limit=1`,
          { apiKey: landlord.apiKey },
        );
        if (existingList?.data?.length > 0) payment = existingList.data[0];
      } catch { /* segue e tenta criar */ }

      if (!payment) {
        payment = await asaasFetch<any>("/payments", {
          method: "POST",
          apiKey: landlord.apiKey,
          body: JSON.stringify(body),
        });
      }

      let pix: { encodedImage?: string; payload?: string } = {};
      try {
        pix = await asaasFetch<any>(`/payments/${payment.id}/pixQrCode`, { apiKey: landlord.apiKey });
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

      return { ok: true as const, paymentId: payment.id, value, lateCharges };
    } catch (e: any) {
      const mapped = mapAsaasError(e);
      // Erros de negócio do Asaas (ex.: "limite de emissão atingido") são
      // retornados como payload para que a UI possa orientar o usuário a
      // registrar o pagamento manualmente, em vez de quebrar a tela.
      return { ok: false as const, error: mapped.message };
    }
  });


// ===== Update existing Asaas charge (apply NEXO fee retroactively) =====
const updateInput = z.object({ installmentId: z.string().uuid() });

export const updateAsaasChargeFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: isManager }, { data: isOwner }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    ]);
    if (!isManager && !isOwner) throw new Error("Forbidden");
    const { asaasFetch, getNexoFee } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


    const inst = await supabase
      .from("installments")
      .select("id, amount, extra_fees, asaas_payment_id, due_date, status, contract:contracts(id, user_id, late_fee_percent, daily_interest_percent)")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (inst.error) throw new Error(inst.error.message);
    if (!inst.data?.asaas_payment_id) throw new Error("Parcela ainda não possui boleto.");
    if (inst.data.status === "pago") throw new Error("Parcela já foi paga.");

    const contract = (inst.data as any).contract;
    const landlordUserId: string = contract?.user_id ?? userId;
    const landlord = await getLandlordAsaasCredentials(supabaseAdmin, landlordUserId);
    const masterWalletId = await getMasterPlatformWalletId(supabaseAdmin);

    try {
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
      const dailyPct = Number(contract?.daily_interest_percent ?? 0) / 30;
      const fine = isOverdue ? +(baseValue * finePct / 100).toFixed(2) : 0;
      const interest = isOverdue ? +(baseValue * dailyPct / 100 * daysLate).toFixed(2) : 0;
      const lateCharges = +(fine + interest).toFixed(2);
      const value = +(baseValue + lateCharges + nexoFee).toFixed(2);
      const effectiveDueDate = isOverdue ? todayStr : originalDue;

      const body: Record<string, unknown> = {
        value,
        dueDate: effectiveDueDate,
        externalReference: inst.data.id,
        externalMetadata: {
          installmentId: inst.data.id,
          contractId: contract?.id ?? null,
          landlordUserId,
        },
      };
      const split = buildPlatformSplit({ masterWalletId, nexoFee, totalValue: value });
      if (split.length > 0) body.split = split;

      const payment = await asaasFetch<any>(`/payments/${inst.data.asaas_payment_id}`, {
        method: "PUT",
        apiKey: landlord.apiKey,
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

      const { recordAudit } = await import("./audit.server");
      await recordAudit({
        userId,
        userEmail: context.claims?.email ?? null,
        action: "asaas.charge.update",
        entity: "installments",
        entityId: inst.data.id,
        metadata: { paymentId: inst.data.asaas_payment_id, value, lateCharges, landlordUserId },
      });

      return { ok: true, value, lateCharges };
    } catch (e: any) {
      const { recordAudit } = await import("./audit.server");
      await recordAudit({
        userId,
        userEmail: context.claims?.email ?? null,
        action: "asaas.charge.update.error",
        entity: "installments",
        entityId: data.installmentId,
        metadata: { error: String(e?.message ?? e) },
      });
      throw mapAsaasError(e);
    }
  });


// ===== Simulate sandbox payment through credit card gateway (triggers split) =====
const simulateInput = z.object({ installmentId: z.string().uuid() });

export const simulateAsaasPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => simulateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { asaasFetch, getNexoFee } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorização: apenas manager/owner (landlord) pode acionar simulação.
    // Sem isso, qualquer inquilino autenticado poderia marcar a própria
    // parcela como paga em ambiente sandbox do Asaas.
    const [{ data: isManager }, { data: isOwner }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "manager" as any }),
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" as any }),
    ]);
    if (!isManager && !isOwner) {
      throw new Error("Forbidden: apenas proprietário/imobiliária pode simular pagamento.");
    }

    const inst = await supabase
      .from("installments")
      .select("id, amount, extra_fees, late_charges, asaas_payment_id, due_date, status, contract:contracts(id, user_id, tenant:tenants(full_name, email, document, phone))")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (inst.error) throw new Error(inst.error.message);
    if (!inst.data) throw new Error("Parcela não encontrada");
    if (inst.data.status === "pago") throw new Error("Parcela já está paga.");

    if (!inst.data.asaas_payment_id) {
      try {
        const gen: any = await generateAsaasCharge({ data: { installmentId: data.installmentId } });
        if (gen?.ok === false) {
          return { ok: false as const, error: gen.error ?? "Falha ao gerar cobrança no Asaas." };
        }
      } catch (e: any) {
        const mapped = mapAsaasError(e);
        return { ok: false as const, error: mapped.message };
      }
      const refreshed = await supabase
        .from("installments")
        .select("asaas_payment_id")
        .eq("id", data.installmentId)
        .maybeSingle();
      (inst.data as any).asaas_payment_id = refreshed.data?.asaas_payment_id ?? null;
      if (!(inst.data as any).asaas_payment_id) {
        return { ok: false as const, error: "Falha ao gerar cobrança no Asaas para simulação." };
      }
    }

    const contract = (inst.data as any).contract;
    const tenant = contract?.tenant;
    const landlordUserId: string = contract?.user_id ?? userId;
    const landlord = await getLandlordAsaasCredentials(supabaseAdmin, landlordUserId);
    const masterWalletId = await getMasterPlatformWalletId(supabaseAdmin);

    try {
      const current = await asaasFetch<any>(`/payments/${inst.data.asaas_payment_id}`, {
        method: "GET",
        apiKey: landlord.apiKey,
      });
      const value = Number(current.value);
      const { data: setting } = await (supabaseAdmin as any)
        .from("platform_settings")
        .select("value")
        .eq("key", "nexo_boleto_fee")
        .maybeSingle();
      const nexoFee = setting?.value ? Number(setting.value) : getNexoFee();
      const paymentUpdate: Record<string, unknown> = { billingType: "CREDIT_CARD" };
      const split = buildPlatformSplit({ masterWalletId, nexoFee, totalValue: value });
      if (split.length > 0) paymentUpdate.split = split;

      await asaasFetch<any>(`/payments/${inst.data.asaas_payment_id}`, {
        method: "PUT",
        apiKey: landlord.apiKey,
        body: JSON.stringify(paymentUpdate),
      });

      if (!tenant?.full_name || !tenant?.document) {
        throw new Error("Inquilino sem nome ou CPF/CNPJ — não é possível simular cartão.");
      }

      const cleanDoc = String(tenant.document).replace(/\D/g, "");
      const cleanPhone = tenant.phone ? String(tenant.phone).replace(/\D/g, "") : "11999999999";
      const cleanCep = (tenant as any).postal_code ? String((tenant as any).postal_code).replace(/\D/g, "") : "01001000";

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
        apiKey: landlord.apiKey,
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

      const { recordAudit } = await import("./audit.server");
      await recordAudit({
        userId,
        userEmail: context.claims?.email ?? null,
        action: "asaas.payment.simulate",
        entity: "installments",
        entityId: inst.data.id,
        metadata: { paymentId: inst.data.asaas_payment_id, value, landlordUserId },
      });

      return { ok: true as const, value };
    } catch (e: any) {
      const mapped = mapAsaasError(e);
      const { recordAudit } = await import("./audit.server");
      await recordAudit({
        userId,
        userEmail: context.claims?.email ?? null,
        action: "asaas.payment.simulate.error",
        entity: "installments",
        entityId: data.installmentId,
        metadata: { error: mapped.message },
      });
      return { ok: false as const, error: mapped.message };
    }
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
    "https://dashboard.usenexoapp.com",
    "https://usenexoapp.com",
    "https://www.usenexoapp.com",
  ].filter(Boolean) as string[];
  return Array.from(new Set(raw));
}


export const inviteTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let safeRedirect: string;
    try {
      const parsed = new URL(data.redirectUrl);
      const allowed = getAllowedRedirectOrigins();
      if (!allowed.includes(parsed.origin)) {
        throw new Error(`redirectUrl origin não permitido: ${parsed.origin}`);
      }
      parsed.pathname = "/tenant-setup";
      parsed.search = "";
      parsed.hash = "";
      safeRedirect = parsed.toString();
    } catch (e: any) {
      throw new Error(e?.message ?? "redirectUrl inválido");
    }

    const tenant = await supabase
      .from("tenants")
      .select("id, full_name, email, phone")
      .eq("id", data.tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (tenant.error) throw new Error(tenant.error.message);
    if (!tenant.data) throw new Error("Inquilino não encontrado");
    if (!tenant.data.phone) throw new Error("Inquilino sem telefone (necessário para enviar o convite por WhatsApp)");
    if (!tenant.data.email) throw new Error("Inquilino sem e-mail cadastrado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let actionLink: string | null = null;
    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(tenant.data.email, {
      redirectTo: safeRedirect,
      data: { full_name: tenant.data.full_name, tenant_invite: true },
    });
    if (invited.error) {
      const link = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: tenant.data.email,
        options: { redirectTo: safeRedirect },
      });
      if (link.error) throw new Error(link.error.message);
      actionLink = (link.data as any)?.properties?.action_link ?? null;
    } else {
      const link = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: tenant.data.email,
        options: { redirectTo: safeRedirect },
      });
      actionLink = (link.data as any)?.properties?.action_link ?? null;
    }

    try {
      const { sendEvolutionText } = await import("./whatsapp.server");
      const firstName = (tenant.data.full_name ?? "").split(" ")[0] || "olá";
      const text = actionLink
        ? `Olá, ${firstName}! 👋\n\nVocê foi convidado para acessar o *Portal do Inquilino da Nexo*.\n\nAcesse o link abaixo para configurar sua senha e finalizar o cadastro:\n\n${actionLink}\n\nQualquer dúvida, fale com a sua imobiliária.`
        : `Olá, ${firstName}! Você foi convidado para o Portal do Inquilino da Nexo. Verifique o e-mail ${tenant.data.email} para o link de acesso.`;
      const res = await sendEvolutionText({ phone: tenant.data.phone, text });
      if (!res.ok) {
        console.warn("[invite.tenant] whatsapp falhou:", res.reason);
        return { ok: true, whatsapp: false, reason: res.reason };
      }
    } catch (err: any) {
      console.warn("[invite.tenant] whatsapp erro:", err?.message);
      return { ok: true, whatsapp: false, reason: err?.message };
    }
    return { ok: true, whatsapp: true };
  });

// ===== Generate (only) a tenant invite link — no WhatsApp send =====
const generateInviteInput = z.object({
  tenantId: z.string().uuid(),
  redirectUrl: z.string().url(),
});

export const generateTenantInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => generateInviteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let safeRedirect: string;
    try {
      const parsed = new URL(data.redirectUrl);
      const allowed = getAllowedRedirectOrigins();
      if (!allowed.includes(parsed.origin)) {
        throw new Error(`redirectUrl origin não permitido: ${parsed.origin}`);
      }
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

    // Try invite first (creates user if needed), then generate magiclink for the URL.
    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(tenant.data.email, {
      redirectTo: safeRedirect,
      data: { full_name: tenant.data.full_name, tenant_invite: true },
    });
    // Ignore "already registered" errors — generateLink still works.
    if (invited.error && !/already|exist/i.test(invited.error.message)) {
      // continue; we'll still try generateLink
    }

    const link = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: tenant.data.email,
      options: { redirectTo: safeRedirect },
    });
    if (link.error) throw new Error(link.error.message);
    const actionLink = (link.data as any)?.properties?.action_link as string | null;
    if (!actionLink) throw new Error("Não foi possível gerar o link de convite");
    return { ok: true, actionLink, email: tenant.data.email };
  });

// ===== Complete tenant onboarding (called from /tenant-setup after auth) =====
const completeTenantInput = z.object({
  fullName: z.string().trim().min(3).max(200),
  document: z.string().trim().min(11).max(20),
  email: z.string().email().max(255),
  phone: z.string().trim().min(8).max(40),
  acceptTerms: z.literal(true),
  acceptNexoFee: z.literal(true),
});

export const completeTenantSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => completeTenantInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr) throw new Error(userErr.message);
    const authEmail = userRes.user?.email?.toLowerCase();
    if (!authEmail) throw new Error("Usuário sem e-mail");

    const { data: matched, error: mErr } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .ilike("email", authEmail);
    if (mErr) throw new Error(mErr.message);
    if (!matched || matched.length === 0) {
      return { ok: false, reason: "no_match" as const };
    }

    const ids = matched.map((t) => t.id);
    const { error: updErr } = await supabaseAdmin
      .from("tenants")
      .update({
        user_id_link: userId,
        full_name: data.fullName,
        document: data.document,
        email: data.email,
        phone: data.phone,
        notes: `Termos aceitos em ${new Date().toISOString()}; Taxa Nexo aceita.`,
      })
      .in("id", ids);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "tenant" });
    if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);

    return { ok: true as const, linked: ids.length };
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

// ===== Tenant: ensure PIX charge exists inside the landlord's subaccount =====
const ensurePixInput = z.object({ installmentId: z.string().uuid() });

export const ensureTenantPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ensurePixInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { asaasFetch, getNexoFee } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // RLS garante que o inquilino só vê suas próprias parcelas.
    const inst = await supabase
      .from("installments")
      .select("id, amount, extra_fees, late_charges, asaas_payment_id, pix_qrcode, pix_payload, boleto_url, due_date, status, contract:contracts(id, user_id, late_fee_percent, daily_interest_percent, tenant:tenants(id, full_name, email, document, phone), property:properties(nickname))")
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

    // Modelo B: a cobrança é emitida DENTRO da subconta do landlord.
    const landlord = await getLandlordAsaasCredentials(supabaseAdmin, ownerUserId);
    const masterWalletId = await getMasterPlatformWalletId(supabaseAdmin);

    try {
      const customerRow = await supabaseAdmin
        .from("asaas_customers")
        .select("asaas_customer_id")
        .eq("tenant_id", tenant.id)
        .eq("user_id", ownerUserId)
        .maybeSingle();
      let customerId = customerRow.data?.asaas_customer_id ?? null;
      if (!customerId) {
        if (!tenant.document) throw new Error("Inquilino sem CPF/CNPJ cadastrado");
        const customer = await asaasFetch<any>("/customers", {
          method: "POST",
          apiKey: landlord.apiKey,
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
      const dailyPct = Number(contract?.daily_interest_percent ?? 0) / 30;
      const fine = isOverdue ? +(baseValue * finePct / 100).toFixed(2) : 0;
      const interest = isOverdue ? +(baseValue * dailyPct / 100 * daysLate).toFixed(2) : 0;
      const lateCharges = +(fine + interest).toFixed(2);
      const value = +(baseValue + lateCharges + nexoFee).toFixed(2);
      const effectiveDueDate = isOverdue ? todayStr : originalDue;

      let paymentId = inst.data.asaas_payment_id as string | null;

      if (!paymentId) {
        try {
          const existingList = await asaasFetch<any>(
            `/payments?externalReference=${encodeURIComponent(inst.data.id)}&limit=1`,
            { apiKey: landlord.apiKey },
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
          description: `Aluguel — ${property?.nickname ?? ""} — venc. ${originalDue} (inclui taxa NEXO de R$ ${nexoFee.toFixed(2)})`,
          externalReference: inst.data.id,
          externalMetadata: {
            installmentId: inst.data.id,
            contractId: contract?.id ?? null,
            landlordUserId: ownerUserId,
          },
        };
        const split = buildPlatformSplit({ masterWalletId, nexoFee, totalValue: value });
        if (split.length > 0) body.split = split;

        const created = await asaasFetch<any>("/payments", {
          method: "POST",
          apiKey: landlord.apiKey,
          body: JSON.stringify(body),
        });
        paymentId = created.id;
      } else {
        try {
          await asaasFetch<any>(`/payments/${paymentId}`, {
            method: "PUT",
            apiKey: landlord.apiKey,
            body: JSON.stringify({ billingType: "PIX", value, dueDate: effectiveDueDate }),
          });
        } catch { /* ignora */ }
      }

      const pix = await asaasFetch<any>(`/payments/${paymentId}/pixQrCode`, { apiKey: landlord.apiKey });
      const paymentInfo = await asaasFetch<any>(`/payments/${paymentId}`, { apiKey: landlord.apiKey });

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
    } catch (e: any) {
      // Erros de negócio do Asaas (ex.: limite de emissão atingido) são
      // retornados como payload para que a UI mostre um aviso amigável,
      // ao invés de propagar um runtime-error e gerar tela em branco.
      const mapped = mapAsaasError(e);
      return { ok: false as const, error: mapped.message };
    }
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
    // O Asaas exige ownerName/ownerCpfCnpj — buscamos do cadastro da própria subconta.
    let ownerName: string | undefined;
    let ownerCpfCnpj: string | undefined;
    try {
      const me = await asaasFetch<any>("/myAccount", { apiKey });
      ownerName = me?.name ?? me?.companyName ?? undefined;
      ownerCpfCnpj = me?.cpfCnpj ? String(me.cpfCnpj).replace(/\D/g, "") : undefined;
    } catch (e: any) {
      console.warn("[Asaas] /myAccount falhou ao buscar titular:", e?.message);
    }

    await asaasFetch<any>("/bankAccounts", {
      method: "POST",
      apiKey,
      body: JSON.stringify({
        bank: { code: data.bankCode },
        agency: data.agency.replace(/\D/g, ""),
        account: data.account.replace(/\D/g, ""),
        accountDigit: data.accountDigit.replace(/\D/g, ""),
        bankAccountType: data.accountType,
        ...(ownerName ? { ownerName } : {}),
        ...(ownerCpfCnpj ? { ownerCpfCnpj } : {}),
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
    form.append("documentFile", new Blob([bytes.buffer as ArrayBuffer], { type: data.mimeType }), data.filename);

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

// ===== Configure automatic daily payouts inside the landlord's subaccount =====
// Modelo B: dispara a configuração de sweep diretamente na subconta do landlord
// usando a sua própria api_key. Idempotente — pode ser chamada várias vezes.
export const configureAutomaticPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { asaasFetch } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key, bank_code, bank_account")
      .eq("user_id", userId)
      .maybeSingle();
    if (acc.error) throw new Error(acc.error.message);
    const apiKey = acc.data?.api_key;
    if (!apiKey) {
      throw new Error("Subconta Asaas ainda não foi criada. Conclua o onboarding primeiro.");
    }
    if (!acc.data?.bank_code || !acc.data?.bank_account) {
      throw new Error("Cadastre uma conta bancária de liquidação antes de ativar os repasses automáticos.");
    }

    try {
      await asaasFetch<any>("/accountConfiguration", {
        method: "POST",
        apiKey,
        body: JSON.stringify({
          // Payload conforme spec do produto (Modelo B):
          transferConfiguration: { enabled: true, frequency: "DAILY" },
          // Campos canônicos do gateway Asaas — mantidos por compatibilidade.
          autoTransferEnabled: true,
          autoTransferFrequency: "DAILY",
        }),
      });
    } catch (e: any) {
      throw mapAsaasError(e);
    }

    const upd = await supabaseAdmin
      .from("asaas_accounts")
      .update({ auto_transfer_enabled: true })
      .eq("user_id", userId);
    if (upd.error) throw new Error(upd.error.message);

    return { ok: true };
  });

// ===== Hybrid Just-In-Time invoice generator =====
// Para cada parcela `agendado` cujo vencimento está a <= 15 dias, emite a
// cobrança DENTRO da subconta do landlord (Modelo B), aplica o split da taxa
// NEXO para a wallet master e move o status para `em_aberto`.
export async function runProcessScheduledInvoices(opts?: { horizonDays?: number; limit?: number; managerUserId?: string }) {
  const { asaasFetch, getNexoFee } = await import("./asaas.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const horizon = opts?.horizonDays ?? 15;
  const limit = opts?.limit ?? 200;
  const managerUserId = opts?.managerUserId;

  const horizonDate = new Date();
  horizonDate.setUTCDate(horizonDate.getUTCDate() + horizon);
  const horizonStr = horizonDate.toISOString().slice(0, 10);

  let query = supabaseAdmin
    .from("installments")
    .select(
      "id, user_id, contract_id, due_date, amount, extra_fees, status, asaas_payment_id, " +
        "contract:contracts(id, user_id, tenant:tenants(id, full_name, email, document, phone), property:properties(nickname))",
    )
    .eq("status", "agendado")
    .is("asaas_payment_id", null)
    .lte("due_date", horizonStr)
    .limit(limit);
  if (managerUserId) query = query.eq("user_id", managerUserId);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const { data: feeRow } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "nexo_boleto_fee")
    .maybeSingle();
  const nexoFee = feeRow?.value ? Number(feeRow.value) : getNexoFee();

  const results: Array<{ installmentId: string; ok: boolean; error?: string; paymentId?: string }> = [];

  for (const inst of ((rows as any[]) ?? [])) {
    try {
      const contract = (inst as any).contract;
      const tenant = contract?.tenant;
      const property = contract?.property;
      if (!tenant) throw new Error("Contrato sem inquilino vinculado");

      const landlordUserId: string = contract.user_id ?? inst.user_id;
      const landlord = await getLandlordAsaasCredentials(supabaseAdmin, landlordUserId);
      const masterWalletId = await getMasterPlatformWalletId(supabaseAdmin);

      const customerRow = await supabaseAdmin
        .from("asaas_customers")
        .select("asaas_customer_id")
        .eq("tenant_id", tenant.id)
        .eq("user_id", landlordUserId)
        .maybeSingle();
      let customerId = customerRow.data?.asaas_customer_id ?? null;
      if (!customerId) {
        if (!tenant.document) throw new Error("Inquilino sem CPF/CNPJ cadastrado");
        const customer = await asaasFetch<any>("/customers", {
          method: "POST",
          apiKey: landlord.apiKey,
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
          user_id: landlordUserId,
          tenant_id: tenant.id,
          asaas_customer_id: customerId as string,
        });
      }

      const baseValue = Number(inst.amount) + Number((inst as any).extra_fees ?? 0);
      const value = +(baseValue + nexoFee).toFixed(2);

      const body: Record<string, unknown> = {
        customer: customerId as string,
        billingType: "UNDEFINED",
        value,
        dueDate: inst.due_date,
        description: `Aluguel — ${property?.nickname ?? ""} — venc. ${inst.due_date} (inclui taxa NEXO de R$ ${nexoFee.toFixed(2)})`,
        externalReference: inst.id,
        externalMetadata: {
          installmentId: inst.id,
          contractId: contract?.id ?? null,
          landlordUserId,
        },
      };
      const split = buildPlatformSplit({ masterWalletId, nexoFee, totalValue: value });
      if (split.length > 0) body.split = split;

      const payment = await asaasFetch<any>("/payments", {
        method: "POST",
        apiKey: landlord.apiKey,
        body: JSON.stringify(body),
      });

      const upd = await supabaseAdmin
        .from("installments")
        .update({
          asaas_payment_id: payment.id,
          boleto_url: payment.bankSlipUrl ?? payment.invoiceUrl ?? null,
          barcode: payment.identificationField ?? null,
          status: "em_aberto",
        })
        .eq("id", inst.id);
      if (upd.error) throw new Error(upd.error.message);

      results.push({ installmentId: inst.id, ok: true, paymentId: payment.id });
    } catch (e: any) {
      const msg = mapAsaasError(e).message;
      console.error("[processScheduledInvoices] falha em", inst.id, msg);
      results.push({ installmentId: inst.id, ok: false, error: msg });
    }
  }

  return { processed: results.length, results };
}

export const processScheduledInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isManager } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "manager",
    });
    if (!isManager) throw new Error("Apenas managers podem disparar o ciclo de faturamento.");
    // Escopo por agência: só processa parcelas da própria imobiliária do manager autenticado.
    return runProcessScheduledInvoices({ managerUserId: userId });
  });

