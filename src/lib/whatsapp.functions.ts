import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Sanitize a Brazilian phone number into E.164 digits (no '+', e.g. 5541999999999).
function sanitizeBrPhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D+/g, "");
  if (!digits) return null;
  // Strip leading zeros
  let d = digits.replace(/^0+/, "");
  // If already starts with 55 and has 12-13 digits, keep as is
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  // Local numbers (10 or 11 digits) — prepend country code
  if (d.length === 10 || d.length === 11) return "55" + d;
  // International number already with a different country code — return as-is if plausible
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

function buildWelcomeMessage(nome: string, email: string): string {
  const firstName = (nome ?? "").trim().split(/\s+/)[0] || "inquilino";
  return (
    `Olá, *${firstName}*! Boas-vindas à **NEXO**. 👋\n\n` +
    `Estamos muito felizes em ter você aqui! A NEXO é a plataforma oficial que cuidará de toda a gestão do seu aluguel, trazendo muito mais praticidade, boletos e suporte na palma da sua mão.\n\n` +
    `*Próximo passo importante:* Acabamos de enviar um e-mail de ativação para *${email}*. Por favor, acesse sua caixa de entrada (e verifique também o lixo eletrônico/spam) para confirmar seu e-mail e liberar o seu acesso ao nosso painel de inquilinos.\n\n` +
    `Se precisar de qualquer ajuda, estamos por aqui! 🚀`
  );
}

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
    const baseUrl = process.env.EVOLUTION_API_URL;
    const instance = process.env.EVOLUTION_API_INSTANCE;
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !instance || !apiKey) {
      console.error("[whatsapp] Evolution API env vars missing");
      return { ok: false as const, reason: "config_missing" };
    }

    const number = sanitizeBrPhone(data.telefone);
    if (!number) {
      console.warn("[whatsapp] invalid phone format", { raw: data.telefone });
      return { ok: false as const, reason: "invalid_phone" };
    }

    const text = buildWelcomeMessage(data.nome, data.email);
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(instance)}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({ number, text, textMessage: { text } }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[whatsapp] gateway error", { status: res.status, body: body.slice(0, 500) });
        return { ok: false as const, reason: "gateway_error", status: res.status };
      }
      return { ok: true as const };
    } catch (err: any) {
      console.error("[whatsapp] network failure", err?.message ?? err);
      return { ok: false as const, reason: "network_error" };
    }
  });
