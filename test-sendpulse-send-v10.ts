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

  // TENTANDO O ENDPOINT DE CAMPANHAS DE WHATSAPP (A LA BROADCAST)
  // POST https://api.sendpulse.com/whatsapp/campaigns/send
  
  const body = {
    bot_id: senderId,
    phones: [phone],
    template_id: "test",
    variables: []
  };

  console.log(`Tentando envio via /whatsapp/campaigns/send ...`);
  const response = await fetch(`https://api.sendpulse.com/whatsapp/campaigns/send`, {
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
