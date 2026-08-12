
import { sendEvolutionText } from "./src/lib/whatsapp.server";

async function test() {
  // Forçamos a Evolution API desativando temporariamente as chaves do SendPulse neste contexto
  delete process.env.SENDPULSE_CLIENT_ID;
  delete process.env.SENDPULSE_CLIENT_SECRET;

  const phone = "5541987771358";
  const text = "Olá! Este é um lembrete automático de teste da Nexo (via Evolution API).\n\nIdentificamos o aluguel deste mês no valor de R$ 1.250,50 com vencimento em 15/08/2026 pendente.\n\nPor favor, ignore esta mensagem, é apenas um teste de integração.";

  console.log("Iniciando envio de mensagem de teste via Evolution API...");
  console.log("Telefone:", phone);
  
  try {
    const result = await sendEvolutionText({
      phone,
      text
    });

    if (result.ok) {
      console.log("✅ Mensagem enviada com sucesso pela Evolution API!");
    } else {
      console.error("❌ Falha no envio pela Evolution API:", result.reason);
      if (result.status) console.error("Status HTTP:", result.status);
    }
  } catch (error) {
    console.error("💥 Erro inesperado:", error);
  }
}

test();
