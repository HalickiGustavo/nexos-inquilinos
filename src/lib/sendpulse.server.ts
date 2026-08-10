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
    // According to SendPulse docs, we first need to ensure the contact exists or get their contact_id.
    // However, if we don't have it, we can try the direct message endpoint if enabled,
    // or use the 'contacts' endpoint to ensure they exist.
    // Let's try to get contact info first to see if they exist.
    const contactCheck = await fetch(`https://api.sendpulse.com/whatsapp/contacts/get_by_phone?phone=${phone}&bot_id=${senderId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    let contactId: string | null = null;
    const contactData = await contactCheck.json();
    
    if (contactCheck.ok && contactData.data?.id) {
      contactId = contactData.data.id;
    } else {
      // Contact doesn't exist, try to create them
      const createResponse = await fetch(`https://api.sendpulse.com/whatsapp/contacts`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bot_id: senderId,
          phone: phone,
          name: "Cliente Nexo", // Placeholder name
        }),
      });
      
      if (createResponse.ok) {
        const createData = await createResponse.json();
        contactId = createData.data?.id;
      }
    }

    if (!contactId) {
      return { ok: false, reason: "contact_id_resolution_failed", status: contactCheck.status };
    }

    // Now send the message using the resolved contactId
    const response = await fetch(`https://api.sendpulse.com/whatsapp/messages/sendText`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bot_id: senderId,
        contact_id: contactId,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Handle error cases
      return { ok: false, reason: `api_error: ${errorText}`, status: response.status };
    }

    const result = await response.json();
    return { ok: true, messageId: result.data?.message_id };
  } catch (error: any) {
    return { ok: false, reason: `request_failed: ${error.message}` };
  }
}
