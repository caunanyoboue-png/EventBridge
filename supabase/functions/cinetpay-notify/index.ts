// Edge Function : webhook CinetPay (confirmation de paiement)
// CinetPay appelle cette URL automatiquement après chaque transaction.
//
// SÉCURITÉ : on ne fait JAMAIS confiance au corps de la requête (falsifiable).
// On récupère seulement l'identifiant de transaction, puis on interroge l'API
// CinetPay /v2/payment/check qui est la seule source de vérité, et on vérifie
// que le montant payé correspond au montant attendu avant de valider.
//
// Deploy : supabase functions deploy cinetpay-notify

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SRV_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const CINETPAY_API_KEY = Deno.env.get('CINETPAY_API_KEY')!;
    const CINETPAY_SITE_ID = Deno.env.get('CINETPAY_SITE_ID')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SRV_KEY);

    // CinetPay envoie les données en form-urlencoded ou JSON selon la version.
    // On n'en extrait QUE l'identifiant de transaction.
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

    const transactionId = body.cpm_trans_id || body.transaction_id;
    if (!transactionId) return new Response('missing transaction_id', { status: 400 });

    // Charger le paiement attendu (source de vérité interne : montant, devise…)
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (!payment) return new Response('payment not found', { status: 404 });
    if (payment.status === 'completed') return new Response('already processed', { status: 200 });

    // ── Vérification serveur auprès de CinetPay (anti-falsification) ──────────
    const checkRes = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: CINETPAY_API_KEY,
        site_id: CINETPAY_SITE_ID,
        transaction_id: transactionId,
      }),
    });
    const check = await checkRes.json();

    // En cas d'erreur réseau/API, on NE valide rien et on renvoie 500
    // pour que CinetPay réessaie plus tard.
    if (!check || typeof check.code === 'undefined') {
      console.error('[cinetpay-notify] check API sans réponse exploitable', check);
      return new Response('check unavailable', { status: 500 });
    }

    const cpStatus  = check?.data?.status;                 // 'ACCEPTED' = payé
    const cpAmount  = Math.round(Number(check?.data?.amount ?? -1));
    const expected  = Math.round(Number(payment.amount));
    const accepted  = check.code === '00' && cpStatus === 'ACCEPTED';
    const amountOk  = cpAmount === expected;

    if (accepted && amountOk) {
      await supabase.from('payments').update({
        status:  'completed',
        paid_at: new Date().toISOString(),
      }).eq('transaction_id', transactionId);

      const amountLabel = Number(payment.amount).toLocaleString('fr-CI');
      await supabase.from('notifications').insert([
        {
          user_id: payment.payee_id,
          type:    'payment_received',
          title:   'Paiement reçu !',
          body:    `Votre paiement de ${amountLabel} FCFA a été confirmé.`,
          data:    { payment_id: payment.id, contract_id: payment.contract_id },
          is_read: false,
        },
        {
          user_id: payment.payer_id,
          type:    'payment_confirmed',
          title:   'Paiement confirmé',
          body:    `Le paiement de ${amountLabel} FCFA a été traité avec succès.`,
          data:    { payment_id: payment.id, contract_id: payment.contract_id },
          is_read: false,
        },
      ]);
    } else if (accepted && !amountOk) {
      // Statut OK mais montant incohérent → ne pas valider, tracer l'anomalie.
      console.error('[cinetpay-notify] montant incohérent', { transactionId, cpAmount, expected });
      await supabase.from('payments').update({ status: 'failed' })
        .eq('transaction_id', transactionId);
    } else if (cpStatus === 'REFUSED' || check.code === '600') {
      await supabase.from('payments').update({ status: 'failed' })
        .eq('transaction_id', transactionId);
    }
    // Sinon (en attente / pending) : on laisse le paiement en l'état.

    // CinetPay attend une réponse 200.
    return new Response('OK', { status: 200 });
  } catch (err: unknown) {
    console.error('[cinetpay-notify]', err);
    return new Response('error', { status: 500 });
  }
});
