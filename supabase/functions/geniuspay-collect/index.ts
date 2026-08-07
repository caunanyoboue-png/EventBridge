// EventBridge — GeniusPay : lancer une recharge (collecte).
// Déployer AVEC vérification JWT (l'appelant est l'organisateur connecté).
//
// ⚠️ À CONFIRMER lors du 1er test sandbox (voir INTEGRATION_GENIUSPAY.md §8) :
//   - le header d'auth exact (Bearer <sk> supposé) ;
//   - les noms de champs du body /payments et de la réponse (payment_url / reference).
// Les zones à ajuster sont marquées « TODO GP ».

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const GP_BASE = Deno.env.get('GENIUSPAY_BASE_URL') ?? 'https://pay.genius.ci/api/v1/merchant';
const GP_SECRET = Deno.env.get('GENIUSPAY_SECRET_KEY')!;   // sk_sandbox_… (côté serveur uniquement)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const jwt = req.headers.get('Authorization') ?? '';
    const { amount } = await req.json();
    if (!amount || amount < 200) return json({ error: 'Montant minimum : 200 FCFA.' }, 400);

    // Client "utilisateur" (RLS + RPC avec son JWT) et client service_role
    const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: jwt } } });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: { user }, error: uErr } = await asUser.auth.getUser();
    if (uErr || !user) return json({ error: 'Non authentifié' }, 401);

    // Profil pour les infos client (Mobile Money exige souvent nom/téléphone)
    const { data: profile } = await admin.from('profiles')
      .select('full_name, email, phone').eq('id', user.id).maybeSingle();

    const reference = 'EBTP_' + crypto.randomUUID().replaceAll('-', '');

    // Enregistre l'intention (pending) avec le JWT de l'utilisateur
    const { error: cErr } = await asUser.rpc('wallet_topup_create', { p_amount: amount, p_reference: reference });
    if (cErr) return json({ error: cErr.message }, 400);

    // ── Appel GeniusPay : créer la collecte ─────────────────────────────
    // TODO GP : ajuster les noms de champs selon le Guide d'intégration.
    const gpRes = await fetch(`${GP_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GP_SECRET}`,   // TODO GP : confirmer (Bearer sk vs X-API-Secret)
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'XOF',
        reference,                                  // notre réf
        metadata: { reference, user_id: user.id },
        customer: {
          name: profile?.full_name ?? user.email,
          email: profile?.email ?? user.email,
          phone: profile?.phone ?? '',
        },
        callback_url: `${SUPABASE_URL}/functions/v1/geniuspay-webhook`,
      }),
    });

    const gp = await gpRes.json().catch(() => ({}));
    if (!gpRes.ok) {
      await admin.from('wallet_topups').update({ status: 'failed' }).eq('reference', reference);
      return json({ error: gp?.error?.message ?? gp?.message ?? 'Échec de la collecte GeniusPay', gp }, 400);
    }

    // TODO GP : noms exacts (payment_url / checkout_url / url) et (reference / id)
    const paymentUrl = gp?.data?.payment_url ?? gp?.payment_url ?? gp?.data?.url ?? gp?.url;
    const externalRef = gp?.data?.reference ?? gp?.reference ?? gp?.data?.id ?? gp?.id;
    if (externalRef) await admin.from('wallet_topups').update({ external_ref: String(externalRef) }).eq('reference', reference);

    return json({ payment_url: paymentUrl, reference, raw: gp });
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Erreur serveur' }, 500);
  }
});
