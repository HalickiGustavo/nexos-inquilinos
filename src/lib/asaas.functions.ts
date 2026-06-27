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
    return new Error(
      "Não conseguimos acessar sua subconta no gateway. Isso normalmente acontece quando os dados bancários (banco, agência, conta, dígito ou CPF/CNPJ do titular) foram preenchidos incorretamente ou ainda não foram validados. Revise os dados bancários na seção 'Conta bancária de recebimento' abaixo e tente novamente. Se já estiverem corretos, aguarde alguns minutos e atualize.",
    );
  }
  if (status === 400) {
    const msg = String(e?.message ?? "");
    if (/bank|conta|agência|agencia|titular/i.test(msg)) {
      return new Error(`Dados bancários recusados pelo gateway: ${msg}. Corrija na seção abaixo e tente novamente.`);
    }
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
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    // Defesa em profundidade: bloqueia qualquer linha de outro usuário,
    // mesmo se algo na cadeia de RLS/cliente estiver corrompido.
    if (data && (data as any).user_id !== userId) {
      console.error("[security] asaas_accounts cross-user row suppressed", {
        userId,
        rowUserId: (data as any).user_id,
      });
      return { account: null };
    }

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

// ===== Gera/recupera links de onboarding por documento (subconta) =====
export const getAsaasOnboardingLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asaasFetch } = await import("./asaas.server");

    const { data: acc, error } = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key, asaas_account_id, onboarding_url")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!acc?.api_key) {
      throw new Error("Subconta Asaas ainda não criada. Conclua o cadastro acima primeiro.");
    }

    // Fallback geral: link de onboarding único da subconta (existe mesmo em
    // subcontas antigas, anteriores ao endpoint /myAccount/documents).
    let generalOnboardingUrl: string | null = acc.onboarding_url ?? null;
    let accountStatus: string | null = null;
    try {
      const me = await asaasFetch<any>("/myAccount", { method: "GET", apiKey: acc.api_key });
      if (me?.onboardingUrl) {
        generalOnboardingUrl = me.onboardingUrl;
        if (me.onboardingUrl !== acc.onboarding_url) {
          await supabaseAdmin
            .from("asaas_accounts")
            .update({ onboarding_url: me.onboardingUrl })
            .eq("user_id", userId);
        }
      }
      accountStatus = me?.status ?? null;
    } catch (e) {
      console.warn("[asaas] /myAccount fallback falhou:", (e as any)?.message);
    }

    try {
      const docs = await asaasFetch<any>("/myAccount/documents", {
        method: "GET",
        apiKey: acc.api_key,
      });
      const list: Array<any> = Array.isArray(docs?.data) ? docs.data : [];
      const items = list.map((g) => ({
        id: g.id,
        type: g.type,
        title: g.title,
        status: g.status,
        onboardingUrl: g.onboardingUrl ?? generalOnboardingUrl ?? null,
      }));

      const first = items.find((i) => !!i.onboardingUrl)?.onboardingUrl ?? generalOnboardingUrl;
      if (first && first !== acc.onboarding_url) {
        await supabaseAdmin
          .from("asaas_accounts")
          .update({ onboarding_url: first })
          .eq("user_id", userId);
      }
      return { ok: true, items, generalOnboardingUrl, accountStatus, rejectReasons: docs?.rejectReasons ?? null };
    } catch (e: any) {
      // Mensagem específica quando a subconta está em análise (AWAITING_APPROVAL)
      // — não é credencial inválida, é o Asaas ainda revisando o cadastro.
      const awaiting = accountStatus === "AWAITING_APPROVAL";
      const baseWarn = awaiting
        ? "Subconta em análise pelo Asaas (AWAITING_APPROVAL). O painel de documentos só é liberado após a aprovação inicial do cadastro/dados bancários. Use o link geral de onboarding abaixo enquanto isso, e tente novamente em alguns minutos."
        : ((e as any)?.message ?? "Falha ao listar documentos; usando link geral.");
      if (generalOnboardingUrl) {
        return {
          ok: true,
          items: [],
          generalOnboardingUrl,
          accountStatus,
          rejectReasons: null,
          warning: baseWarn,
        };
      }
      if (awaiting) {
        throw new Error(baseWarn);
      }
      throw mapAsaasError(e);
    }
  });


