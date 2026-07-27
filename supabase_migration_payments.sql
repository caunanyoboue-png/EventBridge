-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Module Paiements (escrow via portefeuille)
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Table payments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  mission_id       UUID REFERENCES public.missions(id)  ON DELETE SET NULL,
  payer_id         UUID NOT NULL REFERENCES public.profiles(id),
  payee_id         UUID NOT NULL REFERENCES public.profiles(id),

  amount           INTEGER NOT NULL,           -- montant en FCFA
  currency         TEXT NOT NULL DEFAULT 'XOF',
  description      TEXT,

  transaction_id   TEXT UNIQUE NOT NULL,       -- ID unique généré côté serveur (RPC)

  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','cancelled')),

  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Trigger updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. RLS ─────────────────────────────────────────────────────
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (auth.uid() = payer_id OR auth.uid() = payee_id);

DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = payer_id);

DROP POLICY IF EXISTS "payments_update_service" ON public.payments;
-- Les mises à jour (webhook) se font via service_role key (Edge Function)
-- Pas de politique UPDATE pour les utilisateurs normaux

-- ─── 4. Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_contract     ON public.payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer        ON public.payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payee        ON public.payments(payee_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction  ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status       ON public.payments(status);
