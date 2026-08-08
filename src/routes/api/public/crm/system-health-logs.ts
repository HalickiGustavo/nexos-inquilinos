import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/public/crm/system-health-logs')({
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
          // Buscando os últimos 1000 registros para cada log importante
          const [efiEvents, starkEvents, emailLogs, auditLogs] = await Promise.all([
            supabaseAdmin.from('efi_events').select('*').order('created_at', { ascending: false }).limit(250),
            supabaseAdmin.from('stark_events').select('*').order('created_at', { ascending: false }).limit(250),
            supabaseAdmin.from('email_send_log').select('*').order('created_at', { ascending: false }).limit(250),
            supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(250)
          ]);

          return new Response(JSON.stringify({
            efi_gateway_events: efiEvents.data || [],
            stark_gateway_events: starkEvents.data || [],
            email_delivery_logs: emailLogs.data || [],
            system_audit_logs: auditLogs.data || []
          }), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error: any) {
          console.error('CRM API Error (system-health-logs):', error);
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
