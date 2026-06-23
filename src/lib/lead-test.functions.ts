import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendTestLeadNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone?: string }) =>
    z.object({ phone: z.string().max(40).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { sendEvolutionText, sanitizeBrPhone } = await import("@/lib/whatsapp.server");

    let phone = data.phone ?? null;
    if (!phone) {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("phone")
        .eq("id", context.userId)
        .maybeSingle();
      phone = (profile as { phone?: string | null } | null)?.phone ?? null;
    }
    if (!phone || !sanitizeBrPhone(phone)) {
      throw new Error("Telefone inválido. Cadastre um telefone no perfil ou informe um número.");
    }

    const text =
      `🔔 *Novo lead NEXO* (TESTE)\n` +
      `Cliente: João da Silva\n` +
      `Telefone: (41) 99999-0000\n` +
      `Imóvel: Apto Teste — Corretor Gustavpo (IM-TESTE)\n` +
      `Portal: ZapImóveis\n` +
      `Critério: Corretor do Imóvel\n\n` +
      `_Esta é uma mensagem de teste enviada pelo painel NEXO._`;

    await sendEvolutionText({ phone, text });
    return { ok: true, phone };
  });
