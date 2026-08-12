import { sendSendPulseWhatsApp } from "./src/lib/sendpulse.server";

async function testSend() {
  const phone = "5541987771358";
  const senderId = process.env['SENDPULSE_WHATSAPP_SENDER_ID']?.trim();
  const clientId = process.env['SENDPULSE_CLIENT_ID'];
  const clientSecret = process.env['SENDPULSE_CLIENT_SECRET'];

  const authRes = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const { access_token } = await authRes.json();

  // Vamos tentar o endpoint /whatsapp/contacts/send com o template no corpo
  // Alguns SDKs do SendPulse usam esse endpoint para tudo
  const body = {
    bot_id: senderId,
    phone: phone, // Tentando 'phone' em vez de 'contact_id' no generic endpoint
    message: {
      type: "template",
      template: {
        name: "test", // O nome do template que vimos no list
        language: {
          code: "pt_BR"
        }
      }
    }
  };

  console.log("Tentando envio via /whatsapp/contacts/send com payload de template...");
  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const resData = await response.json();
  console.log("Resposta:", JSON.stringify(resData, null, 2));
}

testSend();
