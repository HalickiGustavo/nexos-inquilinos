import { createFileRoute } from '@tanstack/react-router';
import { sendEvolutionText } from '@/lib/whatsapp.server';

export const Route = createFileRoute('/api/public/test-whatsapp')({
  server: {
    handlers: {
      GET: async () => {
        const number = "5541987771358";
        const amount = "R$ 1.500,00";
        const dueDate = "15/08/2026";
        const text = `Olá! Identificamos que a sua fatura do aluguel Nexo está disponível para pagamento.\n\nValor: ${amount}\nVencimento: ${dueDate}\n\nPara realizar o pagamento e evitar juros, acesse seu painel Nexo ou responda para receber o código PIX.`;

        console.log(`[Test] Sending billing message to ${number} using instance "Nexo suporte"...`);
        const result = await sendEvolutionText({
          phone: number,
          text: text
        });

        return new Response(JSON.stringify({ ...result, instance_used: "Nexo suporte" }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
});

