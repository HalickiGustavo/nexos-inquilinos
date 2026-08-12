// Server-only helper to send a WhatsApp text via Evolution API or SendPulse.
// Do not import from client code. Imported only inside server-fn handlers
// and TanStack server-route handlers.
import { sendSendPulseWhatsApp } from "./sendpulse.server";


export type EvolutionSendResult =
  | { ok: true }
  | { ok: false; reason: string; status?: number };

export function sanitizeBrPhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D+/g, "");
  if (!digits) return null;
  let d = digits.replace(/^0+/, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

export async function sendEvolutionText(params: {
  phone: string;
  text: string;
  templateId?: string;
  variables?: Record<string, string>;
}): Promise<EvolutionSendResult> {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const instance = process.env.EVOLUTION_API_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  // Se o SendPulse estiver configurado, ele tem precedência
  if (process.env.SENDPULSE_CLIENT_ID && process.env.SENDPULSE_CLIENT_SECRET) {
    return sendSendPulseWhatsApp({
      phone: params.phone,
      text: params.text,
      templateId: params.templateId,
      variables: params.variables
    });
  }

  if (!baseUrl || !instance || !apiKey) {
    return { ok: false, reason: "config_missing" };
  }

  const number = sanitizeBrPhone(params.phone);

  if (!number) return { ok: false, reason: "invalid_phone" };

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(instance)}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        number,
        text: params.text
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `gateway_error: ${body.slice(0, 200)}`,
        status: res.status,
      };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: `network_error: ${err?.message ?? "unknown"}` };
  }
}
