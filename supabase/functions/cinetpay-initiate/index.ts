// Edge Function : initiation d'un paiement CinetPay
// Deploy : supabase functions deploy cinetpay-initiate

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const CINETPAY_API_KEY  = Deno.env.get('CINETPAY_API_KEY')!;
    const CINETPAY_SITE_ID  = Deno.env.get('CINETPAY_SITE_ID')!;
    const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SRV_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth : vérifier que l'appelant est connecté
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Non authentifié' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SRV_KEY);

    // Vérifier le JWT
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
      .auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'Token invalide' }, 401);

    const { contract_id } = await req.json();
    if (!contract_id) return json({ error: 'contract_id requis' }, 400);

    // Charger le contrat
    const { data: contract, error: cErr } = await supabase
      .from('contracts')
      .select('*, organizer:profiles!organizer_id(*), freelance:profiles!freelance_id(*), mission:missions!mission_id(commission_rate)')
      .eq('id', contract_id)
      .single();
    if (cErr || !contract) return json({ error: 'Contrat introuvable' }, 404);
    if (contract.organizer_id !== user.id) return json({ error: 'Action réservée à l\'organisateur' }, 403);
    if (contract.status !== 'signed') return json({ error: 'Le contrat doit être signé avant le paiement' }, 400);

    // Vérifier si paiement déjà existant
    const { data: existing } = await supabase
      .from('payments')
      .select('id, status, payment_url')
      .eq('contract_id', contract_id)
      .in('status', ['processing', 'completed'])
      .maybeSingle();
    if (existing?.status === 'completed') return json({ error: 'Ce contrat a déjà été payé' }, 400);
    if (existing?.status === 'processing' && existing.payment_url) {
      return json({ payment_url: existing.payment_url }); // renvoyer l'URL existante
    }

    const amount = Math.round(contract.total_gross + contract.end_of_contract_indemnity);
    // Commission plateforme : taux de la mission (fraction, ex. 0.10), défaut 10 %.
    const rawRate = Number((contract.mission as { commission_rate?: number })?.commission_rate);
    const rate = rawRate > 0 && rawRate < 1 ? rawRate : 0.10;
    const commissionAmount = Math.round(amount * rate);
    const netAmount = amount - commissionAmount;
    const transactionId = `EB_${Date.now()}_${crypto.randomUUID().replace(/-/g,'').slice(0,8)}`;
    const origin = req.headers.get('origin') || 'https://eventbridge-app.vercel.app';

    // Créer le paiement en DB
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .insert({
        contract_id,
        mission_id:    contract.mission_id,
        payer_id:      contract.organizer_id,
        payee_id:      contract.freelance_id,
        amount,
        commission_amount: commissionAmount,
        net_amount:        netAmount,
        description:   `Paiement contrat — ${contract.job_title}`,
        transaction_id: transactionId,
        status:        'pending',
      })
      .select('id')
      .single();
    if (pErr) throw pErr;

    // Appel API CinetPay
    const cpRes = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey:                 CINETPAY_API_KEY,
        site_id:                CINETPAY_SITE_ID,
        transaction_id:         transactionId,
        amount,
        currency:               'XOF',
        description:            `Contrat EventBridge — ${contract.job_title}`,
        notify_url:             `${SUPABASE_URL}/functions/v1/cinetpay-notify`,
        return_url:             `${origin}/contracts/${contract_id}?payment=done`,
        customer_name:          contract.organizer_name || 'Organisateur',
        customer_surname:       '',
        customer_email:         (contract.organizer as { email?: string })?.email || 'noreply@eventbridge.ci',
        customer_phone_number:  (contract.organizer as { phone?: string })?.phone || '',
        customer_address:       contract.organizer_address || 'Abidjan',
        customer_city:          'Abidjan',
        customer_country:       'CI',
        customer_state:         'CI',
        customer_zip_code:      '00225',
        channels:               'ALL',
        metadata:               JSON.stringify({ payment_id: payment.id, contract_id }),
      }),
    });

    const cpData = await cpRes.json();
    if (cpData.code !== '201') throw new Error(cpData.message || 'Erreur CinetPay');

    // Sauvegarder l'URL et le token
    await supabase.from('payments').update({
      payment_url:    cpData.data.payment_url,
      cinetpay_token: cpData.data.payment_token,
      status:         'processing',
    }).eq('id', payment.id);

    return json({ payment_url: cpData.data.payment_url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne';
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
