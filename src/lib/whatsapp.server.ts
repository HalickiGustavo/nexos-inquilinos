// Server-only helper to send a WhatsApp text via Evolution API.
// Do not import from client code. Imported only inside server-fn handlers
// and TanStack server-route handlers.

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
  instance?: string;
}): Promise<EvolutionSendResult> {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const instance = params.instance || "Nexo suporte";
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!baseUrl || !instance || !apiKey) {
    console.error("Evolution API config missing", { baseUrl, instance, apiKey: apiKey ? '***' : 'missing' });
    return { ok: false, reason: "config_missing" };
  }

  const number = sanitizeBrPhone(params.phone);
  if (!number) return { ok: false, reason: "invalid_phone" };

  const encodedInstance = encodeURIComponent(instance);
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/message/sendText/${encodedInstance}`;
  try {
    const payload = {
      number,
      text: params.text
    };
    
    console.log(`[Evolution] Sending to ${number} via ${endpoint}`);
    
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "apikey": apiKey 
      },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Evolution] Gateway error: ${res.status}`, body);
      return {
        ok: false,
        reason: `gateway_error: ${body.slice(0, 200)}`,
        status: res.status,
      };
    }
    
    return { ok: true };
  } catch (err: any) {
    console.error(`[Evolution] Network error:`, err);
    return { ok: false, reason: `network_error: ${err?.message ?? "unknown"}` };
  }
}
