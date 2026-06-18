-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Vérification d'identité freelance (KYC) — RG3 / RG11
-- L'admin vérifie la pièce d'identité du freelance avant activation.
-- Exécuter dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Colonnes KYC sur profiles ───────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS kyc_document_path    text,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason text,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at      timestamptz;

-- ─── 2. Grandfather : freelances déjà inscrits = considérés vérifiés ─
UPDATE public.profiles SET kyc_status = 'verified'
  WHERE role = 'freelance' AND kyc_status = 'unverified';

CREATE INDEX IF NOT EXISTS idx_profiles_kyc ON public.profiles(kyc_status);

-- ─── 3. Garde-fou : seul un admin peut valider/rejeter ──────────
-- (le self-update profiles autorise le freelance à passer en 'pending',
--  mais pas à se déclarer lui-même 'verified'.)
CREATE OR REPLACE FUNCTION public.guard_kyc_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     AND NEW.kyc_status IN ('verified','rejected')
     AND auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  THEN
    RAISE EXCEPTION 'Seul un administrateur peut valider ou rejeter une pièce d''identité';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_kyc ON public.profiles;
CREATE TRIGGER trg_guard_kyc BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_kyc_status();

-- ─── 4. Bucket privé pour les pièces d'identité ─────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc', 'kyc', false)
ON CONFLICT (id) DO NOTHING;

-- Le freelance gère uniquement SON dossier (chemin = "<uid>/...")
DROP POLICY IF EXISTS "kyc_owner_all" ON storage.objects;
CREATE POLICY "kyc_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING      (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

-- L'admin lit toutes les pièces (pour la revue)
DROP POLICY IF EXISTS "kyc_admin_read" ON storage.objects;
CREATE POLICY "kyc_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
