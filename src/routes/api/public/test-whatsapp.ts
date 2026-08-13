import { createFileRoute } from '@tanstack/react-router';
import { sendEvolutionText } from '@/lib/whatsapp.server';

export const Route = createFileRoute('/api/public/test-whatsapp')({
  server: {
    handlers: {
      GET: async () => {
        const number = "5541987771358";
        const text = "Mensagem de teste Nexo - Cobrança";
        
        console.log("[Test] Executing fresh test route...");
        
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
