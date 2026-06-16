-- ═══════════════════════════════════════════════════════════════
-- EventBridge — S.O.S Brigade : prestations multiples (1 à 3)
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- Liste des types de prestation recherchés (1 à 3). La colonne service_type
-- existante reste le type principal (= premier de la liste) pour compatibilité.
ALTER TABLE public.sos_sessions
  ADD COLUMN IF NOT EXISTS service_types TEXT[];
