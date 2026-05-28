// Edge Function : webhook CinetPay (confirmation de paiement)
// CinetPay appellera cette URL automatiquement après chaque transaction
// Deploy : supabase functions deploy cinetpay-notify

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SRV_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SRV_KEY);

    // CinetPay envoie les données en form-urlencoded ou JSON selon la version
    let body: Record<string, string> = {};
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const text = await req.text();
      for (const pair of text.split('&')) {
        const [k, v] = pair.split('=');
        if (k) body[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }

    const transactionId = body.cpm_trans_id;
    const result        = body.cpm_result;        // '00' = succès
    const transStatus   = body.cpm_trans_status;  // 'ACCEPTED' = succès

    if (!transactionId) return new Response('missing transaction_id', { status: 400 });

    const success = result === '00' || transStatus === 'ACCEPTED';

    // Charger le paiement
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (!payment) return new Response('payment not found', { status: 404 });
    if (payment.status === 'completed') return new Response('already processed', { status: 200 });

    if (success) {
      // Marquer comme payé
      await supabase.from('payments').update({
        status:  'completed',
        paid_at: new Date().toISOString(),
      }).eq('transaction_id', transactionId);

      // Notifier le freelance
      await supabase.from('notifications').insert({
        user_id: payment.payee_id,
        type:    'payment_received',
        title:   '💰 Paiement reçu !',
        body:    `Votre paiement de ${payment.amount.toLocaleString('fr-CI')} FCFA a été confirmé.`,
        data:    { payment_id: payment.id, contract_id: payment.contract_id },
        is_read: false,
      });

      // Notifier l'organisateur
      await supabase.from('notifications').insert({
        user_id: payment.payer_id,
        type:    'payment_confirmed',
        title:   '✅ Paiement confirmé',
        body:    `Le paiement de ${payment.amount.toLocaleString('fr-CI')} FCFA a été traité avec succès.`,
        data:    { payment_id: payment.id, contract_id: payment.contract_id },
        is_read: false,
      });
    } else {
      await supabase.from('payments').update({ status: 'failed' })
        .eq('transaction_id', transactionId);
    }

    // CinetPay attend une réponse 200
    return new Response('OK', { status: 200 });
  } catch (err: unknown) {
    console.error('[cinetpay-notify]', err);
    return new Response('error', { status: 500 });
  }
});
