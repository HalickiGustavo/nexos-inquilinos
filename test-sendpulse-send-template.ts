import { sendSendPulseWhatsApp } from "./src/lib/sendpulse.server";

async function testSend() {
  const phone = "5541987771358";
  const templateId = "6a7a09f89cb5c31a7307c9ed"; // O template "test" que encontramos
  
  console.log(`Enviando template '${templateId}' para ${phone}...`);
  
  const result = await sendSendPulseWhatsApp({
    phone,
    text: "Mensagem de teste de cobrança (Simulada)", // Fallback text
    templateId,
    variables: {} // O template 'test' não parece ter variáveis {{1}} no corpo, mas vamos enviar vazio
  });

  if (result.ok) {
    console.log("Sucesso! Mensagem enviada com ID:", result.messageId);
  } else {
    console.error("Falha ao enviar:", result.reason, "Status:", result.status);
  }
}

testSend();
