-- ═══════════════════════════════════════════════════════════════
-- FIX — Signature de contrat impossible
-- Erreur : « new row violates row-level security policy for table "contracts" »
--
-- Cause : la policy UPDATE de `contracts` n'avait qu'un USING (pas de WITH CHECK).
-- Postgres réutilise alors le USING pour valider la NOUVELLE ligne. Comme le USING
-- contient « status != 'signed' », passer le statut À 'signed' (quand les deux
-- parties ont signé) était systématiquement rejeté → on ne pouvait jamais signer.
--
-- Correctif : USING garde « status != 'signed' » (on ne modifie pas un contrat
-- déjà signé = verrouillé), mais on ajoute un WITH CHECK qui exige seulement
-- d'être partie au contrat (autorise donc le passage à 'signed').
--
-- Exécuter dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE
  USING (
    (auth.uid() = organizer_id OR auth.uid() = freelance_id)
    AND status <> 'signed'
  )
  WITH CHECK (
    auth.uid() = organizer_id OR auth.uid() = freelance_id
  );
