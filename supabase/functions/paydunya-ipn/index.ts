// Edge Function : webhook PayDunya (IPN) — crédite le portefeuille après paiement confirmé
// Deploy : supabase functions deploy paydunya-ipn --no-verify-jwt
// (--no-verify-jwt car PayDunya appelle sans JWT ; on vérifie via l'API PayDunya)
// Secrets requis : PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN, PAYDUNYA_MODE

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

serve(async (req) => {
  try {
    // PayDunya envoie le token soit en form-data (champ "data" = JSON), soit en JSON.
    let token: string | undefined;
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const b = await req.json().catch(() => ({}));
      token = b?.data?.invoice?.token || b?.invoice?.token || b?.token;
    } else {
      const form = await req.formData().catch(() => null);
      const raw = form?.get('data');
      if (raw) { try { const d = JSON.parse(String(raw)); token = d?.invoice?.token; } catch { /* ignore */ } }
      token = token || (form?.get('token') as string | null) || undefined;
    }
    if (!token) return new Response('token manquant', { status: 400 });

    // Vérifier le statut réel auprès de PayDunya (ne pas faire confiance au POST seul)
    const confRes = await fetch(`${PD_BASE}/checkout-invoice/confirm/${token}`, { headers: pdHeaders() });
    const conf = await confRes.json();
    if (conf.status !== 'completed') return new Response('paiement non finalisé', { status: 200 });

    // Créditer le portefeuille (idempotent grâce au token)
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await supa.rpc('wallet_topup_apply', { p_token: token });
    if (error) return new Response(error.message, { status: 500 });

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response((e as Error).message || 'Erreur', { status: 500 });
  }
});
