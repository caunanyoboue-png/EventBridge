-- ============================================================================
-- EventBridge — Publication : tarif par compétence + événement multi-jours
-- ----------------------------------------------------------------------------
--  • roles   : postes de la mission  → [{ "skill": "...", "count": 2, "rate": 2500 }]
--              (tarif HORAIRE + effectif, propre à chaque compétence)
--  • days    : planning              → [{ "date": "2026-08-12", "start": "08:00", "end": "21:00" }]
--              (1 à 3 jours, horaires éventuellement différents chaque jour)
--  • nb_days : nombre de jours (1..3)
--
--  Les colonnes existantes (hourly_rate, slots_total, duration_hours,
--  total_amount, event_date, start_time, end_time, skills_required) restent
--  renseignées par l'app (valeurs représentatives) → aucune régression
--  d'affichage / de matching / de contrat.
--
--  applications.role_skill : le poste (compétence) visé par la candidature,
--  pour payer chaque freelance au tarif de SON poste.
--
--  À exécuter dans l'éditeur SQL Supabase (idempotent).
-- ============================================================================

alter table public.missions
  add column if not exists roles   jsonb   not null default '[]'::jsonb,
  add column if not exists days    jsonb   not null default '[]'::jsonb,
  add column if not exists nb_days integer not null default 1;

alter table public.applications
  add column if not exists role_skill text;

comment on column public.missions.roles is
  'Postes : [{skill, count, rate}] — tarif horaire + effectif par compétence';
comment on column public.missions.days is
  'Planning : [{date, start, end}] — 1 à 3 jours, horaires par jour';
comment on column public.applications.role_skill is
  'Compétence/poste visé par la candidature (mission multi-postes)';
