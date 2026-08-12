import { sendEvolutionText } from "./src/lib/whatsapp.server";

async function testEvolution() {
  console.log("Testing Evolution API directly...");
  
  // Force Evolution by disabling SendPulse in this call's environment context
  const originalClientId = process.env.SENDPULSE_CLIENT_ID;
  const originalClientSecret = process.env.SENDPULSE_CLIENT_SECRET;
  
  delete process.env.SENDPULSE_CLIENT_ID;
  delete process.env.SENDPULSE_CLIENT_SECRET;

  const result = await sendEvolutionText({
    phone: "5541987771358",
    text: "Teste de envio via Evolution API no sistema Nexo.",
  });

  console.log("Evolution Result:", result);

  // Restore
  if (originalClientId) process.env.SENDPULSE_CLIENT_ID = originalClientId;
  if (originalClientSecret) process.env.SENDPULSE_CLIENT_SECRET = originalClientSecret;
}

testEvolution().catch(console.error);
