import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===== Get current owner's Asaas account state =====
export const getAsaasAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Explicitly exclude api_key (column SELECT privilege revoked for authenticated)
    const { data, error } = await supabase
      .from("asaas_accounts")
      .select("id, user_id, asaas_account_id, wallet_id, status, onboarding_url, created_at, updated_at")
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
  birthDate: z.string().optional(), // YYYY-MM-DD, PF only
  companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]).optional(),
  address: z.string().min(2).max(200),
  addressNumber: z.string().min(1).max(20),
  province: z.string().min(2).max(120), // bairro
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
      .select("*")
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

    // Load installment + contract + tenant + property (RLS scopes to owner)
    const inst = await supabase
      .from("installments")
      .select("*, contract:contracts(*, tenant:tenants(*), property:properties(*))")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (inst.error) throw new Error(inst.error.message);
    if (!inst.data) throw new Error("Parcela não encontrada");
    if (inst.data.asaas_payment_id) {
      throw new Error("Esta parcela já possui boleto gerado.");
    }

    const tenant = (inst.data as any).contract?.tenant;
    const property = (inst.data as any).contract?.property;
    if (!tenant) throw new Error("Contrato sem inquilino vinculado");

    // api_key is server-only — read via admin client (column SELECT revoked for authenticated)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (acc.error) throw new Error(acc.error.message);
    const ownerApiKey = acc.data?.api_key || undefined;

    // Ensure customer
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

    // Build payment
    const nexoFee = getNexoFee();
    const nexoWallet = getNexoWalletId();
    const value = Number(inst.data.amount) + Number(inst.data.extra_fees ?? 0);

    const body: Record<string, unknown> = {
      customer: customerId as string,
      billingType: data.billingType,
      value,
      dueDate: inst.data.due_date,
      description: `Aluguel — ${property?.nickname ?? ""} — venc. ${inst.data.due_date}`,
      externalReference: inst.data.id,
    };
    if (nexoWallet && nexoFee > 0 && nexoFee < value) {
      body.split = [{ walletId: nexoWallet, fixedValue: nexoFee }];
    }

    const payment = await asaasFetch<any>("/payments", {
      method: "POST",
      apiKey: ownerApiKey,
      body: JSON.stringify(body),
    });

    // Fetch Pix QR (best-effort)
    let pix: { encodedImage?: string; payload?: string } = {};
    try {
      pix = await asaasFetch<any>(`/payments/${payment.id}/pixQrCode`, {
        apiKey: ownerApiKey,
      });
    } catch {
      // boleto-only payments may not return Pix
    }

    const upd = await supabaseAdmin
      .from("installments")
      .update({
        asaas_payment_id: payment.id,
        boleto_url: payment.bankSlipUrl ?? payment.invoiceUrl ?? null,
        barcode: payment.identificationField ?? null,
        pix_qrcode: pix.encodedImage ?? null,
        pix_payload: pix.payload ?? null,
      })
      .eq("id", inst.data.id);
    if (upd.error) throw new Error(upd.error.message);

    return { ok: true, paymentId: payment.id };
  });
