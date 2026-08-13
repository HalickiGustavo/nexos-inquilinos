import { createFileRoute } from '@tanstack/react-router';
import { sendEvolutionText } from '@/lib/whatsapp.server';

export const Route = createFileRoute('/api/public/test-whatsapp')({
  server: {
    handlers: {
      GET: async () => {
        const number = "5541987771358";
        const text = "Sua fatura Nexo está disponível para pagamento.";
        
        console.log(`[Test] Sending simple text to ${number}...`);
        const result = await sendEvolutionText({
          phone: number,
          text: text,
          instance: "Nexo suporte"
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
});
