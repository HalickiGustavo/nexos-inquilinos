import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type UpdateInput = {
  full_name?: string;
  email?: string;
  phone?: string;
  document?: string;
  emergency_contact?: string;
};

const onlyDigits = (v: string) => (v ?? "").replace(/\D+/g, "");

function isValidCPF(raw: string) {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let s = 0;
    for (let i = 0; i < base.length; i++) s += parseInt(base[i], 10) * (factor - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return (
    calc(cpf.slice(0, 9), 10) === parseInt(cpf[9], 10) &&
    calc(cpf.slice(0, 10), 11) === parseInt(cpf[10], 10)
  );
}

function isValidCNPJ(raw: string) {
  const c = onlyDigits(raw);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    const w =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < base.length; i++) s += parseInt(base[i], 10) * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return (
    calc(c.slice(0, 12)) === parseInt(c[12], 10) &&
    calc(c.slice(0, 13)) === parseInt(c[13], 10)
  );
}

export const updateTenantProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpdateInput) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Localiza o tenant do usuário autenticado (blindado: nunca aceita id do cliente).
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("id, user_id_link")
      .eq("user_id_link", context.userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tenant) throw new Error("Registro de inquilino não encontrado.");

    const patch: Record<string, any> = {};
    if (typeof data.full_name === "string") {
      const v = data.full_name.trim();
      if (v.length < 3 || v.length > 120) throw new Error("Nome completo inválido.");
      patch.full_name = v;
    }
    if (typeof data.email === "string") {
      const v = data.email.trim().toLowerCase();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error("E-mail inválido.");
      patch.email = v || null;
    }
    if (typeof data.phone === "string") {
      const d = onlyDigits(data.phone);
      if (d && (d.length < 10 || d.length > 11)) throw new Error("Telefone deve ter DDD + número (10 ou 11 dígitos).");
      patch.phone = d || null;
    }
    if (typeof data.document === "string") {
      const d = onlyDigits(data.document);
      if (!d) {
        patch.document = null;
      } else if (d.length === 11) {
        if (!isValidCPF(d)) throw new Error("CPF inválido.");
        patch.document = d;
      } else if (d.length === 14) {
        if (!isValidCNPJ(d)) throw new Error("CNPJ inválido.");
        patch.document = d;
      } else {
        throw new Error("CPF/CNPJ deve ter 11 ou 14 dígitos.");
      }
    }
    if (typeof data.emergency_contact === "string") {
      const v = data.emergency_contact.trim();
      if (v.length > 200) throw new Error("Contato de emergência muito longo.");
      patch.emergency_contact = v || null;
    }

    if (Object.keys(patch).length === 0) return { ok: true, updated: 0 };

    const { error: uErr } = await supabaseAdmin
      .from("tenants")
      .update(patch)
      .eq("id", tenant.id)
      .eq("user_id_link", context.userId); // blindagem dupla
    if (uErr) throw new Error(uErr.message);

    // Espelha nome/e-mail no profile do usuário logado (não obrigatório).
    const profilePatch: Record<string, any> = {};
    if (patch.full_name) profilePatch.full_name = patch.full_name;
    if (patch.email !== undefined) profilePatch.email = patch.email;
    if (Object.keys(profilePatch).length > 0) {
      await supabaseAdmin.from("profiles").update(profilePatch).eq("id", context.userId);
    }

    return { ok: true, updated: 1 };
  });
