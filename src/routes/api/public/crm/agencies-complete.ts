import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/public/crm/agencies-complete')({
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
          const { data: agencies, error: agencyError } = await supabaseAdmin
            .from('agency_settings')
            .select('*');

          if (agencyError) throw agencyError;

          const detailedAgencies = await Promise.all((agencies || []).map(async (a: any) => {
            const [users, contracts, properties, tenants, inspections, maintenances] = await Promise.all([
              supabaseAdmin.from('profiles').select('id, email, full_name').eq('id' as any, a.manager_user_id),
              supabaseAdmin.from('contracts').select('*').eq('user_id' as any, a.manager_user_id),
              supabaseAdmin.from('properties').select('*').eq('user_id' as any, a.manager_user_id),
              supabaseAdmin.from('tenants').select('*').eq('user_id' as any, a.manager_user_id),
              supabaseAdmin.from('inspections' as any).select('*').eq('manager_id' as any, a.manager_user_id),
              supabaseAdmin.from('maintenances').select('*').eq('user_id' as any, a.manager_user_id)
            ]);

            return {
              agency: a,
              users: users.data || [],
              metrics: {
                total_contracts: contracts.data?.length || 0,
                total_properties: properties.data?.length || 0,
                total_tenants: tenants.data?.length || 0,
                total_inspections: inspections.data?.length || 0,
                total_maintenances: maintenances.data?.length || 0
              },
              revenue_estimate: (contracts.data || []).reduce((sum: number, c: any) => sum + (c.rent_amount * (c.agency_admin_fee_percentage / 100)), 0)
            };
          }));

          return new Response(JSON.stringify(detailedAgencies), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error: any) {
          console.error('CRM API Error (agencies-complete):', error);
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
