-- ═══════════════════════════════════════════════════════════════
-- EventBridge — S.O.S Brigade : géolocalisation (rayon de 30 km)
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- Coordonnées du lieu de l'alerte = centre du rayon de matching.
ALTER TABLE public.sos_sessions
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;