// ===== Diagnóstico da subconta Asaas =====
// Objetivo: dar uma resposta objetiva sobre POR QUE /myAccount/documents está
// retornando 401/403. Verifica, na ordem:
//   1. Ambiente atual da plataforma (sandbox vs produção)
//   2. Presença e formato da api_key salva
//   3. Se a master key consegue ver a subconta no ambiente atual
//      (404 = subconta foi criada em outro ambiente)
//   4. Se a própria api_key da subconta autentica em /myAccount
export const diagnoseAsaasAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asaasFetch, ASAAS_BASE_URL } = await import("./asaas.server");

    const env = process.env.ASAAS_ENV === "production" ? "production" : "sandbox";
    const masterKeyPresent = !!process.env.ASAAS_API_KEY;
    const masterWalletEnv = process.env.NEXO_MASTER_WALLET_ID || process.env.ASAAS_NEXO_WALLET_ID || null;

    const { data: acc, error } = await supabaseAdmin
      .from("asaas_accounts")
      .select("api_key, asaas_account_id, wallet_id, status, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const apiKey: string | null = acc?.api_key ?? null;
    const accountId: string | null = acc?.asaas_account_id ?? null;
    const apiKeyLast4 = apiKey ? apiKey.slice(-4) : null;
    const apiKeyLength = apiKey?.length ?? 0;

    let myAccountStatus: { ok: boolean; status?: number; message?: string; sample?: any } = { ok: false };
    if (apiKey) {
      try {
        const me = await asaasFetch<any>("/myAccount", { method: "GET", apiKey });
        myAccountStatus = {
          ok: true,
          sample: { id: me?.id, walletId: me?.walletId, status: me?.status, accountStatus: me?.accountStatus },
        };
      } catch (e: any) {
        myAccountStatus = { ok: false, status: e?.status, message: e?.message };
      }
    } else {
      myAccountStatus = { ok: false, message: "api_key ausente no banco para este usuário." };
    }

    let masterLookup: { ok: boolean; status?: number; message?: string; sample?: any } = { ok: false };
    if (masterKeyPresent && accountId) {
      try {
        const sub = await asaasFetch<any>(`/accounts/${accountId}`);
        masterLookup = {
          ok: true,
          sample: { id: sub?.id, walletId: sub?.walletId, status: sub?.status, accountStatus: sub?.accountStatus, name: sub?.name, email: sub?.email },
        };
      } catch (e: any) {
        masterLookup = { ok: false, status: e?.status, message: e?.message };
      }
    }

    // Diagnóstico textual
    const reasons: string[] = [];
    if (!masterKeyPresent) reasons.push("ASAAS_API_KEY (chave master) não está configurada no servidor.");
    if (!apiKey) reasons.push("A api_key da subconta não está salva no banco — recriar a subconta resolve.");
    if (apiKey && apiKeyLength < 30) reasons.push(`A api_key salva parece truncada (${apiKeyLength} chars).`);
    if (masterLookup.status === 404) reasons.push(`A subconta ${accountId} não existe no ambiente "${env}" — provavelmente foi criada no outro ambiente (sandbox/produção).`);
    if (masterLookup.ok && !myAccountStatus.ok && myAccountStatus.status && myAccountStatus.status >= 400) {
      reasons.push(`A subconta existe no ambiente "${env}", mas a api_key salva não autentica nela (status ${myAccountStatus.status}). O Asaas pode ter rotacionado a chave — apague a linha em asaas_accounts e recrie a subconta, ou peça reset ao suporte Asaas.`);
    }

    return {
      env,
      baseUrl: ASAAS_BASE_URL,
      masterKeyPresent,
      masterWalletConfigured: !!masterWalletEnv,
      account: {
        accountId,
        walletId: acc?.wallet_id ?? null,
        status: acc?.status ?? null,
        apiKeyPresent: !!apiKey,
        apiKeyLength,
        apiKeyLast4,
        createdAt: acc?.created_at ?? null,
        updatedAt: acc?.updated_at ?? null,
      },
      myAccountCheck: myAccountStatus,
      masterLookup,
      reasons,
    };
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
  // Conta bancária de liquidação — obrigatória para evitar envio parcial ao Asaas.
  bankCode: z.string().min(1).max(10),
  bankOwnerCpfCnpj: z.string().min(11).max(20),
  bankAgency: z.string().min(1).max(10),
  bankAccount: z.string().min(1).max(20),
  bankAccountDigit: z.string().min(1).max(3),
  bankAccountType: z.enum(["CONTA_CORRENTE", "CONTA_POUPANCA"]),
});

