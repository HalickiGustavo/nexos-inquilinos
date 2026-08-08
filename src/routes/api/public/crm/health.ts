import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/crm/health')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = request.headers.get('x-api-key');
        const expectedKey = process.env['EXTERNAL_CRM_API_KEY'];

        if (!expectedKey || apiKey !== expectedKey) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          
          // Get Asaas connection count
          const { count: asaasCount } = await supabaseAdmin
            .from('asaas_accounts')
            .select('*', { count: 'exact', head: true });

          // Recent errors (last 24h)
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          
          const [efiErrors, starkErrors, emailErrors] = await Promise.all([
            supabaseAdmin.from('efi_events').select('*', { count: 'exact', head: true }).gt('created_at', yesterday).ilike('status', '%error%'),
            supabaseAdmin.from('stark_events').select('*', { count: 'exact', head: true }).gt('created_at', yesterday).ilike('status', '%error%'),
            supabaseAdmin.from('email_send_log').select('*', { count: 'exact', head: true }).gt('created_at', yesterday).eq('status', 'error')
          ]);

          return new Response(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            integrations: {
              asaas_active_accounts: asaasCount || 0
            },
            recent_errors_24h: {
              efi: efiErrors.count || 0,
              stark: starkErrors.count || 0,
              emails: emailErrors.count || 0
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error: any) {
          console.error('CRM API Error (health):', error);
          return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      },
      OPTIONS: async () => {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'x-api-key, Content-Type'
          }
        });
      }
    }
  }
});
