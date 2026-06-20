-- ═══════════════════════════════════════════════════════════════
-- EventBridge — KYC recto-verso + re-sécurisation du bucket (idempotent)
-- Sûr à exécuter même si la migration KYC initiale a déjà tourné.
-- Exécuter dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- Colonnes KYC (idempotent) + la face VERSO
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status            text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS kyc_document_path     text,   -- recto
  ADD COLUMN IF NOT EXISTS kyc_document_back_path text,  -- verso
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason  text,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at       timestamptz;

-- Bucket privé pour les pièces (créé s'il manque)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc', 'kyc', false)
ON CONFLICT (id) DO NOTHING;

-- (Re)pose les règles d'accès — le freelance gère SON dossier, l'admin lit tout
DROP POLICY IF EXISTS "kyc_owner_all" ON storage.objects;
CREATE POLICY "kyc_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING      (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "kyc_admin_read" ON storage.objects;
CREATE POLICY "kyc_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
