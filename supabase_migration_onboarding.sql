-- Migration : ajout des colonnes manquantes dans profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_reviews   integer DEFAULT 0;

-- S'assurer que les nouveaux profils ont onboarding_done = false par défaut
ALTER TABLE public.profiles
  ALTER COLUMN onboarding_done SET DEFAULT false;
