import { createFileRoute } from '@tanstack/react-router';
import { sendWhatsAppText } from '@/lib/whatsapp.server';

export const Route = createFileRoute('/api/public/test-whatsapp')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const phone = url.searchParams.get('phone') || '5541987771358';
        const text = url.searchParams.get('text') || 'Teste de cobrança Nexo via WAHA - R$ 150,00';
        
        console.log(`[Test] Sending WAHA message to ${phone}`);
        
        const result = await sendWhatsAppText({
          phone,
          text
        });

        return new Response(JSON.stringify({
          success: result.ok,
          result
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
});
