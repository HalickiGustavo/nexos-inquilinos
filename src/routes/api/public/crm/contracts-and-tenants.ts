import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/public/crm/contracts-and-tenants')({
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
          const [contracts, properties] = await Promise.all([
            supabaseAdmin.from('contracts').select('id, rent_amount, status, end_date, start_date, property_id, tenant_id'),
            supabaseAdmin.from('properties').select('id, status')
          ]);

          const totalProperties = properties.data?.length || 0;
          const rentedProperties = properties.data?.filter(p => p.status === 'alugado')?.length || 0;

          return new Response(JSON.stringify({
            contracts: contracts.data || [],
            occupancy: {
              total_properties: totalProperties,
              rented_properties: rentedProperties,
              vacant_properties: totalProperties - rentedProperties,
              occupancy_rate: totalProperties > 0 ? (rentedProperties / totalProperties) * 100 : 0
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error: any) {
          console.error('CRM API Error (contracts-and-tenants):', error);
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
