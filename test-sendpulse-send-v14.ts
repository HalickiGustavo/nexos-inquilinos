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

  // Vamos tentar enviar TEMPLATE via /whatsapp/contacts/send-template
  // Este é o endpoint mais provável se /messages/send der 404
  const body = {
    bot_id: senderId,
    contact_id: contactId,
    template_id: "6a7a09f89cb5c31a7307c9ed",
    variables: []
  };

  console.log("Tentando envio via /whatsapp/contacts/send-template ...");
  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/send-template", {
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
