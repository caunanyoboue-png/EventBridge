-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Passage en PRODUCTION (argent réel)
-- À exécuter dans Supabase → SQL Editor, AVANT de basculer la clé GeniusPay en live.
--
-- Objectif : plus aucun mouvement d'argent « simulé » ne doit exister quand
-- l'argent entrant devient réel.
--   • wallet_recharge  → déjà coupée (le crédit passe par le webhook signé)
--   • wallet_withdraw  → COUPÉE ICI (elle débitait le solde sans rien verser)
--   • wallet_payout_start → seule voie de retrait : débit atomique + demande tracée
-- ═══════════════════════════════════════════════════════════════

-- 1) Couper le retrait « simulation » : il débitait le solde sans versement réel.
REVOKE EXECUTE ON FUNCTION public.wallet_withdraw(INTEGER, TEXT) FROM authenticated;

-- 2) Seule voie autorisée : la demande de versement tracée dans wallet_payouts.
GRANT EXECUTE ON FUNCTION public.wallet_payout_start(INTEGER, TEXT, TEXT) TO authenticated;

-- 3) Ceinture et bretelles : la recharge libre-service reste fermée.
REVOKE EXECUTE ON FUNCTION public.wallet_recharge(INTEGER, TEXT) FROM authenticated;

-- ── Vérifications (facultatif : exécuter et lire le résultat) ──────────────
-- Doit renvoyer FALSE, FALSE, TRUE :
SELECT
  has_function_privilege('authenticated', 'public.wallet_recharge(integer,text)',      'EXECUTE') AS recharge_ouverte_doit_etre_false,
  has_function_privilege('authenticated', 'public.wallet_withdraw(integer,text)',      'EXECUTE') AS retrait_simule_doit_etre_false,
  has_function_privilege('authenticated', 'public.wallet_payout_start(integer,text,text)', 'EXECUTE') AS demande_retrait_doit_etre_true;

-- ── Suivi des demandes de retrait à exécuter (tableau de bord admin) ───────
-- Les versements sont effectués manuellement depuis GeniusPay, puis marqués payés.
--
--   SELECT p.reference, p.amount, p.method, p.status, p.created_at, pr.full_name, pr.phone
--     FROM public.wallet_payouts p
--     JOIN public.profiles pr ON pr.id = p.user_id
--    WHERE p.status = 'processing'
--    ORDER BY p.created_at;
--
-- Après avoir réellement envoyé l'argent (référence de la transaction GeniusPay) :
--   SELECT public.wallet_payout_mark_paid('<reference_EBPO_...>', '<ref_geniuspay>');
--
-- Si le versement a échoué (recrédite le freelance) :
--   SELECT public.wallet_payout_reverse('<reference_EBPO_...>');
