// Server-only helper to send a WhatsApp text via WAHA API.
// Do not import from client code.

export type WahaSendResult =
  | { ok: true }
  | { ok: false; reason: string; status?: number };

export function sanitizeBrPhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D+/g, "");
  if (!digits) return null;
  let d = digits.replace(/^0+/, "");
  // WAHA typically expects international format without '+'
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

/**
 * Sends a WhatsApp message using WAHA (WhatsApp HTTP API).
 * WAHA default endpoint: POST /api/sendText
 */
export async function sendWahaText(params: {
  phone: string;
  text: string;
  session?: string;
}): Promise<WahaSendResult> {
  const baseUrl = process.env.WAHA_API_URL;
  const session = params.session || process.env.WAHA_API_SESSION || "default";
  const apiKey = process.env.WAHA_API_KEY;

  if (!baseUrl) {
    console.error("WAHA API config missing: WAHA_API_URL is required");
    return { ok: false, reason: "config_missing" };
  }

  const chatId = sanitizeBrPhone(params.phone);
  if (!chatId) return { ok: false, reason: "invalid_phone" };

  // WAHA usually expects chatId as 'number@c.us'
  const formattedChatId = chatId.includes("@") ? chatId : `${chatId}@c.us`;

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/sendText`;
  try {
    const payload = {
      chatId: formattedChatId,
      text: params.text,
      session: session
    };
    
    console.log(`[WAHA] Sending to ${formattedChatId} via ${endpoint}`);
    
    const headers: Record<string, string> = { 
      "Content-Type": "application/json"
    };
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[WAHA] Gateway error: ${res.status}`, body);
      return {
        ok: false,
        reason: `gateway_error: ${body.slice(0, 200)}`,
        status: res.status,
      };
    }
    
    return { ok: true };
  } catch (err: any) {
    console.error(`[WAHA] Network error:`, err);
    return { ok: false, reason: `network_error: ${err?.message ?? "unknown"}` };
  }
}
