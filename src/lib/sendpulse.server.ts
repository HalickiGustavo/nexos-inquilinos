// src/lib/sendpulse.server.ts
// Server-only helper for SendPulse WhatsApp API
// Documentation: https://login.sendpulse.com/apiref/whatsapp

export type SendPulseResult =
  | { ok: true; messageId?: string }
  | { ok: false; reason: string; status?: number };

/**
 * Gets the access token from SendPulse using client ID and client secret.
 * This should ideally be cached to avoid repeated auth calls.
 */
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env['SENDPULSE_CLIENT_ID'];
  const clientSecret = process.env['SENDPULSE_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    console.error("SendPulse config missing: SENDPULSE_CLIENT_ID or SENDPULSE_CLIENT_SECRET");
    return null;
  }

  try {
    const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error authenticating with SendPulse:", error);
    return null;
  }
}

/**
 * Sends a WhatsApp message via SendPulse
 * Note: SendPulse often requires using templates for first-contact or commercial messages.
 * This skeleton provides a generic text message send.
 */
export async function sendSendPulseWhatsApp(params: {
  phone: string;
  text: string;
  senderId?: string; // The ID of the WhatsApp channel in SendPulse
}): Promise<SendPulseResult> {
  // Case edge: invalid phone
  if (!params.phone || params.phone.length < 8) {
    return { ok: false, reason: "invalid_phone" };
  }

  const token = await getAccessToken();
  if (!token) return { ok: false, reason: "auth_failed" };

  const senderId = params.senderId || process.env['SENDPULSE_WHATSAPP_SENDER_ID'];
  if (!senderId) return { ok: false, reason: "sender_id_missing" };

  // Format phone: SendPulse usually expects digits without '+'
  const phone = params.phone.replace(/\D/g, "");

  try {
    // 1. Send the message using the direct 'contacts/send' endpoint
    // This endpoint accepts either contact_id OR phone.
    // If the contact doesn't exist, SendPulse might automatically create them or return a 422 if it's strict.
    // Given the 422 "contact_id is required", we'll try to provide the phone AS the contact_id or use the correct fields.
    
    // According to some versions of SendPulse API, you can send by phone using this:
    const response = await fetch(`https://api.sendpulse.com/whatsapp/contacts/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bot_id: senderId,
        phone: phone,
        message: {
          type: "text",
          text: { body: params.text }
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If the direct phone send fails because of missing contact_id, try to resolve it.
      if (errorText.includes("contact_id") || response.status === 422) {
        // Resolve contact_id
        const check = await fetch(`https://api.sendpulse.com/whatsapp/contacts/get_by_phone?phone=${phone}&bot_id=${senderId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const checkData = await check.json();
        const contactId = checkData.data?.id;

        if (contactId) {
          const retryResponse = await fetch(`https://api.sendpulse.com/whatsapp/contacts/send`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              bot_id: senderId,
              contact_id: contactId,
              message: {
                type: "text",
                text: { body: params.text }
              }
            }),
          });
          if (retryResponse.ok) {
            const result = await retryResponse.json();
            return { ok: true, messageId: result.data?.message_id };
          }
          return { ok: false, reason: `api_error_retry: ${await retryResponse.text()}`, status: retryResponse.status };
        }
      }
      return { ok: false, reason: `api_error: ${errorText}`, status: response.status };
    }

    const result = await response.json();
    return { ok: true, messageId: result.data?.message_id };
  } catch (error: any) {
    return { ok: false, reason: `request_failed: ${error.message}` };
  }
}

