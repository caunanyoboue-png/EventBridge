// EventBridge — GeniusPay : webhook (confirmations collecte + payout).
// Déployer AVEC --no-verify-jwt (appelé par GeniusPay, pas par un utilisateur).
//
// Sécurité : on n'agit QUE sur un appel authentifié. Deux mécanismes acceptés :
//   1) Signature HMAC-SHA256(timestamp + '.' + body, GENIUSPAY_WEBHOOK_SECRET)
//      via le header X-Webhook-Signature — le plus sûr, dès que GeniusPay expose le whsec ;
//   2) Repli : un jeton secret dans l'URL (?k=GENIUSPAY_WEBHOOK_TOKEN), utile tant que le
//      dashboard GeniusPay ne montre pas le whsec. On configure alors l'URL du webhook ainsi :
//      https://qotdjjyhxxkfatduukdr.supabase.co/functions/v1/geniuspay-webhook?k=<TOKEN>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WH_SECRET = Deno.env.get('GENIUSPAY_WEBHOOK_SECRET') ?? '';   // whsec_… (optionnel pour l'instant)
const WH_TOKEN  = Deno.env.get('GENIUSPAY_WEBHOOK_TOKEN')  ?? '';   // jeton d'URL de repli

async function signHmac(payload: string): Promise<{ hex: string; b64: string }> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(WH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const bytes = new Uint8Array(mac);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const b64 = btoa(String.fromCharCode(...bytes));
  return { hex, b64 };
}

// Comparaison à temps constant (anti timing-attack) pour le jeton d'URL.
function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const raw = await req.text();
  const sig = req.headers.get('X-Webhook-Signature') ?? '';
  const ts = req.headers.get('X-Webhook-Timestamp') ?? '';
  const evtType = req.headers.get('X-Webhook-Event') ?? '';

  // Authentification : HMAC (si le whsec est configuré) OU jeton d'URL (?k=…) en repli.
  let authorized = false;
  if (WH_SECRET && sig) {
    try {
      const { hex, b64 } = await signHmac(`${ts}.${raw}`);
      if (sig === hex || sig === b64) authorized = true;
    } catch { /* secret mal formé → on tentera le jeton */ }
  }
  if (!authorized && WH_TOKEN) {
    const k = new URL(req.url).searchParams.get('k') ?? '';
    if (k && ctEqual(k, WH_TOKEN)) authorized = true;
  }
  if (!authorized) return new Response('unauthorized', { status: 401 });

  let evt: Record<string, unknown> = {};
  try { evt = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const type = (evtType || (evt.event as string) || (evt.type as string) || '').toLowerCase();
  const data = (evt.data as Record<string, unknown>) ?? evt;
  const meta = (data.metadata as Record<string, unknown>) ?? (evt.metadata as Record<string, unknown>) ?? {};
  const metaRef = String(meta.reference ?? '');
  const gpRef = String(data.reference ?? data.id ?? '');   // réf/id GeniusPay (= external_ref stocké)

  // Retrouve NOTRE référence : metadata en priorité, sinon via l'external_ref (réf GeniusPay).
  async function ourRef(table: 'wallet_topups' | 'wallet_payouts'): Promise<string> {
    if (metaRef) return metaRef;
    if (!gpRef) return '';
    const { data: row } = await admin.from(table).select('reference').eq('external_ref', gpRef).maybeSingle();
    return (row as { reference?: string } | null)?.reference ?? '';
  }

  try {
    if (type.includes('payment') && type.includes('success')) {
      const ref = await ourRef('wallet_topups');
      if (ref) await admin.rpc('wallet_topup_apply', { p_reference: ref, p_external: gpRef });
    } else if (type.includes('payment') && (type.includes('fail') || type.includes('cancel'))) {
      const ref = await ourRef('wallet_topups');
      if (ref) await admin.from('wallet_topups').update({ status: 'failed' }).eq('reference', ref);
    } else if (type.includes('cashout') && (type.includes('complete') || type.includes('paid') || type.includes('success'))) {
      const ref = await ourRef('wallet_payouts');
      if (ref) await admin.rpc('wallet_payout_mark_paid', { p_reference: ref, p_external: gpRef });
    } else if (type.includes('cashout') && type.includes('fail')) {
      const ref = await ourRef('wallet_payouts');
      if (ref) await admin.rpc('wallet_payout_reverse', { p_reference: ref });
    }
  } catch (_e) { /* on répond 200 quand même : GeniusPay retentera si besoin */ }

  return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
});
