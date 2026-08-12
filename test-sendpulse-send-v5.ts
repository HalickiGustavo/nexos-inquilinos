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

  // O endpoint correto para templates aprovados pela Meta via SendPulse é /whatsapp/messages/send
  // Mas o ID pode ser o NOME ou o ID numérico/hex.
  // Vamos tentar com o NAME "test" em vez do ID longo.
  
  const body = {
    bot_id: senderId,
    phone: phone,
    template_id: "test", // TENTANDO O NOME
    variables: [] 
  };

  console.log("Tentando envio via /whatsapp/messages/send com template_id = 'test' (nome)...");
  const response = await fetch("https://api.sendpulse.com/whatsapp/messages/send", {
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
