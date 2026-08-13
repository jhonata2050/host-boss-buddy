import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { suspendDAAccount } from '@/lib/directadmin.server';

export const Route = createFileRoute('/api/public/cron/maintenance')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        const cronSecret = process.env['CRON_SECRET'] || 'development_secret';

        if (authHeader !== `Bearer ${cronSecret}`) {
          return new Response('Unauthorized', { status: 401 });
        }

        const results = {
          suspensions: 0,
          remindersSent: 0,
          errors: [] as string[]
        };

        try {
          // 1. Verificar faturas vencidas há mais de 3 dias para suspensão
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

          const { data: overdueInvoices } = await supabaseAdmin
            .from('invoices')
            .select('*, invoice_items(service_id)')
            .eq('status', 'pending')
            .lt('due_date', threeDaysAgo.toISOString());

          if (overdueInvoices) {
            for (const invoice of overdueInvoices) {
              for (const item of (invoice as any).invoice_items) {
                if (item.service_id) {
                  const { data: service } = await supabaseAdmin
                    .from('services')
                    .select('*, servers(*)')
                    .eq('id', item.service_id)
                    .single();

                  const s = service as any;
                  if (s && s.status === 'active' && s.username && s.server_id) {
                    try {
                      await suspendDAAccount(s.server_id, s.username);
                      await supabaseAdmin
                        .from('services')
                        .update({ status: 'suspended' } as any)
                        .eq('id', service.id);
                      results.suspensions++;
                    } catch (err: any) {
                      results.errors.push(`Erro ao suspender ${service.id}: ${err.message}`);
                    }
                  }
                }
              }
            }
          }

          // 2. Lógica para deleção após 30 dias poderia ser adicionada aqui
          // 3. Lógica para lembretes de e-mail (necessita integração com lib/emails.server)

          return new Response(JSON.stringify({ 
            success: true, 
            timestamp: new Date().toISOString(),
            ...results 
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
