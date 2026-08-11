# Passage en production — GeniusPay (EventBridge)

> Objectif : faire passer la **recharge** du portefeuille de la sandbox au **réel** (argent qui rentre).
> Le **retrait (payout)** reste hors périmètre tant qu'il n'est pas construit + testé en sandbox.

---

## ✅ Déjà prêt (aucune action côté code)

- Recharge branchée de bout en bout : `geniuspay-collect` → checkout → webhook → crédit.
- Crédit **idempotent** : `wallet_topup_apply` ne recrédite pas une recharge déjà `completed`.
- Le webhook bascule **tout seul** en HMAC dès que `GENIUSPAY_WEBHOOK_SECRET` est défini
  (sinon il utilise le jeton d'URL `?k=`). Aucun redéploiement de logique nécessaire.
- Tout est **server-side** : aucune clé exposée au client.
- URLs de retour = domaine réel (`window.location.origin`).

---

## 1) Compte GeniusPay (sur leur dashboard) — le vrai travail est ici

- [ ] **KYC** : passer de **Niv.1/3** au niveau requis pour encaisser en production.
      → demander le niveau exact au support (voir message plus bas).
- [ ] Récupérer la **clé API de production** (celle utilisée en **Bearer**, `pk_live_…`).
- [ ] (Recommandé) Obtenir le **secret de signature de production** `whsec_live_…`.
      Le dashboard ne l'affiche pas → **demander au support**.
- [ ] Créer un **webhook en environnement Production** (l'onglet « Production ») :
      même URL `https://qotdjjyhxxkfatduukdr.supabase.co/functions/v1/geniuspay-webhook?k=<TON_JETON>`,
      mêmes événements que la sandbox.

## 2) Config EventBridge (ton terminal)

```bash
supabase secrets set GENIUSPAY_API_KEY=<cle_LIVE_bearer>
supabase secrets set GENIUSPAY_BASE_URL=https://geniuspay.ci/api/v1/merchant
```

Si tu obtiens le whsec de prod (webhook plus sûr en HMAC) :

```bash
supabase secrets set GENIUSPAY_WEBHOOK_SECRET=<whsec_live_…>
```

Puis redéploie pour recharger la config :

```bash
supabase functions deploy geniuspay-collect
supabase functions deploy geniuspay-webhook --no-verify-jwt
```

> L'environnement (sandbox vs live) dépend de la **clé** utilisée, pas de l'URL.
> `GENIUSPAY_MODE` est purement informatif.

## 3) Vérifs avant d'ouvrir au public

- [ ] **Frais GeniusPay** : le webhook renvoie `fees` et `net_amount`. Vérifie leur barème
      pour ta marge (l'organisateur paie le montant plein ; les frais sont à ta charge ou à répercuter).
- [ ] **Un test réel à petit montant (200–500 F), fait par TOI** — argent réel.
      Vérifie que le solde se crédite et que le webhook Production reçoit `payment.success` (logs Supabase).
- [ ] Confirme les URLs de retour sur le domaine réel.

## 4) Sécurité (recommandé avant ouverture)

- [ ] Webhook en **HMAC** (whsec) plutôt que jeton d'URL — plus robuste.
- [ ] Vérifier les logs Supabase des 2 fonctions après le 1er vrai paiement.

---

## Retraits (payout) — versement MANUEL pour l'ouverture

Le retrait automatique (API payout GeniusPay) n'est pas encore construit. Pour ouvrir la
production sans risque, le retrait a été transformé en **demande de versement tracée** :

1. Le freelance demande un retrait → `wallet_payout_start` **débite son solde** (atomique)
   et crée une ligne dans `wallet_payouts` (statut `processing`) avec son numéro Mobile Money.
2. L'administrateur consulte les demandes en attente (requête SQL fournie dans
   `supabase_migration_golive.sql`) et **effectue le virement depuis GeniusPay**.
3. Il marque ensuite la demande payée :
   `SELECT public.wallet_payout_mark_paid('<reference>', '<ref_geniuspay>');`
   En cas d'échec : `SELECT public.wallet_payout_reverse('<reference>');` (recrédite le freelance).

> ⚠️ **`wallet_withdraw` (retrait simulé) est RÉVOQUÉE** par `supabase_migration_golive.sql`.
> Elle débitait le solde **sans verser d'argent** : inoffensif en sandbox, inacceptable en production.

L'automatisation complète (Edge Function `geniuspay-payout` + webhooks `cashout.*`) reste
la prochaine étape ; les fonctions SQL nécessaires existent déjà.

---

## Message à envoyer au support GeniusPay

**À** : support@genius.ci
**Objet** : Passage en production — secret webhook + niveau KYC

> Bonjour,
>
> Marchand : **Myriam Yoboue** (code **GPAY-FUGY**). Mon intégration **sandbox**
> fonctionne (collecte + webhook signé). Avant de passer en **production**, deux questions :
>
> 1. Le **secret de signature du webhook** (`whsec_`) n'apparaît nulle part dans le
>    dashboard (ni à la création du webhook, ni en modification). Comment le récupérer
>    pour vérifier les signatures **HMAC** en production ?
>
> 2. Quel **niveau de KYC** est requis pour (a) **encaisser** (collecte) en production
>    et (b) effectuer des **payouts** (retraits) ? Je suis actuellement **Niv.1/3**.
>
> Merci d'avance !
