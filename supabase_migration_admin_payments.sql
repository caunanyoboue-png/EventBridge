-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Lecture des paiements par l'admin (arbitrage des litiges)
-- À exécuter dans Supabase → SQL Editor → Run.
--
-- La RLS de `payments` n'autorisait la lecture qu'au payeur ou au payé. L'admin
-- (ni l'un ni l'autre) ne pouvait donc pas voir les paiements — bloquant pour
-- AdminDisputes (verser/rembourser un séquestre) et AdminPayouts. On ajoute une
-- policy SELECT pour l'admin (les policies SELECT s'additionnent en OR, donc
-- l'accès payeur/payé existant reste inchangé).
-- Les mouvements d'argent restent faits par wallet_release / wallet_refund
-- (SECURITY DEFINER, qui autorisent déjà l'admin).
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS payments_select_admin ON public.payments;
CREATE POLICY payments_select_admin ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
