// Edge Function : initier une RECHARGE du portefeuille via PayDunya (Checkout Invoice)
// Deploy : supabase functions deploy paydunya-initiate
// Secrets requis : PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN, PAYDUNYA_MODE (test|live)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODE = Deno.env.get('PAYDUNYA_MODE') || 'test';
const PD_BASE = MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

function pdHeaders() {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY':  Deno.env.get('PAYDUNYA_MASTER_KEY')!,
    'PAYDUNYA-PRIVATE-KEY': Deno.env.get('PAYDUNYA_PRIVATE_KEY')!,
    'PAYDUNYA-TOKEN':       Deno.env.get('PAYDUNYA_TOKEN')!,
  };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SRV  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const jwt = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Non authentifié' }, 401);
    const { data: { user }, error: aerr } = await createClient(SUPABASE_URL, ANON).auth.getUser(jwt);
    if (aerr || !user) return json({ error: 'Token invalide' }, 401);

    const { amount } = await req.json();
    const amt = Math.round(Number(amount));
    if (!amt || amt < 200) return json({ error: 'Montant invalide (minimum 200 FCFA)' }, 400);

    const supa = createClient(SUPABASE_URL, SRV);
    const origin = req.headers.get('origin') || 'https://flax.vercel.app';

    // 1) Créer la facture PayDunya
    const invRes = await fetch(`${PD_BASE}/checkout-invoice/create`, {
      method: 'POST',
      headers: pdHeaders(),
      body: JSON.stringify({
        invoice: { total_amount: amt, description: 'Recharge du portefeuille EventBridge' },
        store:   { name: 'EventBridge' },
        actions: {
          return_url:   `${origin}/wallet?recharge=done`,
          cancel_url:   `${origin}/wallet?recharge=cancel`,
          callback_url: `${SUPABASE_URL}/functions/v1/paydunya-ipn`,
        },
        custom_data: { user_id: user.id, amount: amt },
      }),
    });
    const inv = await invRes.json();
    if (inv.response_code !== '00' || !inv.token) {
      return json({ error: inv.response_text || 'Création de la facture PayDunya échouée' }, 502);
    }

    // 2) Enregistrer l'intention (le token relie la facture au portefeuille)
    const { error: iErr } = await supa.from('wallet_topups')
      .insert({ user_id: user.id, amount: amt, token: inv.token, status: 'pending' });
    if (iErr) return json({ error: iErr.message }, 500);

    // response_text = URL de paiement PayDunya
    return json({ payment_url: inv.response_text, token: inv.token });
  } catch (e) {
    return json({ error: (e as Error).message || 'Erreur interne' }, 500);
  }
});
