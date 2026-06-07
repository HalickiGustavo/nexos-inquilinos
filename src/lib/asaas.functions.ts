import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===== Get current owner's Asaas account state =====
export const getAsaasAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
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
    if (inst.data.asaas_payment_id) {
      throw new Error("Esta parcela já possui boleto gerado.");
    }

    const tenant = (inst.data as any).contract?.tenant;
    const property = (inst.data as any).contract?.property;
    if (!tenant) throw new Error("Contrato sem inquilino vinculado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (acc.error) throw new Error(acc.error.message);
    const ownerApiKey = acc.data?.api_key || undefined;

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

    const nexoFee = getNexoFee();
    const nexoWallet = getNexoWalletId();
    const baseValue = Number(inst.data.amount) + Number(inst.data.extra_fees ?? 0);
    // Taxa NEXO embutida no boleto + split fixo para a carteira do NEXO
    const value = baseValue + (nexoWallet && nexoFee > 0 ? nexoFee : 0);

    // Asaas não permite criar cobrança com vencimento no passado.
    // Se a data original já passou, usamos a data de hoje como vencimento do boleto,
    // mantendo a referência da data original na descrição.
    const todayStr = new Date().toISOString().slice(0, 10);
    const originalDue = inst.data.due_date as string;
    const effectiveDueDate = originalDue < todayStr ? todayStr : originalDue;
    const overdueNote = originalDue < todayStr ? ` (vencimento original ${originalDue} — em atraso)` : "";

    const body: Record<string, unknown> = {
      customer: customerId as string,
      billingType: data.billingType,
      value,
      dueDate: effectiveDueDate,
      description: `Aluguel — ${property?.nickname ?? ""} — venc. ${originalDue}${overdueNote}${nexoFee > 0 ? ` (inclui taxa NEXO de R$ ${nexoFee.toFixed(2)})` : ""}`,
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
      })
      .eq("id", inst.data.id);
    if (upd.error) throw new Error(upd.error.message);

    return { ok: true, paymentId: payment.id };
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
      .select("id, amount, extra_fees, asaas_payment_id, due_date, status")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (inst.error) throw new Error(inst.error.message);
    if (!inst.data?.asaas_payment_id) throw new Error("Parcela ainda não possui boleto.");
    if (inst.data.status === "pago") throw new Error("Parcela já foi paga.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acc = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key")
      .eq("user_id", userId)
      .maybeSingle();
    const ownerApiKey = acc.data?.api_key || undefined;

    const nexoFee = getNexoFee();
    const nexoWallet = getNexoWalletId();
    if (!nexoWallet || nexoFee <= 0) throw new Error("Taxa NEXO não configurada.");

    const baseValue = Number(inst.data.amount) + Number(inst.data.extra_fees ?? 0);
    const value = baseValue + nexoFee;

    const body: Record<string, unknown> = {
      value,
      dueDate: inst.data.due_date,
      split: [{ walletId: nexoWallet, fixedValue: nexoFee }],
    };

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
      })
      .eq("id", inst.data.id);

    return { ok: true, value };
  });

// ===== Invite a tenant to register on the platform =====
const inviteInput = z.object({
  tenantId: z.string().uuid(),
  redirectUrl: z.string().url(),
});

export const inviteTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
      redirectTo: data.redirectUrl,
      data: { full_name: tenant.data.full_name, tenant_invite: true },
    });
    if (error) {
      // If user already exists, send a magic link instead
      const link = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: tenant.data.email,
        options: { redirectTo: data.redirectUrl },
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
