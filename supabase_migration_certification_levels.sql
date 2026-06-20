-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Certification à 2 niveaux (gris / bleu)
--   none = aucune (freelance juste actif)
--   grey = pièce d'identité fournie (certification standard)
--   blue = pièce + documents supplémentaires (CV, portfolio) → premium
-- Exécuter dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS certification_level text NOT NULL DEFAULT 'none'
    CHECK (certification_level IN ('none', 'grey', 'blue'));

-- Les profils déjà certifiés deviennent "gris" par défaut
UPDATE public.profiles SET certification_level = 'grey'
  WHERE is_certified = true AND certification_level = 'none';

-- Garde is_certified cohérent (miroir : certifié = niveau != none)
UPDATE public.profiles SET is_certified = (certification_level <> 'none');
