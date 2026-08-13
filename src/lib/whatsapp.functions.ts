import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendWhatsAppText } from "./whatsapp.server";
import { buildWelcomeMessage } from "./whatsapp-templates";

export const sendWelcomeWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string; telefone: string; email: string }) =>
    z
      .object({
        nome: z.string().min(1).max(200),
        telefone: z.string().min(8).max(40),
        email: z.string().email().max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Apenas managers/owners podem disparar mensagens via a instância Evolution
    // da plataforma. Sem este gate, qualquer inquilino/proprietário autenticado
    // poderia enviar mensagens arbitrárias (phishing/spam) para qualquer número.
    const [{ data: isManager }, { data: isOwner }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    ]);
    if (!isManager && !isOwner) {
      throw new Error("Forbidden");
    }

    // Confirma que o telefone alvo pertence a um inquilino do próprio caller.
    // A consulta abaixo passa pelo RLS do supabase autenticado, garantindo
    // que apenas inquilinos visíveis ao manager/owner sejam alvo válido.
    const digits = data.telefone.replace(/\D/g, "");
    const last8 = digits.slice(-8);
    if (last8.length < 8) {
      throw new Error("Telefone inválido.");
    }
    const { data: matches, error: tErr } = await supabase
      .from("tenants")
      .select("id, phone")
      .ilike("phone", `%${last8}%`)
      .limit(5);
    if (tErr) throw new Error(tErr.message);
    const ownsTarget = (matches ?? []).some((t: any) => {
      const d = String(t.phone ?? "").replace(/\D/g, "");
      return d.endsWith(last8);
    });
    if (!ownsTarget) {
      throw new Error("Telefone não pertence a um inquilino vinculado.");
    }

    const text = buildWelcomeMessage(data.nome, data.email);
    const res = await sendWhatsAppText({ phone: data.telefone, text });
    if (!res.ok) {
      console.warn("[whatsapp.welcome] falha", res.reason);
    }
    return res;
  });

// Reenvio manual a partir da UI (mesma assinatura).
export const resendWelcomeWhatsApp = sendWelcomeWhatsApp;
