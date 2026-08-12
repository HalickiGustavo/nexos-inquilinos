import { sendSendPulseWhatsApp } from "./src/lib/sendpulse.server";

async function test() {
  console.log("Starting SendPulse Template Debug...");
  const phone = "5541987771358";
  
  // Explicitly providing a template ID for testing
  // If SENDPULSE_TEMPLATE_DEFAULT is not set, we'll try to use a known one or just see if the call structure is correct
  const templateId = process.env['SENDPULSE_TEMPLATE_DEFAULT'] || "nexo_template_id_here";
  const variables = { 
    'full_name': 'Gustavo Halicki', 
    'amount': 'R$ 1.250,00', 
    'due_date': '15/08/2026', 
    'title': 'Teste Nexo' 
  };
  
  console.log(`Using templateId: ${templateId}`);
  
  const result = await sendSendPulseWhatsApp({ 
    phone, 
    text: "Lembrete: Sua fatura vence em 4 dias.", 
    templateId,
    variables 
  });
  
  console.log("Final Result:", JSON.stringify(result, null, 2));
}

test().catch(console.error);