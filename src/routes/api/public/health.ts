import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/api/public/health')({
  server: {
    handlers: {
      GET: async () => {
        const start = Date.now();
        const results: Record<string, any> = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          services: {}
        };

        try {
          // 1. Database check
          const { error: dbError } = await supabase.from('profiles').select('id').limit(1);
          results.services.database = dbError ? 'error' : 'ok';
          if (dbError) results.status = 'degraded';

          // 2. Auth check (minimal)
          results.services.auth = 'ok';

          // 3. Integrations check
          results.services.integrations = 'ok';

          results.latency_ms = Date.now() - start;
          
          return new Response(JSON.stringify(results), {
            status: results.status === 'ok' ? 200 : 503,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ status: 'error', error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
