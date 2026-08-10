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

  console.log("SendPulse Auth Debug - ID:", clientId ? "SET" : "MISSING", "Secret:", clientSecret ? "SET" : "MISSING");

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

    if (!response.ok) {
      console.error("SendPulse OAuth failed:", await response.text());
      return null;
    }
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
    // 1. Try to get contact_id by phone
    const contactCheck = await fetch(`https://api.sendpulse.com/whatsapp/contacts/get_by_phone?phone=${phone}&bot_id=${senderId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    let contactId: string | null = null;
    const checkData = await contactCheck.json();
    
    if (contactCheck.ok && checkData.data?.id) {
      contactId = checkData.data.id;
    } else if (contactCheck.status === 400 || !contactCheck.ok) {
       // If 404 or 400, it might mean they don't exist in the bot yet.
       // The stderr from previous run shows "Contact already exists" when trying to create,
       // which means the contact exists in SendPulse but maybe not returned by get_by_phone
       // or we just need to try a different way to find them.
    }

    // 2. If not found via phone check, try creating (which will either create or give us the error with existing contact)
    if (!contactId) {
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
      } else if (createData.errors?.phone?.includes("Contact already exists")) {
        // Since we know they exist but couldn't get the ID via get_by_phone,
        // we might need to search or use a different endpoint.
        // However, usually 'get_by_phone' should have worked.
        // Let's try to list contacts and find by phone as a fallback.
        const listResponse = await fetch(`https://api.sendpulse.com/whatsapp/contacts?bot_id=${senderId}&page=1&limit=50`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (listResponse.ok) {
          const listData = await listResponse.json();
          const found = listData.data?.find((c: any) => c.phone === phone);
          if (found) contactId = found.id;
        }
      }
    }

    if (!contactId) {
      // Last resort: if we still don't have a contactId but know they exist, 
      // some SendPulse implementations allow using the phone as the ID in specific endpoints
      // but based on 422 errors earlier, it seems it must be the UUID.
      return { ok: false, reason: "contact_id_resolution_failed", status: contactCheck.status };
    }

    // 3. Send the message
    const response = await fetch(`https://api.sendpulse.com/whatsapp/messages/send`, {
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

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, reason: `api_error: ${errorText}`, status: response.status };
    }

    const result = await response.json();
    return { ok: true, messageId: result.data?.message_id };
  } catch (error: any) {
    return { ok: false, reason: `request_failed: ${error.message}` };
  }
}
