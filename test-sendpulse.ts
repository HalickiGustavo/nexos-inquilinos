// test-sendpulse.ts
// Test script for SendPulse WhatsApp API
import { sendSendPulseWhatsApp } from "./src/lib/sendpulse.server.ts";

async function runTest() {
  console.log("Starting SendPulse WhatsApp Test...");
  
  const result = await sendSendPulseWhatsApp({
    phone: "5541987771358",
    text: "⚠️ Olá! Identificamos que o pagamento do seu boleto no valor de R$ 1.250,00 está atrasado. Evite multas e juros acessando a sua área do inquilino para gerar a segunda via. Se já pagou, ignore esta mensagem."
  });

  console.log("Result:", JSON.stringify(result, null, 2));
}

runTest().catch(console.error);
