-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Identité vérifiée OBLIGATOIRE pour publier
-- À exécuter dans Supabase → SQL Editor → Run
--
-- Un organisateur doit avoir fait vérifier son identité (recto + verso +
-- selfie, validés par un administrateur) avant de pouvoir :
--   • publier une mission          (table missions)
--   • lancer un S.O.S Brigade      (table sos_sessions)
--
-- Le contrôle est fait par TRIGGER côté base : il s'applique donc même si
-- quelqu'un contourne l'interface et appelle l'API directement.
-- Règle rétroactive : elle vaut pour tous les organisateurs, anciens compris.
-- Les missions DÉJÀ publiées ne sont pas touchées.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.require_verified_organizer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p_role TEXT; p_kyc TEXT; d_recto TEXT; d_verso TEXT; d_selfie TEXT;
BEGIN
  SELECT role, kyc_status, kyc_document_path, kyc_document_back_path, kyc_selfie_path
    INTO p_role, p_kyc, d_recto, d_verso, d_selfie
    FROM public.profiles WHERE id = NEW.organisateur_id;

  -- L'administrateur n'est pas soumis à la règle (support, tests, reprise de données).
  IF p_role = 'admin' THEN RETURN NEW; END IF;

  IF d_recto IS NULL OR d_verso IS NULL OR d_selfie IS NULL THEN
    RAISE EXCEPTION 'Vérification requise : envoyez le recto, le verso de votre pièce d''identité et un selfie tenant cette pièce depuis votre profil.';
  END IF;

  IF COALESCE(p_kyc, 'unverified') <> 'verified' THEN
    RAISE EXCEPTION 'Votre identité est en cours de vérification (24 à 48 h). Vous pourrez publier dès sa validation.';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_missions_require_verified ON public.missions;
CREATE TRIGGER trg_missions_require_verified
  BEFORE INSERT ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_organizer();

DROP TRIGGER IF EXISTS trg_sos_require_verified ON public.sos_sessions;
CREATE TRIGGER trg_sos_require_verified
  BEFORE INSERT ON public.sos_sessions
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_organizer();

-- ── Vérification ──────────────────────────────────────────────
-- Organisateurs qui devront se faire vérifier avant leur prochaine publication :
--   SELECT full_name, email, kyc_status,
--          (kyc_document_path IS NOT NULL) AS recto,
--          (kyc_document_back_path IS NOT NULL) AS verso,
--          (kyc_selfie_path IS NOT NULL) AS selfie
--     FROM public.profiles
--    WHERE role = 'organisateur'
--      AND (kyc_status IS DISTINCT FROM 'verified'
--           OR kyc_document_path IS NULL OR kyc_document_back_path IS NULL OR kyc_selfie_path IS NULL);
