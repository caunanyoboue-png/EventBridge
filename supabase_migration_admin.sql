-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Administrateurs & admin principal (super-admin)
-- Exécuter dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Drapeau admin principal ─────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- ─── 2. Garde-fou : la gestion des admins est réservée au principal ─
-- (la policy admin "for all" laisse sinon n'importe quel admin changer un rôle)
CREATE OR REPLACE FUNCTION public.guard_admin_management()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_super boolean;
BEGIN
  -- Service role / SQL Editor (pas de session) : on laisse passer.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  SELECT is_super_admin INTO caller_super FROM public.profiles WHERE id = auth.uid();

  -- Modifier le statut d'admin principal → principal uniquement.
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin AND NOT COALESCE(caller_super, false) THEN
    RAISE EXCEPTION 'Seul l''admin principal peut modifier ce statut';
  END IF;

  -- Promouvoir vers admin OU rétrograder un admin → principal uniquement.
  IF (NEW.role = 'admin' OR OLD.role = 'admin')
     AND NEW.role IS DISTINCT FROM OLD.role
     AND NOT COALESCE(caller_super, false) THEN
    RAISE EXCEPTION 'Seul l''admin principal peut gérer les administrateurs';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_admin ON public.profiles;
CREATE TRIGGER trg_guard_admin BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_management();

-- ─── 3. Désigner TON compte comme admin principal ───────────────
-- (adapte l'email si ton compte d'app utilise une autre adresse)
UPDATE public.profiles
  SET role = 'admin', is_super_admin = true
  WHERE email = 'eventbridge01@gmail.com';
