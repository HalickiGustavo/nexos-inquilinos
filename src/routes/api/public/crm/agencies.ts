import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/crm/agencies')({
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
          
          // Fetch agencies
          const { data: agencies, error: agencyError } = await supabaseAdmin
            .from('agency_settings')
            .select('manager_user_id, created_at, org_slug');

          if (agencyError) throw agencyError;

          // Fetch counts separately to avoid relationship issues
          const formattedAgencies = await Promise.all((agencies || []).map(async (a: any) => {
            const [propCount, tenantCount, contractCount] = await Promise.all([
              supabaseAdmin.from('properties').select('*', { count: 'exact', head: true }).eq('manager_id', a.manager_user_id),
              supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('agency_id', a.manager_user_id),
              supabaseAdmin.from('contracts').select('*', { count: 'exact', head: true }).eq('user_id', a.manager_user_id)
            ]);

            return {
              id: a.manager_user_id,
              name: a.org_slug || 'Agency',
              created_at: a.created_at,
              status: 'active',
              total_properties: propCount.count || 0,
              total_tenants: tenantCount.count || 0,
              total_contracts: contractCount.count || 0
            };
          }));

          return new Response(JSON.stringify(formattedAgencies), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error: any) {
          console.error('CRM API Error (agencies):', error);
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
