import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/public/crm/financial-analytics')({
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
          // Volume financeiro por status
          const { data: statusStats, error: statusError } = await supabaseAdmin
            .from('installments')
            .select('status, amount, paid_amount');

          if (statusError) throw statusError;

          const summary = (statusStats || []).reduce((acc: any, curr: any) => {
            const amount = Number(curr.amount || 0);
            const paid = Number(curr.paid_amount || 0);
            
            acc.total_transacted += paid;
            
            if (curr.status === 'pago') {
              acc.paid.volume += paid;
              acc.paid.count += 1;
            } else if (curr.status === 'pendente') {
              acc.pending.volume += amount;
              acc.pending.count += 1;
            } else if (curr.status === 'atrasado') {
              acc.overdue.volume += amount;
              acc.overdue.count += 1;
            }
            return acc;
          }, {
            total_transacted: 0,
            paid: { volume: 0, count: 0 },
            pending: { volume: 0, count: 0 },
            overdue: { volume: 0, count: 0 }
          });

          // Distribuição por Gateway
          const { data: gatewayStats } = await supabaseAdmin
            .from('installments')
            .select('charge_provider, paid_amount')
            .eq('status', 'pago');
          
          const gatewayDistribution = (gatewayStats || []).reduce((acc: any, curr: any) => {
            const provider = curr.charge_provider || 'manual';
            acc[provider] = (acc[provider] || 0) + Number(curr.paid_amount || 0);
            return acc;
          }, {});

          // Taxas da plataforma (Estimativa baseada em splits processados)
          const { data: splits } = await supabaseAdmin
            .from('pix_splits')
            .select('nexo_amount');
          
          const platformFees = (splits || []).reduce((sum: number, s: any) => sum + Number(s.nexo_amount || 0), 0);

          return new Response(JSON.stringify({
            financial_summary: summary,
            gateway_distribution: gatewayDistribution,
            platform_fees_retained: platformFees
          }), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error: any) {
          console.error('CRM API Error (financial-analytics):', error);
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
