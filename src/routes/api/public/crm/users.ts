import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/crm/users')({
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
          
          const { data: profiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, full_name, created_at');

          if (profileError) throw profileError;

          // Fetch roles separately
          const profilesWithRoles = await Promise.all((profiles || []).map(async (p: any) => {
            const { data: roles } = await supabaseAdmin
              .from('user_roles')
              .select('role')
              .eq('user_id' as any, p.id);
            
            return {
              ...p,
              user_roles: roles || []
            };
          }));

          return new Response(JSON.stringify(profilesWithRoles), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error: any) {
          console.error('CRM API Error (users):', error);
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
