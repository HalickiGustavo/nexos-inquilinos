// Ativação da conta "manager" (imobiliária) — SEMPRE via server function.
//
// Regras de negócio (evitar escalonamento de privilégios):
// 1. Usuário precisa estar autenticado (requireSupabaseAuth).
// 2. Só pode ativar se AINDA não tiver nenhum papel conflitante
//    (owner, tenant, landlord). Se já tem manager, é idempotente.
// 3. A promoção é feita com supabaseAdmin (bypass RLS) — a tabela
//    user_roles NÃO deve ter policies de INSERT para authenticated.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const activateManagerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    // 1. Papéis já existentes (via RLS do próprio usuário).
    const { data: existing, error: exErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (exErr) throw new Error(exErr.message);

    const roles = new Set((existing ?? []).map((r: any) => r.role));
    if (roles.has("manager")) {
      return { ok: true, alreadyManager: true };
    }
    if (roles.has("owner") || roles.has("tenant") || roles.has("landlord")) {
      throw new Error(
        "Esta conta já possui outro perfil ativo (proprietário/inquilino) e não pode ser convertida em imobiliária.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "manager" as const });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
    return { ok: true, alreadyManager: false };
  });
