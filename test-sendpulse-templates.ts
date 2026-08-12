import { sendSendPulseWhatsApp } from "./src/lib/sendpulse.server";

async function listTemplates() {
  const clientId = process.env['SENDPULSE_CLIENT_ID'];
  const clientSecret = process.env['SENDPULSE_CLIENT_SECRET'];
  const senderId = process.env['SENDPULSE_WHATSAPP_SENDER_ID']?.trim();

  if (!clientId || !clientSecret || !senderId) {
    console.error("Missing SendPulse config");
    return;
  }

  try {
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

    console.log("Fetching templates for bot:", senderId);
    const response = await fetch(`https://api.sendpulse.com/whatsapp/templates?bot_id=${senderId}`, {
      headers: { "Authorization": `Bearer ${access_token}` }
    });
    
    const data = await response.json();
    console.log("Templates found:", JSON.stringify(data, null, 2));

    if (data.data && data.data.length > 0) {
      console.log("\n--- Resumo de Templates ---");
      data.data.forEach((t: any) => {
        console.log(`- Nome: ${t.name} (ID: ${t.id})`);
        console.log(`  Status: ${t.status}`);
        console.log(`  Idioma: ${t.language}`);
        console.log(`  Estrutura:`, JSON.stringify(t.components, null, 2));
      });
    } else {
      console.log("Nenhum template encontrado ou erro na resposta.");
    }
  } catch (error) {
    console.error("Error listing templates:", error);
  }
}

listTemplates();
