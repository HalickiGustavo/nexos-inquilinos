import { sendSendPulseWhatsApp } from "./src/lib/sendpulse.server";

async function test() {
  console.log("Starting SendPulse V2 test...");
  const phone = "5541987771358";
  const text = "Teste Nexo V2: Verificando formato de número e entrega via SendPulse. Valor: R$ 1.250,00.";
  
  // Try sending a template message if generic fails
  const templateId = process.env['SENDPULSE_TEMPLATE_DEFAULT'];
  const variables = { 'full_name': 'Gustavo Halicki', 'amount': 'R$ 1.250,00', 'due_date': '15/08/2026', 'title': 'Teste Nexo' };
  
  const result = await sendSendPulseWhatsApp({ 
    phone, 
    text: "Lembrete: Sua fatura vence em 4 dias.", 
    templateId,
    variables 
  });
  console.log("Result:", JSON.stringify(result, null, 2));
}

test().catch(console.error);
