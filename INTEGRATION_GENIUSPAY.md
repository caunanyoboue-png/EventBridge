# Plan d'intégration — GeniusPay (paiement réel)

> Objectif : remplacer la **simulation** du portefeuille par de vrais mouvements
> Mobile Money via **GeniusPay**, **sans toucher** à l'escrow, au code de présence,
> ni à l'UI. Le prestataire reste **isolé** (comme prévu depuis le début).

## 0. Ce qui change / ce qui ne change pas

**Ne change PAS** (tout est déjà en place) :
- L'escrow : `wallet_pay_contract` (hold), `wallet_release`, `wallet_refund`.
- Le code de présence (`payment_checkins`, `wallet_confirm_presence`).
- Le grand livre `wallet_transactions` et la page `Wallet.tsx`.
- Le paiement d'un **contrat** = mouvement **interne** du solde déjà rechargé → **aucun appel GeniusPay**.

**Change** (2 flux touchent GeniusPay) :
| Flux | Aujourd'hui (simu) | Avec GeniusPay |
|---|---|---|
| **Recharge** du portefeuille | `wallet_recharge` crédite direct | Collecte GeniusPay → **webhook** crédite |
| **Retrait** du freelance | `wallet_withdraw` débite direct | Payout GeniusPay vers son Mobile Money |

**Règle d'or** : le solde n'est **jamais** crédité côté client. Il l'est **uniquement** après confirmation serveur (webhook signé). Sinon = trou « recharge gratuite ».

---

## 1. Prérequis (compte GeniusPay) — à faire par toi

1. Créer un **compte marchand** (particulier) sur pay.genius.ci et passer le KYC (CNI).
2. Récupérer les **clés API** : mode **test** puis **live**.
3. Configurer l'**URL de webhook** = `https://<PROJET>.functions.supabase.co/geniuspay-webhook`.
4. **Confirmer dans leur doc** (indispensable avant de coder — voir §8) :
   - format d'authentification API (header `Authorization: Bearer` ? `api-key` ?),
   - schéma exact requête/réponse de `/payments` et `/payouts`,
   - champs + calcul de signature du **webhook**,
   - mode payout (instantané vs 24-48 h) et frais réels.

---

## 2. Secrets Supabase (Edge Functions)

```bash
supabase secrets set GENIUSPAY_API_KEY=...          # clé marchande
supabase secrets set GENIUSPAY_WEBHOOK_SECRET=...    # pour vérifier le HMAC-SHA256
supabase secrets set GENIUSPAY_MODE=test            # test | live
supabase secrets set GENIUSPAY_BASE_URL=https://pay.genius.ci/api/v1
```
(`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà disponibles côté Edge Functions.)

---

## 3. Base de données — `supabase_migration_geniuspay.sql`

On recrée le pattern « intentions » (comme l'ancien PayDunya) + on **re-coupe** la
recharge/retrait en libre-service (seules les Edge Functions `service_role` créditent/débitent).

```sql
-- 1) Intentions de recharge (collecte)
CREATE TABLE IF NOT EXISTS public.wallet_topups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  provider     TEXT NOT NULL DEFAULT 'geniuspay',
  reference    TEXT UNIQUE NOT NULL,          -- notre référence (metadata)
  external_ref TEXT,                          -- référence GeniusPay
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_topups_select ON public.wallet_topups;
CREATE POLICY wallet_topups_select ON public.wallet_topups FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role='admin'));

-- 2) Intentions de retrait (payout)
CREATE TABLE IF NOT EXISTS public.wallet_payouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  method       TEXT,                          -- ex : "orange-money-ci · +2250700000000"
  reference    TEXT UNIQUE NOT NULL,
  external_ref TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.wallet_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_payouts_select ON public.wallet_payouts;
CREATE POLICY wallet_payouts_select ON public.wallet_payouts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role='admin'));

-- 3) Créditer une recharge confirmée (webhook). Idempotent.
CREATE OR REPLACE FUNCTION public.wallet_topup_apply(p_reference TEXT, p_external TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.wallet_topups%ROWTYPE; newbal INTEGER;
BEGIN
  SELECT * INTO t FROM public.wallet_topups WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recharge introuvable'; END IF;
  IF t.status = 'completed' THEN RETURN; END IF;           -- déjà appliquée
  PERFORM public.ensure_wallet(t.user_id);
  UPDATE public.wallets SET balance = balance + t.amount WHERE user_id = t.user_id RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (t.user_id, 'recharge', t.amount, newbal, 'Recharge Mobile Money', p_reference);
  UPDATE public.wallet_topups SET status='completed', external_ref=COALESCE(p_external,external_ref), completed_at=now() WHERE id=t.id;
END $$;

-- 4) Débiter pour un retrait (au lancement du payout). Atomique.
CREATE OR REPLACE FUNCTION public.wallet_payout_start(p_amount INTEGER, p_method TEXT, p_reference TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); bal INTEGER; newbal INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  PERFORM public.ensure_wallet(uid);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF COALESCE(bal,0) < p_amount THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = uid RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (uid, 'withdrawal', -p_amount, newbal, 'Retrait (' || COALESCE(p_method,'mobile money') || ')', p_reference);
  INSERT INTO public.wallet_payouts(user_id, amount, method, reference, status)
    VALUES (uid, p_amount, p_method, p_reference, 'processing');
