async function testSend() {
  const phone = "5541987771358";
  const contactId = "6a7a495d493d71eead00ea47";
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

  // Vamos tentar enviar TEMPLATE via /whatsapp/contacts/send
  // Alguns adaptadores fazem isso usando a estrutura interna da Meta
  const body = {
    bot_id: senderId,
    contact_id: contactId,
    message: {
      type: "template",
      template: {
        name: "test",
        language: {
          code: "pt_BR"
        },
        components: []
      }
    }
  };

  console.log("Tentando envio via /whatsapp/contacts/send (com estrutura de template)...");
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
