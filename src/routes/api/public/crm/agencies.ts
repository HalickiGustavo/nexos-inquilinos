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
          
          // Fetch agencies with counts
          const { data: agencies, error } = await supabaseAdmin
            .from('agency_settings')
            .select(`
              id,
              name,
              created_at,
              status,
              properties:properties(count),
              tenants:profiles!agency_id(count),
              contracts:contracts(count)
            `);

          if (error) throw error;

          const formattedAgencies = agencies.map(a => ({
            id: a.id,
            name: a.name,
            created_at: a.created_at,
            status: a.status,
            total_properties: a.properties?.[0]?.count || 0,
            total_tenants: a.tenants?.[0]?.count || 0,
            total_contracts: a.contracts?.[0]?.count || 0
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