END $$;

-- 5) Recréditer si le payout échoue (webhook cashout.failed).
CREATE OR REPLACE FUNCTION public.wallet_payout_reverse(p_reference TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE po public.wallet_payouts%ROWTYPE; newbal INTEGER;
BEGIN
  SELECT * INTO po FROM public.wallet_payouts WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND OR po.status IN ('failed','paid') THEN RETURN; END IF;
  PERFORM public.ensure_wallet(po.user_id);
  UPDATE public.wallets SET balance = balance + po.amount WHERE user_id = po.user_id RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (po.user_id, 'refund', po.amount, newbal, 'Retrait échoué — recrédité', p_reference);
  UPDATE public.wallet_payouts SET status='failed', completed_at=now() WHERE id=po.id;
END $$;

-- 6) Marquer un payout confirmé (webhook cashout.completed).
CREATE OR REPLACE FUNCTION public.wallet_payout_mark_paid(p_reference TEXT, p_external TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.wallet_payouts SET status='paid', external_ref=COALESCE(p_external,external_ref), completed_at=now()
    WHERE reference = p_reference AND status <> 'paid';
END $$;

-- 7) Droits : réservés aux Edge Functions (service_role) ; libre-service COUPÉ
REVOKE EXECUTE ON FUNCTION public.wallet_recharge(INTEGER, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_withdraw(INTEGER, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.wallet_topup_apply(TEXT, TEXT)        TO service_role;
GRANT  EXECUTE ON FUNCTION public.wallet_payout_reverse(TEXT)           TO service_role;
GRANT  EXECUTE ON FUNCTION public.wallet_payout_mark_paid(TEXT, TEXT)   TO service_role;
GRANT  EXECUTE ON FUNCTION public.wallet_payout_start(INTEGER, TEXT, TEXT) TO authenticated; -- appelé par l'Edge Function avec le JWT du freelance
```

> Note : `wallet_pay_contract`, `wallet_release`, `wallet_refund` restent **inchangés**
> (le paiement d'un contrat ne bouge que du solde déjà rechargé).

---

## 4. Edge Functions (Deno) — 3 fonctions

Structure commune : `supabase/functions/<nom>/index.ts`. Les parties `// TODO GeniusPay`
sont à compléter avec **leur doc exacte** (§8).

### a) `geniuspay-collect` — lancer une recharge
```ts
// JWT organisateur requis. Crée un topup pending puis demande une collecte.
Deno.serve(async (req) => {
  const { amount } = await req.json();
  const jwt = req.headers.get('Authorization');            // JWT utilisateur
  const sb  = createClient(SUPABASE_URL, SERVICE_ROLE);     // service_role
  const user = await getUserFromJwt(jwt);                   // auth.getUser(jwt)
  const reference = 'EBTP_' + crypto.randomUUID().replaceAll('-', '');

  await sb.from('wallet_topups').insert({ user_id: user.id, amount, reference });

  // TODO GeniusPay : POST {BASE}/merchant/payments
  //   body : { amount, currency:'XOF', method:'mobile_money',
  //            callback_url:<webhook>, metadata:{ reference } }
  //   header auth : Authorization: Bearer GENIUSPAY_API_KEY (à confirmer)
  //   -> renvoie { payment_url, reference: external_ref }
  const gp = await fetch(`${BASE}/merchant/payments`, { method:'POST', headers, body });
  const data = await gp.json();
  await sb.from('wallet_topups').update({ external_ref: data.reference }).eq('reference', reference);

  return json({ payment_url: data.payment_url });          // le client redirige
});
```

### b) `geniuspay-webhook` — confirmations (déployer avec `--no-verify-jwt`)
```ts
Deno.serve(async (req) => {
  const raw = await req.text();
  const sig = req.headers.get('X-Signature');              // nom exact à confirmer
  if (!verifyHmacSha256(raw, sig, GENIUSPAY_WEBHOOK_SECRET)) return new Response('bad sig', { status: 401 });

  const evt = JSON.parse(raw);
  const sb  = createClient(SUPABASE_URL, SERVICE_ROLE);
  switch (evt.event) {                                     // noms d'événements à confirmer
    case 'payment.success':
      // (vérifier evt.amount == topup.amount côté SQL si besoin)
      await sb.rpc('wallet_topup_apply', { p_reference: evt.metadata.reference, p_external: evt.reference });
      break;
    case 'payment.failed':
    case 'payment.cancelled':
      await sb.from('wallet_topups').update({ status: 'failed' }).eq('reference', evt.metadata.reference);
      break;
    case 'cashout.completed':
      await sb.rpc('wallet_payout_mark_paid', { p_reference: evt.metadata.reference, p_external: evt.reference });
      break;
    case 'cashout.failed':
      await sb.rpc('wallet_payout_reverse', { p_reference: evt.metadata.reference });
      break;
  }
  return new Response('ok');                               // 200 rapide
});
```

### c) `geniuspay-payout` — retrait du freelance
```ts
// JWT freelance requis. Débite le solde (via RPC) PUIS demande le payout.
Deno.serve(async (req) => {
  const { amount, phone, operator } = await req.json();
  const jwt = req.headers.get('Authorization');
  const sbUser = createClient(SUPABASE_URL, ANON, { global:{ headers:{ Authorization: jwt } } });
  const reference = 'EBPO_' + crypto.randomUUID().replaceAll('-', '');
  const method = `${operator} · ${phone}`;

  // Débit atomique + création du payout 'processing' (avec le JWT du freelance)
  const { error } = await sbUser.rpc('wallet_payout_start', { p_amount: amount, p_method: method, p_reference: reference });
  if (error) return json({ error: error.message }, 400);   // solde insuffisant, etc.

  // TODO GeniusPay : POST {BASE}/merchant/payouts
  //   body : { recipient: phone, amount, provider: operator, destination_type:'mobile_money',
  //            wallet_id:<...>, metadata:{ reference } }
  const gp = await fetch(`${BASE}/merchant/payouts`, { method:'POST', headers, body });
  if (!gp.ok) {                                            // échec immédiat → on recrédite
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    await sb.rpc('wallet_payout_reverse', { p_reference: reference });
    return json({ error: 'Versement refusé' }, 400);
  }
  // sinon : le webhook cashout.completed/failed finalisera le statut
  return json({ ok: true, status: 'processing' });
});
```

**Déploiement** :
```bash
supabase functions deploy geniuspay-collect
supabase functions deploy geniuspay-webhook --no-verify-jwt
supabase functions deploy geniuspay-payout
```

---

## 5. Client — repoint de `walletService.ts` (+ `Wallet.tsx`)

```ts
// Recharge : appelle l'Edge Function au lieu du RPC simu
export async function rechargeWallet(amount: number): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/geniuspay-collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
    body: JSON.stringify({ amount }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || 'Erreur recharge');
  return d.payment_url as string;                          // le composant redirige
}

// Retrait : appelle geniuspay-payout (mêmes params qu'aujourd'hui)
export async function requestWithdraw(amount: number, phone: string, operator: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/geniuspay-payout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
    body: JSON.stringify({ amount, phone, operator }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || 'Erreur retrait');
}
```

`Wallet.tsx` : le bouton « Recharger » redirige vers `payment_url` ; au retour (`?recharge=done`),
recharger le solde (le webhook l'aura déjà crédité). Le reste de l'UI est inchangé.

`getWallet`, `getTransactions`, `payMission`(contrat), `releaseEscrow`, `refundEscrow` : **inchangés**.

---

## 6. Sécurité (rappels)
- Crédit du solde **uniquement** via `wallet_topup_apply` appelée par le **webhook signé**.
- **Idempotence** : `reference` unique + `status='completed'` court-circuite un doublon.
- Vérifier `montant`/`devise` du webhook == topup avant crédit.
- `wallet_recharge`/`wallet_withdraw` **re-révoqués** en libre-service.
- Ne jamais logguer les clés ni le corps complet des webhooks.

---

## 7. Ordre d'implémentation
1. Compte sandbox GeniusPay + secrets Supabase.
2. Lancer `supabase_migration_geniuspay.sql`.
3. `geniuspay-collect` + `geniuspay-webhook` → **tester une recharge de 100 F** (bout en bout, solde crédité via webhook).
4. `geniuspay-payout` → **tester un retrait de 100 F** vers un mobile money.
5. Repoint `walletService.ts` + `Wallet.tsx`.
6. Recette complète, puis bascule `GENIUSPAY_MODE=live`.

---

## 8. À confirmer dans la doc GeniusPay (avant de coder)
- [ ] Format d'authentification API (`Authorization: Bearer` ? header `api-key` ?).
- [ ] Schéma exact requête/réponse `/merchant/payments` (champs, `payment_url`, `reference`).
- [ ] Schéma exact `/merchant/payouts` (nom des champs : `recipient`/`phone`, `provider`, `wallet_id`…).
- [ ] Webhook : nom du header de signature, algorithme exact, liste des `event`, champ `metadata`.
- [ ] `callback_url`/`success_url` : configuration (dashboard vs par requête).
- [ ] Mode payout **instantané vs 24-48 h** + frais réels par opérateur.
- [ ] Plafonds (tx max 2 000 000 FCFA, retrait min 1 000 FCFA) et KYC particulier.

---

*Rappel modèle éco : la commission plateforme de 10 % (déjà prélevée à `wallet_pay_contract`)
doit absorber les frais de collecte GeniusPay (~2,5 % Wave à 4,5 % Orange/MTN). Elle le peut.*
