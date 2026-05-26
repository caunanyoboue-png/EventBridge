-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Portfolio visuel freelances
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Bucket Storage ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Policies storage
DO $$ BEGIN
  DROP POLICY IF EXISTS "portfolio_public_read"          ON storage.objects;
  DROP POLICY IF EXISTS "portfolio_authenticated_upload" ON storage.objects;
  DROP POLICY IF EXISTS "portfolio_owner_delete"         ON storage.objects;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "portfolio_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio');

CREATE POLICY "portfolio_authenticated_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'portfolio' AND auth.role() = 'authenticated');

CREATE POLICY "portfolio_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'portfolio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── 2. Table portfolio_items ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  freelance_id UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url    TEXT         NOT NULL,
  title        TEXT         DEFAULT '',
  category     TEXT         DEFAULT '',
  created_at   TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_freelance_idx
  ON public.portfolio_items(freelance_id);

-- ─── 3. RLS ─────────────────────────────────────────────────────
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE tablename = 'portfolio_items' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.portfolio_items'; END LOOP;
END $$;

-- Tout le monde peut voir les portfolios
CREATE POLICY "portfolio public select"
  ON public.portfolio_items FOR SELECT
  USING (true);

-- Seul le freelance propriétaire peut gérer ses photos
CREATE POLICY "freelance insert portfolio"
  ON public.portfolio_items FOR INSERT
  WITH CHECK (auth.uid() = freelance_id);

CREATE POLICY "freelance delete portfolio"
  ON public.portfolio_items FOR DELETE
  USING (auth.uid() = freelance_id);
