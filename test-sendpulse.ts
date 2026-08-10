import { sendSendPulseWhatsApp } from "./src/lib/sendpulse.server";

async function testNotification() {
  const phone = "5541987771358";
  const amount = "R$ 1.250,00";
  const message = `⚠️ Olá! Identificamos que o pagamento do seu boleto no valor de ${amount} está atrasado. Evite multas e juros acessando a sua área do inquilino para gerar a segunda via. Se já pagou, ignore esta mensagem.`;

  console.log(`Enviando mensagem de teste para ${phone}...`);
  
  const result = await sendSendPulseWhatsApp({
    phone,
    text: message,
  });

  if (result.ok) {
    console.log("Mensagem enviada com sucesso!", result.messageId);
  } else {
    console.error("Falha ao enviar mensagem:", result.reason);
  }
}

testNotification().catch(console.error);
