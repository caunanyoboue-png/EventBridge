-- ═══════════════════════════════════════════════════════════════
-- EventBridge — S.O.S Brigade : annulation avec compensation 10 %
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. Base de calcul du dédommagement sur la session
ALTER TABLE public.sos_sessions
  ADD COLUMN IF NOT EXISTS hourly_rate     NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC;

-- 2. Compensations dues aux freelances confirmés en cas d'annulation
CREATE TABLE IF NOT EXISTS public.sos_compensations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_session_id UUID NOT NULL REFERENCES public.sos_sessions(id) ON DELETE CASCADE,
  organizer_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  freelance_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount         NUMERIC NOT NULL,
  status         TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid','cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sos_comp_freelance ON public.sos_compensations(freelance_id);
CREATE INDEX IF NOT EXISTS idx_sos_comp_organizer ON public.sos_compensations(organizer_id);

-- 3. RLS
ALTER TABLE public.sos_compensations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sos_comp_select" ON public.sos_compensations;
CREATE POLICY "sos_comp_select" ON public.sos_compensations
  FOR SELECT TO authenticated USING (
    organizer_id = auth.uid() OR freelance_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "sos_comp_insert_org" ON public.sos_compensations;
CREATE POLICY "sos_comp_insert_org" ON public.sos_compensations
  FOR INSERT TO authenticated WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "sos_comp_update" ON public.sos_compensations;
CREATE POLICY "sos_comp_update" ON public.sos_compensations
  FOR UPDATE TO authenticated USING (
    organizer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
