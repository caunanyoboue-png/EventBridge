-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Media : photo lieu + pièces jointes messages
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Colonne photo lieu sur missions ─────────────────────────
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS venue_photo_url TEXT;

-- ─── 2. Colonnes pièces jointes sur messages ────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT; -- 'image' | 'file'

-- ─── 3. Bucket venue-photos ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-photos', 'venue-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "venue_photos_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "venue_photos_org_upload"    ON storage.objects;
DROP POLICY IF EXISTS "venue_photos_org_delete"    ON storage.objects;

CREATE POLICY "venue_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'venue-photos');

CREATE POLICY "venue_photos_org_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'venue-photos' AND auth.role() = 'authenticated');

CREATE POLICY "venue_photos_org_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'venue-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── 4. Bucket chat-attachments ─────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_attach_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "chat_attach_auth_upload"  ON storage.objects;
DROP POLICY IF EXISTS "chat_attach_owner_delete" ON storage.objects;

CREATE POLICY "chat_attach_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "chat_attach_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "chat_attach_owner_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
