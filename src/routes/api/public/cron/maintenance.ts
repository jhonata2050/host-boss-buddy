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
          deletions: 0,
          remindersSent: 0,
          invoicesGenerated: 0,
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
                        .eq('id', s.id);
                      results.suspensions++;
                    } catch (err: any) {
                      results.errors.push(`Erro ao suspender ${s.id}: ${err.message}`);
                    }
                  }
                }
              }
            }
          }

          // 2. Lógica para deleção após X dias (default 30)
          const { data: sysSettings } = await supabaseAdmin
            .from('system_settings')
            .select('*')
            .eq('key', 'auto_delete_days')
            .maybeSingle();
            
          const deleteDays = Number(sysSettings?.value) || 30;
          const deleteDate = new Date();
          deleteDate.setDate(deleteDate.getDate() - deleteDays);

          const { data: toDeleteServices } = await supabaseAdmin
            .from('services')
            .select('*, servers(*)')
            .eq('status', 'suspended')
            .lt('updated_at', deleteDate.toISOString());

          if (toDeleteServices) {
            const { deleteDAAccount } = await import('@/lib/directadmin.server');
            for (const s of toDeleteServices as any) {
              try {
                if (s.server_id && s.username) {
                  await deleteDAAccount(s.server_id, s.username);
                }
                await supabaseAdmin
                  .from('services')
                  .update({ status: 'terminated' } as any)
                  .eq('id', s.id);
                results.deletions++;
              } catch (err: any) {
                results.errors.push(`Erro ao deletar ${s.id}: ${err.message}`);
              }
            }
          }

          // 3. Gerar faturas recorrentes
          const sevenDaysFromNow = new Date();
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

          const { data: servicesToInvoice } = await supabaseAdmin
            .from('services')
            .select('*, products(*)')
            .eq('status', 'active')
            .eq('auto_renew', true)
            .lte('next_due_date', sevenDaysFromNow.toISOString())
            .or(`next_invoice_date.lte.${new Date().toISOString()},next_invoice_date.is.null`);

          if (servicesToInvoice) {
            for (const service of servicesToInvoice as any) {
              try {
                // Criar fatura
                const { data: invoice, error: invError } = await supabaseAdmin
                  .from('invoices')
                  .insert({
                    user_id: service.user_id,
                    total_amount: service.products.price || 0,
                    status: 'pending',
                    due_date: service.next_due_date,
                    payment_method: 'pix'
                  } as any)
                  .select()
                  .single();

                if (invError) throw invError;

                // Item da fatura
                await supabaseAdmin
                  .from('invoice_items')
                  .insert({
                    invoice_id: invoice.id,
                    amount: service.products.price || 0,
                    description: `Renovação de serviço: ${service.products.name} (${service.domain || 'N/A'})`,
                    service_id: service.id,
                    quantity: 1
                  } as any);

                // Atualizar data da próxima fatura para evitar duplicatas (ex: setar para após o vencimento atual)
                await supabaseAdmin
                  .from('services')
                  .update({ next_invoice_date: service.next_due_date } as any)
                  .eq('id', service.id);

                results.invoicesGenerated++;
              } catch (err: any) {
                results.errors.push(`Erro ao gerar fatura para serviço ${service.id}: ${err.message}`);
              }
            }
          }

          // 4. Lógica para lembretes de e-mail (necessita integração com lib/emails.server)

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
