import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAsaasAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ account: null }));

export const startAsaasCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ onboardingUrl: "#" }));

export const generateAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ installmentId: z.any(), billingType: z.string() }))
  .handler(async () => ({ ok: false, error: "Integração Asaas removida." }));

export const updateAsaasChargeFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ installmentId: z.any() }))
  .handler(async () => ({ ok: false, error: "Integração Asaas removida." }));

export const simulateAsaasPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ installmentId: z.any() }))
  .handler(async () => ({ ok: false, error: "Integração Asaas removida." }));

export const generateTenantInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ tenantId: z.string(), redirectUrl: z.string() }))
  .handler(async () => ({ actionLink: "#" }));

export const completeTenantSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    fullName: z.string(),
    document: z.string(),
    email: z.string(),
    phone: z.string(),
    acceptTerms: z.literal(true),
    acceptNexoFee: z.literal(true)
  }))
  .handler(async () => ({ ok: true }));

export const linkAsaasBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ ok: true }));

export const getAsaasOnboardingLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ url: "#" }));
