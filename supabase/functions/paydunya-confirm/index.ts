// Edge Function : confirmer une RECHARGE au retour de PayDunya (filet de sécurité)
// Vérifie la dernière recharge en attente de l'utilisateur auprès de PayDunya et crédite si payée.
// (Complète le webhook paydunya-ipn ; utile car les IPN sandbox ne sont pas toujours envoyés.)
// Deploy : supabase functions deploy paydunya-confirm --no-verify-jwt

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

    const supa = createClient(SUPABASE_URL, SRV);

    // Recharges en attente récentes de cet utilisateur (jusqu'à 5)
    const { data: topups } = await supa.from('wallet_topups')
      .select('token, amount').eq('user_id', user.id).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(5);
    if (!topups || topups.length === 0) return json({ credited: false, reason: 'aucune recharge en attente' });

    // Vérifier chacune auprès de PayDunya, créditer celles qui sont payées (idempotent)
    let count = 0; let total = 0;
    for (const t of topups) {
      const confRes = await fetch(`${PD_BASE}/checkout-invoice/confirm/${t.token}`, { headers: pdHeaders() });
      const conf = await confRes.json().catch(() => ({}));
      if (conf.status === 'completed') {
        const { error } = await supa.rpc('wallet_topup_apply', { p_token: t.token });
        if (!error) { count++; total += t.amount; }
      }
    }
    return json({ credited: count > 0, count, amount: total });
  } catch (e) {
    return json({ error: (e as Error).message || 'Erreur interne' }, 500);
  }
});
