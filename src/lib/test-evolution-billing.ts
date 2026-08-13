import { sendEvolutionText } from "./whatsapp.server";

async function testBillingMessage() {
  const number = "5541987771358";
  const amount = "R$ 1.500,00";
  const dueDate = "15/08/2026";
  const text = `Olá! Identificamos que a sua fatura do aluguel Nexo está disponível para pagamento.\n\nValor: ${amount}\nVencimento: ${dueDate}\n\nPara realizar o pagamento e evitar juros, acesse seu painel Nexo ou responda para receber o código PIX.`;

  console.log(`Enviando mensagem de cobrança para ${number}...`);
  
  const result = await sendEvolutionText({
    phone: number,
    text: text
  });

  if (result.ok) {
    console.log("Mensagem enviada com sucesso via Evolution API!");
  } else {
    console.error("Falha ao enviar mensagem:", result.reason);
  }
}

testBillingMessage().catch(console.error);
