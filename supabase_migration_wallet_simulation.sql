-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Retour du portefeuille en mode SIMULATION
-- Annule l'ancien branchement de paiement externe.
-- À exécuter dans Supabase → SQL Editor → Run.
--
-- Effet :
--   1. Ré-autorise la recharge/retrait en libre-service (démo/soutenance).
--   2. Supprime la table et les fonctions de l'ancien prestataire.
-- Le vrai encaissement Mobile Money (Lygos) sera rebranché plus tard via une
-- Edge Function serveur ; on re-révoquera alors ces droits.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Réactiver la recharge/retrait pour les utilisateurs connectés ───
GRANT EXECUTE ON FUNCTION public.wallet_recharge(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw(INTEGER, TEXT) TO authenticated;

-- ─── 2. Supprimer les objets base de l'ancien prestataire de paiement ───
DROP FUNCTION IF EXISTS public.wallet_topup_apply(TEXT);
DROP FUNCTION IF EXISTS public.wallet_withdraw_apply(UUID, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.wallet_credit(UUID, INTEGER, TEXT);
DROP TABLE IF EXISTS public.wallet_topups;
