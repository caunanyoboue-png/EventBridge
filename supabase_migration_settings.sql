-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Paramètres plateforme (persistés)
-- Exécuter dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- Table à ligne unique (id = 1)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                       int PRIMARY KEY DEFAULT 1,
  commission_rate          numeric NOT NULL DEFAULT 10,
  sos_radius_km            int     NOT NULL DEFAULT 10,
  sos_duration_min         int     NOT NULL DEFAULT 30,
  min_hourly_rate          int     NOT NULL DEFAULT 1000,
  max_hourly_rate          int     NOT NULL DEFAULT 100000,
  auto_certify             boolean NOT NULL DEFAULT false,
  require_id_verification  boolean NOT NULL DEFAULT true,
  platform_name            text    NOT NULL DEFAULT 'EventBridge',
  support_email            text    NOT NULL DEFAULT 'support@eventbridge.ci',
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_single_row CHECK (id = 1)
);

-- La ligne unique de configuration
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS : tout le monde (connecté) peut lire, seul un admin peut écrire
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
CREATE POLICY "app_settings_read" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_write_admin" ON public.app_settings;
CREATE POLICY "app_settings_write_admin" ON public.app_settings
  FOR UPDATE TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