export const createAsaasSubaccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSubaccountInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { asaasFetch } = await import("./asaas.server");

    // Sem verificação de subconta existente: o login do app e a subconta Asaas
    // são entidades independentes — o mesmo usuário pode recriar/sobrescrever
    // sua subconta livremente (o upsert por user_id resolve duplicidade).



    const digits = data.mobilePhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11 || (digits.length === 11 && digits[2] !== "9")) {
      throw new Error("Informe um celular válido com DDD (ex.: 41 99999-9999).");
    }
    const bankOwnerCpfCnpj = data.bankOwnerCpfCnpj.replace(/\D/g, "");
    const bankAgency = data.bankAgency.replace(/\D/g, "");
    const bankAccount = data.bankAccount.replace(/\D/g, "");
    const bankAccountDigit = data.bankAccountDigit.replace(/\D/g, "");
    if (![11, 14].includes(bankOwnerCpfCnpj.length)) {
      throw new Error("Informe o CPF/CNPJ do titular da conta bancária.");
    }
    if (!data.bankCode || !bankAgency || !bankAccount || !bankAccountDigit || !data.bankAccountType) {
      throw new Error("Preencha todos os dados bancários para criar a subconta.");
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
    // Auto-define companyType: CNPJ (14 dígitos) exige tipo de empresa no Asaas.
    // Default LIMITED cobre a maioria das imobiliárias (LTDA / sociedades).
    const cleanDoc = data.cpfCnpj.replace(/\D/g, "");
    if (cleanDoc.length === 14) {
      payload.companyType = data.companyType ?? "LIMITED";
    } else if (data.companyType) {
      payload.companyType = data.companyType;
    }

    const account = await asaasFetch<any>("/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const newApiKey: string | null = account.apiKey ?? null;
    if (!newApiKey) {
      throw new Error("Asaas não retornou a chave da subconta para vincular os dados bancários.");
    }

    await asaasFetch<any>("/bankAccounts/mainAccount", {
      method: "POST",
      apiKey: newApiKey,
      body: JSON.stringify({
        accountName: "Conta de recebimento Nexo",
        thirdPartyAccount: bankOwnerCpfCnpj !== data.cpfCnpj.replace(/\D/g, ""),
        bank: data.bankCode,
        agency: bankAgency,
        account: bankAccount,
        accountDigit: bankAccountDigit,
        bankAccountType: data.bankAccountType,
        name: data.name,
        cpfCnpj: bankOwnerCpfCnpj,
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
          bank_code: data.bankCode,
          bank_agency: bankAgency,
          bank_account: bankAccount,
          bank_account_digit: bankAccountDigit,
          bank_account_type: data.bankAccountType,
          auto_transfer_enabled: true,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    return {
      ok: true,
      walletId: account.walletId ?? null,
      onboardingUrl: account.onboardingUrl ?? null,
      bankWarning: null,
    };
  });

// ===== Setup hosted onboarding (cadastro.io iframe) =====
// Cria a subconta + dados bancários, aguarda 15s (barramento Asaas
// provisionar a trilha KYC) e retorna o `onboardingUrl` que será
// embutido em um <iframe> no painel admin.
export const setupSubaccountOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSubaccountInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { asaasFetch } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bloqueio: só manager/owner pode iniciar a homologação.
    const [{ data: isManager }, { data: isOwner }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "manager" as any }),
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" as any }),
    ]);
    if (!isManager && !isOwner) throw new Error("Forbidden");

    const digits = data.mobilePhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11 || (digits.length === 11 && digits[2] !== "9")) {
      throw new Error("Informe um celular válido com DDD (ex.: 41 99999-9999).");
    }
    const bankOwnerCpfCnpj = data.bankOwnerCpfCnpj.replace(/\D/g, "");
    const bankAgency = data.bankAgency.replace(/\D/g, "");
    const bankAccount = data.bankAccount.replace(/\D/g, "");
    const bankAccountDigit = data.bankAccountDigit.replace(/\D/g, "");
    if (![11, 14].includes(bankOwnerCpfCnpj.length)) {
      throw new Error("Informe o CPF/CNPJ do titular da conta bancária.");
    }

    // Step 1 — Criação da subconta com master token
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
    const cleanDoc = data.cpfCnpj.replace(/\D/g, "");
    if (cleanDoc.length === 14) {
      payload.companyType = data.companyType ?? "LIMITED";
    } else if (data.companyType) {
      payload.companyType = data.companyType;
    }

    const account = await asaasFetch<any>("/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const newApiKey: string | null = account.apiKey ?? null;
    if (!newApiKey) {
      throw new Error("Asaas não retornou a chave da subconta criada.");
    }

    // Vincula conta bancária imediatamente (necessário para liberar a trilha KYC)
    try {
      await asaasFetch<any>("/bankAccounts/mainAccount", {
        method: "POST",
        apiKey: newApiKey,
        body: JSON.stringify({
          accountName: "Conta de recebimento Nexo",
          thirdPartyAccount: bankOwnerCpfCnpj !== cleanDoc,
          bank: data.bankCode,
          agency: bankAgency,
          account: bankAccount,
          accountDigit: bankAccountDigit,
          bankAccountType: data.bankAccountType,
          name: data.name,
          cpfCnpj: bankOwnerCpfCnpj,
        }),
      });
    } catch (e: any) {
      console.warn("[Asaas] bankAccounts/mainAccount falhou:", e?.message);
    }
    try {
      await asaasFetch<any>("/accountConfiguration", {
        method: "POST",
        apiKey: newApiKey,
        body: JSON.stringify({ autoTransferEnabled: true, autoTransferFrequency: "DAILY" }),
      });
    } catch (e: any) {
      console.warn("[Asaas] accountConfiguration falhou:", e?.message);
    }

    // Persiste subconta antes de aguardar, para não perder a referência
    // caso o cliente desconecte durante o delay de 15s.
    await supabaseAdmin
      .from("asaas_accounts")
      .upsert(
        {
          user_id: userId,
          asaas_account_id: account.id ?? null,
          wallet_id: account.walletId ?? null,
          api_key: newApiKey,
          status: account.id ? "active" : "pending",
          onboarding_url: account.onboardingUrl ?? null,
          bank_code: data.bankCode,
          bank_agency: bankAgency,
          bank_account: bankAccount,
          bank_account_digit: bankAccountDigit,
          bank_account_type: data.bankAccountType,
          auto_transfer_enabled: true,
        },
        { onConflict: "user_id" },
      );

    // Step 2 — Delay crítico de 15s para o barramento interno do Asaas
    // provisionar a trilha KYC (cadastro.io) da nova subconta.
    await new Promise((resolve) => setTimeout(resolve, 15000));

    // Step 3 — Busca o onboardingUrl com a apiKey da subconta recém-criada
    let onboardingUrl: string | null = account.onboardingUrl ?? null;
    try {
      const docs = await asaasFetch<any>("/myAccount/documents", {
        method: "GET",
        apiKey: newApiKey,
      });
      const list: Array<any> = Array.isArray(docs?.data) ? docs.data : [];
      const first = list.find((g) => !!g?.onboardingUrl)?.onboardingUrl ?? null;
      if (first) onboardingUrl = first;
    } catch (e: any) {
      console.warn("[Asaas] /myAccount/documents falhou:", e?.message);
    }
    if (!onboardingUrl) {
      try {
        const me = await asaasFetch<any>("/myAccount", { method: "GET", apiKey: newApiKey });
        if (me?.onboardingUrl) onboardingUrl = me.onboardingUrl;
      } catch {
        /* ignore */
      }
    }

    // Fallback Sandbox: o ambiente de testes do Asaas aprova subcontas
    // automaticamente (status APPROVED, sem documentos pendentes), então
    // /myAccount/documents e /myAccount não retornam onboardingUrl. Para
    // permitir testar o fluxo de iframe, devolvemos o login do painel Sandbox
    // pré-preenchido com o e-mail da subconta criada.
    const isSandbox = (process.env.ASAAS_ENV ?? "sandbox") !== "production";
    let sandboxFallback = false;
    if (!onboardingUrl && isSandbox) {
      onboardingUrl = `https://sandbox.asaas.com/login?username=${encodeURIComponent(data.email)}`;
      sandboxFallback = true;
    }

    if (onboardingUrl && onboardingUrl !== account.onboardingUrl) {
      await supabaseAdmin
        .from("asaas_accounts")
        .update({ onboarding_url: onboardingUrl })
        .eq("user_id", userId);
    }

    if (!onboardingUrl) {
      throw new Error(
        "Subconta criada, mas o Asaas ainda não liberou o painel de verificação. Atualize em alguns minutos.",
      );
    }

    return {
      ok: true,
      onboardingUrl,
      sandboxFallback,
      accountId: account.id ?? null,
      walletId: account.walletId ?? null,
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
  ownerCpfCnpj: z.string().min(11).max(20),
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
    const subaccountId = acc.data?.asaas_account_id;
    if (!apiKey) throw new Error("Subconta Asaas ainda não foi criada. Conclua o onboarding primeiro.");

    // 1) Vincular conta bancária principal de liquidação.
    // O endpoint de conta principal espera `name` e `cpfCnpj` no corpo raiz
    // (não `ownerName`/`ownerCpfCnpj`, que são usados em outros fluxos de transferência).
    // Tentamos múltiplas fontes: /myAccount (com api_key da subconta) e, como fallback,
    // GET /accounts/{id} com a master key.
    let ownerName: string | undefined;
    const ownerCpfCnpj = data.ownerCpfCnpj.replace(/\D/g, "");
    const agency = data.agency.replace(/\D/g, "");
    const accountNumber = data.account.replace(/\D/g, "");
    const accountDigit = data.accountDigit.replace(/\D/g, "");
    if (![11, 14].includes(ownerCpfCnpj.length)) {
      throw new Error("Informe o CPF/CNPJ do titular da conta bancária.");
    }
    if (!data.bankCode || !agency || !accountNumber || !accountDigit || !data.accountType) {
      throw new Error("Preencha todos os dados bancários antes de salvar.");
    }
    const pickOwner = (src: any) => {
      if (!src || typeof src !== "object") return;
      ownerName = ownerName ?? src.name ?? src.companyName ?? src.fullName ?? undefined;
    };
    try {
      pickOwner(await asaasFetch<any>("/myAccount", { apiKey }));
    } catch (e: any) {
      console.warn("[Asaas] /myAccount falhou:", e?.message);
    }
    if (!ownerName && subaccountId) {
      try {
        pickOwner(await asaasFetch<any>(`/accounts/${subaccountId}`));
      } catch (e: any) {
        console.warn("[Asaas] /accounts/{id} falhou:", e?.message);
      }
    }
    if (!ownerName) {
      // Último recurso: buscar pela listagem usando a master key.
      try {
        const list = await asaasFetch<any>(`/accounts?limit=1${subaccountId ? `&id=${subaccountId}` : ""}`);
        const first = Array.isArray(list?.data) ? list.data[0] : null;
        pickOwner(first);
      } catch (e: any) {
        console.warn("[Asaas] /accounts (listagem) falhou:", e?.message);
      }
    }

    if (!ownerName) {
      throw new Error(
        "Não foi possível recuperar o nome do titular da subconta no Asaas. Tente novamente em instantes ou contate o suporte.",
      );
    }

    await asaasFetch<any>("/bankAccounts/mainAccount", {
      method: "POST",
      apiKey,
      body: JSON.stringify({
        accountName: "Conta de recebimento Nexo",
        thirdPartyAccount: true,
        bank: data.bankCode,
        agency,
        account: accountNumber,
        accountDigit,
        bankAccountType: data.accountType,
        name: ownerName,
        cpfCnpj: ownerCpfCnpj,
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
        bank_agency: agency,
        bank_account: accountNumber,
        bank_account_digit: accountDigit,
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
  // Asaas só aceita JPG/JPEG e PDF no endpoint /myAccount/documents/{id}.
  // PNG é rejeitado com a mensagem genérica "Esse tipo de documento não pode ser enviado via API".
  mimeType: z.enum(["image/jpeg", "image/jpg", "application/pdf"], {
    message: "Formato não suportado pelo Asaas. Envie JPG/JPEG ou PDF (PNG não é aceito).",
  }),
  base64: z.string().min(10).max(8_500_000), // ~6MB binário após decode
  dryRun: z.boolean().optional(), // se true: faz o upload mas NÃO atualiza kyc_status e retorna a resposta crua do Asaas
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

    // 1) Buscar a lista de documentos pendentes do Asaas para descobrir o ID
    //    do grupo correspondente ao tipo enviado. O Asaas exige POST em
    //    /myAccount/documents/{id} — sem esse ID o upload retorna "ID inválido".
    const listRes = await fetch(`${ASAAS_BASE_URL}/myAccount/documents`, {
      method: "GET",
      headers: { access_token: apiKey, "User-Agent": "Nexo/1.0" },
    });
    const listText = await listRes.text();
    const listBody = listText ? (() => { try { return JSON.parse(listText); } catch { return null; } })() : null;
    if (!listRes.ok) {
      const msg =
        (listBody && typeof listBody === "object" && Array.isArray((listBody as any).errors)
          ? (listBody as any).errors.map((e: any) => e.description).join("; ")
          : null) || `Asaas ${listRes.status} ao listar documentos`;
      throw new Error(msg);
    }
    const groups: any[] = Array.isArray((listBody as any)?.data) ? (listBody as any).data : [];
    // Resumo enxuto dos grupos para debug (modo teste)
    const groupsSummary = groups.map((g: any) => ({
      id: g?.id,
      type: g?.type,
      status: g?.status,
      title: g?.title,
      responsible: g?.responsible,
    }));
    // Mapeia nomes lógicos do nosso UI para os `type` reais retornados pelo Asaas.
    // O Asaas usa IDENTIFICATION_SELFIE para selfie e IDENTIFICATION para o documento.
    const typeAliases: Record<string, string[]> = {
      SELFIE: ["IDENTIFICATION_SELFIE", "SELFIE"],
      IDENTIFICATION: ["IDENTIFICATION", "IDENTIFICATION_DOCUMENT"],
      ADDRESS: ["ADDRESS", "ADDRESS_PROOF"],
      ENTREPRENEUR_DOCUMENT: ["ENTREPRENEUR_DOCUMENT", "SOCIAL_CONTRACT"],
    };
    const candidates = typeAliases[data.documentType] ?? [data.documentType];
    const group = groups.find((g: any) => candidates.includes(g?.type));
    const groupId = group?.id;
    const groupType: string | undefined = group?.type;
    if (!groupId || !groupType) {
      const msg = `Nenhum grupo de documento do tipo "${data.documentType}" encontrado no Asaas. Grupos disponíveis: ${
        groupsSummary.map((g) => g.type).join(", ") || "(nenhum)"
      }`;
      if (data.dryRun) {
        return { ok: false, dryRun: true, httpStatus: 0, groupId: null, availableGroups: groupsSummary, error: msg };
      }
      throw new Error(msg);
    }

    // 2) Monta multipart e faz pass-through direto para o Asaas no endpoint correto.
    //    O campo `type` precisa ser exatamente o `type` do grupo retornado pelo Asaas.
    const form = new FormData();
    form.append("documentFile", new Blob([bytes.buffer as ArrayBuffer], { type: data.mimeType }), data.filename);
    form.append("type", groupType);

    const res = await fetch(`${ASAAS_BASE_URL}/myAccount/documents/${groupId}`, {
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
      if (data.dryRun) {
        return { ok: false, dryRun: true, httpStatus: res.status, groupId, availableGroups: groupsSummary, response: body, error: msg };
      }
      throw new Error(msg);
    }

    const referenceId =
      (body && typeof body === "object" && ((body as any).id ?? (body as any).reference)) || null;

    if (data.dryRun) {
      // Modo teste: confirma que o upload chegou no Asaas mas NÃO marca o KYC como em análise.
      return { ok: true, dryRun: true, httpStatus: res.status, groupId, referenceId, availableGroups: groupsSummary, response: body };
    }


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

