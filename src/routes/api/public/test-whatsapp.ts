import { createFileRoute } from '@tanstack/react-router'
import { sendEvolutionText } from '@/lib/whatsapp.server'

export const Route = createFileRoute('/api/public/test-whatsapp')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const phone = url.searchParams.get('phone') || '5541987771358'
        const instance = url.searchParams.get('instance') || 'Nexo suporte'
        
        console.log(`[Test] Triggering WhatsApp test to ${phone} via instance "${instance}"`)
        
        const result = await sendEvolutionText({
          phone,
          text: `Teste de cobrança Nexo\n\nOlá, este é um lembrete de teste para o pagamento do seu aluguel.\nValor: R$ 1.250,00\nVencimento: 15/08/2026\n\nPor favor, ignore esta mensagem.`,
          instance
        })

        return new Response(JSON.stringify(result, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  }
})
