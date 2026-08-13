import { createFileRoute } from '@tanstack/react-router';
import { sendEvolutionText } from '@/lib/whatsapp.server';

export const Route = createFileRoute('/api/public/test-whatsapp')({
  server: {
    handlers: {
      GET: async () => {
        const number = "5541987771358";
        // Simple text message without many spaces or special characters to minimize encoding issues
        const text = "Cobranca Nexo: Sua fatura de aluguel esta disponivel.";
        
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
