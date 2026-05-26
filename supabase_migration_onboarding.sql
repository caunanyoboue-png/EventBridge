-- ─── ÉTAPE 1 : Supprimer TOUTES les policies existantes sur profiles ──────────
-- (nécessaire pour éliminer la récursion infinie)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.profiles';
  END LOOP;
END $$;

-- ─── ÉTAPE 2 : Ajouter les colonnes manquantes ────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_done   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone             text,
  ADD COLUMN IF NOT EXISTS quartier          text,
  ADD COLUMN IF NOT EXISTS bio               text,
  ADD COLUMN IF NOT EXISTS avatar_url        text,
  ADD COLUMN IF NOT EXISTS skills            text[],
  ADD COLUMN IF NOT EXISTS experience_years  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_rate       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating        numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_missions    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_certified      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_available      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS company_name      text,
  ADD COLUMN IF NOT EXISTS company_sector    text,
  ADD COLUMN IF NOT EXISTS rccm              text,
  ADD COLUMN IF NOT EXISTS latitude          double precision,
  ADD COLUMN IF NOT EXISTS longitude         double precision;

-- ─── ÉTAPE 3 : Fonction helper SECURITY DEFINER (évite la récursion) ─────────
-- Cette fonction permet de récupérer le rôle sans déclencher les policies RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── ÉTAPE 4 : Recréer des policies simples et non-récursives ─────────────────
-- Utilise auth.uid() = id directement (jamais de sous-requête sur profiles)

-- Tout utilisateur peut lire son propre profil
CREATE POLICY "own profile select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Tout utilisateur peut lire les profils des autres (nécessaire pour l'app)
CREATE POLICY "profiles are public"
  ON public.profiles FOR SELECT
  USING (true);

-- Mise à jour uniquement de son propre profil
CREATE POLICY "own profile update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insertion uniquement de son propre profil
CREATE POLICY "own profile insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- S'assurer que RLS est activé
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
