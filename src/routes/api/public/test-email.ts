import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '@/lib/resend.server'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/test-email')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const email = url.searchParams.get('email') || 'halickigustavo@gmail.com'
        
        try {
          const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #333;">Boas-vindas à NEXO!</h2>
              <p>Olá! Este é um e-mail de teste do template de <strong>confirmação de inquilino</strong> enviado via Resend.</p>
              <p>Para concluir seu cadastro e acessar o painel do inquilino, clique no botão abaixo:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://dashboard.usenexoapp.com/tenant-setup" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirmar E-mail</a>
              </div>
              <p style="color: #666; font-size: 14px;">Se você não solicitou este cadastro, pode ignorar este e-mail.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px; text-align: center;">NEXO &copy; 2026</p>
            </div>
          `;

          const result = await sendResendEmail({
            to: email,
            subject: "Teste NEXO - Confirmação de Cadastro",
            html,
          });

          return new Response(JSON.stringify({ success: true, result }), {
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
