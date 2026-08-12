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

  // TENTANDO O ENDPOINT /whatsapp/messages/send
  // Mas vamos incluir variáveis formatadas como ARRAY de strings, que é um padrão do SendPulse
  
  const body = {
    bot_id: senderId,
    phone: phone,
    template_id: "6a7a09f89cb5c31a7307c9ed", // ID longo
    variables: [] 
  };

  console.log(`Tentando envio via /whatsapp/messages/send (Novamente, com ID longo) ...`);
  const response = await fetch(`https://api.sendpulse.com/whatsapp/messages/send`, {
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
