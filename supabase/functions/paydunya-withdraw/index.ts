// Edge Function : RETRAIT des gains d'un freelance via PayDunya Disburse (Payout)
// Deploy : supabase functions deploy paydunya-withdraw
// Secrets : PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN, PAYDUNYA_MODE
// NB : l'API Disburse doit être ACTIVÉE sur le compte PayDunya + le compte provisionné.
//     Les noms de champs Disburse peuvent évoluer — à vérifier sur la doc PayDunya à jour.

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

    const { amount, phone, operator } = await req.json();
    const amt = Math.round(Number(amount));
    if (!amt || amt < 200) return json({ error: 'Montant invalide (minimum 200 FCFA)' }, 400);
    if (!phone || !operator) return json({ error: 'Numéro et opérateur requis' }, 400);

    const supa = createClient(SUPABASE_URL, SRV);

    // 1) Débiter d'abord (réservation atomique — évite le double retrait)
    const { error: dErr } = await supa.rpc('wallet_withdraw_apply', {
      p_user: user.id, p_amount: amt, p_method: operator, p_ref: `${phone}`,
    });
    if (dErr) return json({ error: dErr.message }, 400);

    // 2) Transfert PayDunya Disburse
    try {
      const getRes = await fetch(`${PD_BASE}/disburse/get-invoice`, {
        method: 'POST', headers: pdHeaders(),
        body: JSON.stringify({ account_alias: String(phone), amount: amt, withdraw_mode: String(operator) }),
      });
      const get = await getRes.json();
      if (get.response_code !== '00' || !get.disburse_token) {
        throw new Error(get.response_text || 'Disburse : préparation échouée');
      }
      const subRes = await fetch(`${PD_BASE}/disburse/submit-invoice`, {
        method: 'POST', headers: pdHeaders(),
        body: JSON.stringify({ disburse_invoice: get.disburse_token }),
      });
      const sub = await subRes.json();
      if (sub.response_code !== '00') {
        throw new Error(sub.response_text || 'Disburse : exécution échouée');
      }
      return json({ ok: true, reference: get.disburse_token });
    } catch (e) {
      // 3) Échec du transfert → recréditer le solde du freelance
      await supa.rpc('wallet_credit', {
        p_user: user.id, p_amount: amt, p_label: 'Retrait échoué — remboursement',
      });
      return json({ error: (e as Error).message || 'Transfert PayDunya échoué' }, 502);
    }
  } catch (e) {
    return json({ error: (e as Error).message || 'Erreur interne' }, 500);
  }
});
