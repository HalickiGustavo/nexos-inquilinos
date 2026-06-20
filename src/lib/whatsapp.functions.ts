import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEvolutionText } from "./whatsapp.server";
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
  .handler(async ({ data }) => {
    const text = buildWelcomeMessage(data.nome, data.email);
    const res = await sendEvolutionText({ phone: data.telefone, text });
    if (!res.ok) {
      console.warn("[whatsapp.welcome] falha", res.reason);
    }
    return res;
  });

// Reenvio manual a partir da UI (mesma assinatura).
export const resendWelcomeWhatsApp = sendWelcomeWhatsApp;
