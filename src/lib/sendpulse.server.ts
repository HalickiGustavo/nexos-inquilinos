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
  templateId?: string;
  variables?: Record<string, string>;
}): Promise<SendPulseResult> {
  // Case edge: invalid phone
  if (!params.phone || params.phone.length < 8) {
    return { ok: false, reason: "invalid_phone" };
  }

  const token = await getAccessToken();
  if (!token) return { ok: false, reason: "auth_failed" };

  const senderId = (params.senderId || process.env['SENDPULSE_WHATSAPP_SENDER_ID'])?.trim();
  if (!senderId) return { ok: false, reason: "sender_id_missing" };

  // Format phone: SendPulse usually expects digits without '+'
  const phone = params.phone.replace(/\D/g, "");

  try {
    // 1. First, always ensure we have a valid contact_id.
    // SendPulse is strict about contact_id for the /contacts/send endpoint.
    let contactId: string | null = null;

    // Try to get contact_id by phone
    const check = await fetch(`https://api.sendpulse.com/whatsapp/contacts/get_by_phone?phone=${phone}&bot_id=${senderId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (check.ok) {
      const checkData = await check.json();
      contactId = checkData.data?.id;
      console.log(`[SendPulse] Found contact_id via phone: ${contactId}`);
    } else {
      // Consume body if it exists to avoid issues
      await check.text().catch(() => {});
    }

    // 2. If not found, attempt to create the contact.
    if (!contactId) {
      console.log(`[SendPulse] Contact not found for ${phone}, attempting to create...`);
      const createResponse = await fetch(`https://api.sendpulse.com/whatsapp/contacts`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bot_id: senderId,
          phone: phone,
          name: "Cliente Nexo",
        }),
      });
      
      const createData = await createResponse.json();
      if (createResponse.ok && createData.data?.id) {
        contactId = createData.data.id;
        console.log(`[SendPulse] Created contact_id: ${contactId}`);
      } else if (createData.errors?.phone?.includes("Contact already exists") || createData.error_code === 422) {
        // Fallback: search for contact by phone if creation says it exists but get_by_phone failed
        console.log(`[SendPulse] Contact creation failed (likely exists), searching in list...`);
        const search = await fetch(`https://api.sendpulse.com/whatsapp/contacts?bot_id=${senderId}&page=1&limit=50`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (search.ok) {
          const searchData = await search.json();
          const found = searchData.data?.find((c: any) => {
            const p = c.channel_data?.phone || c.phone || c.phone_number;
            if (!p) return false;
            return String(p).replace(/\D/g, "") === phone;
          });
          if (found) {
            contactId = found.id;
            console.log(`[SendPulse] Found contact_id via list search: ${contactId}`);
          }
        }
      }
    }

    // SendPulse generic text (POST /whatsapp/contacts/send) requires a 24h active session.
    // Templates (POST /whatsapp/messages/send) can be sent outside the 24h window.
    const isTemplate = !!params.templateId;

    if (!contactId && !isTemplate) {
      return { ok: false, reason: "contact_id_resolution_failed" };
    }

    // 3. Send the message
    // If template is provided, use template endpoint; otherwise use generic text
    // Note: SendPulse generic text requires a session within 24h.
    // For automated notifications, we should ideally use templates.
    // SendPulse rules:
    // 1. Generic text (POST /whatsapp/contacts/send) requires a 24h active session.
    // 2. Templates (POST /whatsapp/messages/send) can be sent outside the 24h window.
    
    // Explicitly check for template use. If we have a templateId, we MUST use the template endpoint.
    
    // According to some versions of SendPulse docs, the template endpoint is:
    // POST /whatsapp/messages/send
    // Body: { "bot_id": "...", "phone": "...", "template_id": "...", "variables": { ... } }
    
    const endpoint = isTemplate 
      ? `https://api.sendpulse.com/whatsapp/messages/send` 
      : `https://api.sendpulse.com/whatsapp/contacts/send`;

    const body: any = isTemplate
      ? {
          bot_id: senderId,
          phone: phone,
          template_id: params.templateId,
          variables: params.variables || {}
        }
      : {
          bot_id: senderId,
          contact_id: contactId,
          message: {
            type: "text",
            text: { body: params.text }
          }
        };

    console.log(`[SendPulse] Attempting to send via ${isTemplate ? 'TEMPLATE' : 'GENERIC TEXT'} to ${phone}`);
    console.log(`[SendPulse] Endpoint: ${endpoint}`);

    // Documentation check: template send often requires contact_id too?
    // Actually, SendPulse Docs for /whatsapp/messages/send says:
    // { "bot_id": "...", "phone": "...", "template_id": "...", "variables": { ... } }
    // OR it might need "contact_id".
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SendPulse] Error response from ${endpoint}:`, errorText);
      
      if (response.status === 422 && errorText.includes("Contact is not active in 24hours")) {
        console.warn(`[SendPulse] Session error: Generic text requires 24h active session. Try using a template.`);
      }
      return { ok: false, reason: `api_error: ${errorText}`, status: response.status };
    }


    const result = await response.json();
    return { ok: true, messageId: result.data?.message_id };
  } catch (error: any) {
    return { ok: false, reason: `request_failed: ${error.message}` };
  }
}

