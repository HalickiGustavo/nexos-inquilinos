import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAsaasAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ account: null }));

export const startAsaasCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ onboardingUrl: "#" }));

export const generateAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ ok: false, error: "Integração Asaas removida." }));

export const updateAsaasChargeFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ ok: false, error: "Integração Asaas removida." }));

export const simulateAsaasPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ ok: false, error: "Integração Asaas removida." }));

export const generateTenantInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ actionLink: "#" }));

export const completeTenantSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ ok: true }));

export const linkAsaasBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ ok: true }));

export const getAsaasOnboardingLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ url: "#" }));
