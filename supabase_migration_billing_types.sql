-- ============================================================================
-- EventBridge — Facturation par type de compétence (horaire / jour / prestation)
-- ----------------------------------------------------------------------------
--  Le mode de facturation de chaque POSTE est déjà stocké dans missions.roles
--  (JSONB) : { skill, count, rate, billing } où billing ∈ hourly|daily|prestation.
--  → aucune nouvelle colonne côté missions.
--
--  Côté FREELANCE : un freelance qui n'a QUE des compétences non-horaires fixe
--  un prix « par prestation » et par compétence à l'inscription.
--  On stocke ces prix dans profiles.prestation_rates (JSONB) : { "<compétence>": <prix> }.
--
--  À exécuter dans l'éditeur SQL Supabase (idempotent).
-- ============================================================================

alter table public.profiles
  add column if not exists prestation_rates jsonb not null default '{}'::jsonb;

comment on column public.profiles.prestation_rates is
  'Prix par prestation et par compétence (freelances non-horaires) : { competence: prix }';
