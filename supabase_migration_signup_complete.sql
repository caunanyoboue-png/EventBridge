-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Inscription en une seule traite
-- À exécuter dans Supabase → SQL Editor → Run
--
-- Le formulaire de profil est désormais rempli AVANT l'envoi du mail :
-- toutes les informations voyagent dans les métadonnées du compte, et ce
-- trigger les recopie dans `profiles` à la création. Le clic sur le lien
-- reçu par mail devient donc la DERNIÈRE étape (→ fil d'actualité).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m         JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_role    TEXT  := COALESCE(NULLIF(m->>'role', ''), 'freelance');
  v_skills  TEXT[];
  v_rates   JSONB;
  v_complet BOOLEAN;
BEGIN
  -- Rôle valide uniquement (jamais 'admin' via une inscription publique)
  IF v_role NOT IN ('freelance', 'organisateur') THEN v_role := 'freelance'; END IF;

  -- Compétences : tableau JSON → text[]
  BEGIN
    IF jsonb_typeof(m->'skills') = 'array' THEN
      SELECT array_agg(value::text) INTO v_skills
        FROM jsonb_array_elements_text(m->'skills') AS value;
    END IF;
  EXCEPTION WHEN others THEN v_skills := NULL;
  END;

  IF jsonb_typeof(m->'prestation_rates') = 'object' THEN
    v_rates := m->'prestation_rates';
  END IF;

  -- Profil considéré comme complet si le formulaire a bien été rempli avant l'envoi du mail
  v_complet := (v_role = 'freelance'    AND COALESCE(array_length(v_skills, 1), 0) > 0)
            OR (v_role = 'organisateur' AND COALESCE(NULLIF(m->>'company_name', ''), NULL) IS NOT NULL);

  INSERT INTO public.profiles (
    id, email, full_name, role, status, ville, phone, quartier, bio,
    skills, hourly_rate, prestation_rates, experience_years,
    company_name, company_sector, onboarding_done
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(m->>'full_name', ''),
    v_role,
    'active',
    COALESCE(NULLIF(m->>'ville', ''), 'Abidjan - Cocody'),
    NULLIF(m->>'phone', ''),
    NULLIF(m->>'quartier', ''),
    NULLIF(m->>'bio', ''),
    COALESCE(v_skills, '{}')::text[],
    COALESCE(NULLIF(m->>'hourly_rate', '')::numeric, 2500),
    COALESCE(v_rates, '{}'::jsonb),
    COALESCE(NULLIF(m->>'experience_years', '')::integer, 0),
    NULLIF(m->>'company_name', ''),
    NULLIF(m->>'company_sector', ''),
    v_complet
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END $$;

-- Le trigger existe déjà (trg_on_auth_user_created) ; on le recrée par sécurité.
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Rappel de configuration (Dashboard Supabase) ──────────────────────────
-- Authentication ▸ URL Configuration ▸ Redirect URLs : ajouter
--   https://event-bridge-flax.vercel.app/**
--   http://localhost:5173/**
-- sans quoi le lien du mail retombera sur le Site URL par défaut.
