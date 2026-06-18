-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Module Contrats de Mission
-- Conforme Code du Travail ivoirien Loi n°2015-532 du 20 juillet 2015
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Table contracts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contracts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id                UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  organizer_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  freelance_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Parties
  organizer_name            TEXT NOT NULL,
  organizer_address         TEXT NOT NULL DEFAULT '',
  organizer_rccm            TEXT NOT NULL DEFAULT '',
  freelance_name            TEXT NOT NULL,
  freelance_address         TEXT NOT NULL DEFAULT '',
  freelance_cni             TEXT NOT NULL DEFAULT '',

  -- Mission
  job_title                 TEXT NOT NULL,
  job_description           TEXT NOT NULL DEFAULT '',
  location                  TEXT NOT NULL DEFAULT '',
  start_date                DATE NOT NULL,
  end_date                  DATE NOT NULL,
  cdd_reason                TEXT NOT NULL CHECK (cdd_reason IN ('surcroi','saisonnier','chantier','remplacement')),

  -- Rémunération
  hourly_rate               NUMERIC(10,2) NOT NULL,
  daily_hours               NUMERIC(4,2)  NOT NULL DEFAULT 8,
  total_days                INTEGER       NOT NULL DEFAULT 1,
  total_gross               NUMERIC(12,2) NOT NULL DEFAULT 0,
  end_of_contract_indemnity NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method            TEXT          NOT NULL DEFAULT 'orange_money',

  -- Clauses optionnelles
  trial_period_days         INTEGER,
  has_telework_clause       BOOLEAN NOT NULL DEFAULT FALSE,
  has_confidentiality_clause BOOLEAN NOT NULL DEFAULT FALSE,

  -- Workflow
  status                    TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','proposed_by_organizer','proposed_by_freelance',
                      'counter_proposed','accepted_by_both','rejected','signed','expired')),
  proposed_by               TEXT NOT NULL DEFAULT 'system'
    CHECK (proposed_by IN ('organizer','freelance','system')),
  organizer_signed_at       TIMESTAMPTZ,
  freelance_signed_at       TIMESTAMPTZ,
  rejection_reason          TEXT,

  version                   INTEGER NOT NULL DEFAULT 1,
  previous_version_id       UUID REFERENCES public.contracts(id),
  pdf_url                   TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Colonne contract_id sur missions (après création de contracts) ───
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL;

-- ─── 3. Table contract_negotiations (historique versions) ───────
CREATE TABLE IF NOT EXISTS public.contract_negotiations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  snapshot     JSONB NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('proposed','counter_proposed','accepted','rejected','signed')),
  actor_id     UUID NOT NULL REFERENCES public.profiles(id),
  actor_role   TEXT NOT NULL CHECK (actor_role IN ('organizer','freelance')),
  message      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. Trigger : updated_at auto ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contracts_updated_at ON public.contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. Trigger : auto-incrément version ───────────────────────
CREATE OR REPLACE FUNCTION public.increment_contract_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.hourly_rate IS DISTINCT FROM NEW.hourly_rate
     OR OLD.total_days IS DISTINCT FROM NEW.total_days
     OR OLD.start_date IS DISTINCT FROM NEW.start_date
     OR OLD.end_date IS DISTINCT FROM NEW.end_date
  THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contracts_version_increment ON public.contracts;
CREATE TRIGGER contracts_version_increment
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.increment_contract_version();

-- ─── 6. Nettoyage trigger archive (géré côté application) ───────
DROP TRIGGER IF EXISTS contracts_archive ON public.contracts;
DROP FUNCTION IF EXISTS public.archive_contract_version();

-- ─── 7. RLS ─────────────────────────────────────────────────────
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_negotiations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT USING (auth.uid() = organizer_id OR auth.uid() = freelance_id);

DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT WITH CHECK (auth.uid() = organizer_id OR auth.uid() = freelance_id);

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE
  USING (
    (auth.uid() = organizer_id OR auth.uid() = freelance_id)
    AND status <> 'signed'
  )
  -- WITH CHECK explicite : sinon Postgres réutilise le USING et interdit
  -- de passer le statut à 'signed' (→ signature impossible).
  WITH CHECK (
    auth.uid() = organizer_id OR auth.uid() = freelance_id
  );

DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE USING (FALSE);

DROP POLICY IF EXISTS "negotiations_select" ON public.contract_negotiations;
CREATE POLICY "negotiations_select" ON public.contract_negotiations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_id
        AND (c.organizer_id = auth.uid() OR c.freelance_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "negotiations_insert" ON public.contract_negotiations;
CREATE POLICY "negotiations_insert" ON public.contract_negotiations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_id
        AND (c.organizer_id = auth.uid() OR c.freelance_id = auth.uid())
    )
  );

-- ─── 8. Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contracts_mission     ON public.contracts(mission_id);
CREATE INDEX IF NOT EXISTS idx_contracts_organizer   ON public.contracts(organizer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_freelance   ON public.contracts(freelance_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status      ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_negotiations_contract ON public.contract_negotiations(contract_id);
