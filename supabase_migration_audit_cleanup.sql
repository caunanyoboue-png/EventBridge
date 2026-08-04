-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Audit : RLS notifications resserrée (#6) + code mort (#7)
-- À exécuter dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- ─── #6 : RLS notifications ──────────────────────────────────────
-- Avant : WITH CHECK (true) => n'importe quel utilisateur connecté pouvait créer
-- une notification vers N'IMPORTE QUI, avec n'importe quel contenu (usurpation).
-- Après : on n'autorise que les axes légitimes de l'app :
--   • se notifier soi-même,
--   • l'admin (émetteur) peut notifier n'importe qui,
--   • n'importe qui peut notifier un admin (KYC, litiges…),
--   • l'axe organisateur ↔ freelance (couvre candidatures, contrats, paiements,
--     S.O.S — le seul axe d'interaction de la plateforme).
-- Bloque donc l'usurpation « même rôle » (freelance→freelance, orga→orga).
-- Note : un organisateur peut toujours notifier un freelance (inhérent au S.O.S) ;
-- fermer complètement ce cas demanderait une validation serveur (rayon S.O.S),
-- évolution ultérieure.
DROP POLICY IF EXISTS "authenticated can insert notifications" ON public.notifications;
CREATE POLICY "authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()  AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id      AND role = 'admin')
    OR (
      EXISTS (SELECT 1 FROM public.profiles s WHERE s.id = auth.uid() AND s.role = 'organisateur')
      AND EXISTS (SELECT 1 FROM public.profiles t WHERE t.id = user_id AND t.role = 'freelance')
    )
    OR (
      EXISTS (SELECT 1 FROM public.profiles s WHERE s.id = auth.uid() AND s.role = 'freelance')
      AND EXISTS (SELECT 1 FROM public.profiles t WHERE t.id = user_id AND t.role = 'organisateur')
    )
  );

-- ─── #7 : retrait du code mort ───────────────────────────────────
-- wallet_pay_mission n'est appelé par aucun client (Option A = paiement par
-- contrat via wallet_pay_contract). On supprime la fonction inutilisée.
DROP FUNCTION IF EXISTS public.wallet_pay_mission(UUID, UUID, INTEGER);
