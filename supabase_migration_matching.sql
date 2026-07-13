-- ============================================================================
-- EventBridge — Matching Service (algorithme multicritères pondéré)
-- Implémente RG10 / RG11 / RG12 du mémoire :
--   Score = 0.40*compétences + 0.25*distance + 0.20*note + 0.15*disponibilité
--   ProximityScore = 1 - (distance_km / 50), plancher 0 au-delà de 50 km
--   Ne retient que les freelances disponibles et de note >= 2.5 (ou sans note)
--   Renvoie les N meilleurs profils triés par score décroissant (défaut 10)
--
-- À exécuter dans l'éditeur SQL Supabase.
-- ============================================================================

create or replace function public.match_freelances(
  p_mission_id uuid,
  p_limit integer default 10
)
returns table (
  freelance_id        uuid,
  full_name           text,
  avatar_url          text,
  ville               text,
  avg_rating          numeric,
  is_certified        boolean,
  certification_level text,
  hourly_rate         numeric,
  skills              text[],
  matched_skills      text[],
  distance_km         numeric,
  s_competences       numeric,
  s_distance          numeric,
  s_note              numeric,
  s_dispo             numeric,
  score_pct           integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with m as (
    select
      coalesce(skills_required, '{}')::text[] as req,
      latitude  as mlat,
      longitude as mlon
    from public.missions
    where id = p_mission_id
  ),
  base as (
    select
      p.id,
      p.full_name,
      p.avatar_url,
      p.ville,
      p.avg_rating,
      p.is_certified,
      p.certification_level,
      p.hourly_rate,
      coalesce(p.skills, '{}')::text[] as skills,
      cardinality(m.req) as nreq,
      -- compétences de la mission possédées par le freelance
      ( select coalesce(array_agg(s), '{}'::text[])
          from unnest(m.req) s
         where s = any(coalesce(p.skills, '{}'::text[])) ) as matched,
      -- distance Haversine (km) — null si l'un des deux points n'a pas de GPS
      case
        when p.latitude is not null and p.longitude is not null
             and m.mlat is not null and m.mlon is not null
        then 6371 * acos( least(1, greatest(-1,
               cos(radians(m.mlat)) * cos(radians(p.latitude))
                 * cos(radians(p.longitude) - radians(m.mlon))
             + sin(radians(m.mlat)) * sin(radians(p.latitude)) )) )
        else null
      end as dist
    from public.profiles p
    cross join m
    where p.role = 'freelance'
      and p.is_available = true
      -- RG11 : note >= 2.5 OU aucune évaluation (avg_rating à 0 / null)
      and (p.avg_rating is null or p.avg_rating = 0 or p.avg_rating >= 2.5)
  ),
  scored as (
    select
      b.*,
      case when b.nreq = 0 then 1
           else cardinality(b.matched)::numeric / b.nreq end as sc_comp,
      case when b.dist is null then 0
           else greatest(0, 1 - b.dist / 50.0) end          as sc_dist,
      coalesce(b.avg_rating, 0) / 5.0                        as sc_note,
      1::numeric                                            as sc_dispo
    from base b
  )
  select
    id                          as freelance_id,
    full_name,
    avatar_url,
    ville,
    avg_rating,
    is_certified,
    certification_level::text as certification_level,
    hourly_rate,
    skills,
    matched                     as matched_skills,
    round(dist::numeric, 2)     as distance_km,
    round(sc_comp, 4)           as s_competences,
    round(sc_dist, 4)           as s_distance,
    round(sc_note, 4)           as s_note,
    sc_dispo                    as s_dispo,
    round(100 * (
        0.40 * sc_comp
      + 0.25 * sc_dist
      + 0.20 * sc_note
      + 0.15 * sc_dispo
    ))::int                     as score_pct
  from scored
  order by score_pct desc, avg_rating desc nulls last
  limit greatest(1, coalesce(p_limit, 10));
$$;

-- L'application (utilisateurs connectés) peut appeler la fonction
grant execute on function public.match_freelances(uuid, integer) to authenticated;

-- ============================================================================
-- Test rapide (remplace l'UUID par une vraie mission) :
--   select * from public.match_freelances('00000000-0000-0000-0000-000000000000');
-- ============================================================================
