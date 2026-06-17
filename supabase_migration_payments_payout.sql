-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Commission plateforme + versement (payout) freelance
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Nouvelles colonnes sur payments ─────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS commission_amount INTEGER,           -- commission plateforme en FCFA
  ADD COLUMN IF NOT EXISTS net_amount        INTEGER,           -- net dû au freelance (amount - commission)
  ADD COLUMN IF NOT EXISTS payout_status     TEXT NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending','paid')),
  ADD COLUMN IF NOT EXISTS payout_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_method     TEXT,              -- Wave / Orange Money / MTN MoMo / Moov…
  ADD COLUMN IF NOT EXISTS payout_ref        TEXT;              -- référence du virement mobile money

-- ─── 2. L'admin peut consulter et traiter les versements ────────
-- (la policy payments_select ne couvre que payer/payee)
DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
CREATE POLICY "payments_select_admin" ON public.payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;
CREATE POLICY "payments_update_admin" ON public.payments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── 3. Index pour la file des versements à traiter ─────────────
CREATE INDEX IF NOT EXISTS idx_payments_payout ON public.payments(payout_status, status);
