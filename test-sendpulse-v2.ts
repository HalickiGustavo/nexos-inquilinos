import { sendSendPulseWhatsApp } from "./src/lib/sendpulse.server";

async function test() {
  console.log("Starting SendPulse V2 test...");
  const phone = "5541987771358";
  const text = "Teste Nexo V2: Verificando formato de número e entrega via SendPulse. Valor: R$ 1.250,00.";
  
  const result = await sendSendPulseWhatsApp({ phone, text });
  console.log("Result:", JSON.stringify(result, null, 2));
}

test().catch(console.error);
