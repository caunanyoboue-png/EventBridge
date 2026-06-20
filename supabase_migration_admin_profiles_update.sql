-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Droit : l'admin peut modifier n'importe quel profil
-- Sans ça, les actions admin (certifier, suspendre, valider KYC) sur un
-- AUTRE utilisateur échouent silencieusement (RLS → 0 ligne, sans erreur).
-- Le garde-fou guard_admin_management empêche toujours un admin non-principal
-- de changer un rôle / le drapeau super-admin.
-- Exécuter dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
