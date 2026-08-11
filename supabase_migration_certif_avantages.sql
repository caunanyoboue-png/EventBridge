-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Les avantages de la certification deviennent RÉELS
-- À exécuter dans Supabase → SQL Editor → Run
--
-- Jusqu'ici la page tarifaire promettait des avantages sans effet technique.
-- Cette migration les rend effectifs :
--   1. Rang de certification (bleu > gris > gratuit), échéance prise en compte
--   2. Remontée dans le matching à score égal
--   3. Portfolio : 3 réalisations au gratuit, illimité pour les certifiés
-- (La priorité S.O.S et le tri de l'annuaire sont appliqués côté application.)
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Rang de certification, expiration comprise ──────────────
-- 2 = Bleu actif · 1 = Gris actif · 0 = gratuit ou abonnement expiré.
CREATE OR REPLACE FUNCTION public.cert_rank(p_level TEXT, p_expires TIMESTAMPTZ)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_level IS NULL OR p_level = 'none' THEN 0
    -- expires_at NULL = certification accordée à la main par l'admin (sans échéance)
    WHEN p_expires IS NOT NULL AND p_expires <= now() THEN 0
    WHEN p_level = 'blue' THEN 2
    WHEN p_level = 'grey' THEN 1
    ELSE 0 END;
$$;
GRANT EXECUTE ON FUNCTION public.cert_rank(TEXT, TIMESTAMPTZ) TO authenticated, anon;

-- ─── 2. Matching : à score égal, les certifiés passent devant ───
-- Le score reste STRICTEMENT celui du mémoire (RG10) : compétences 40 %,
-- distance 25 %, note 20 %, disponibilité 15 %. La certification n'intervient
-- qu'en départage, pour ne pas fausser la pertinence métier.
CREATE OR REPLACE FUNCTION public.match_freelances(
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
      p.id, p.full_name, p.avatar_url, p.ville, p.avg_rating,
      p.is_certified, p.certification_level,
      public.cert_rank(p.certification_level, p.certification_expires_at) as crank,
      p.hourly_rate,
      coalesce(p.skills, '{}')::text[] as skills,
      cardinality(m.req) as nreq,
      ( select coalesce(array_agg(s), '{}'::text[])
          from unnest(m.req) s
         where s = any(coalesce(p.skills, '{}'::text[])) ) as matched,
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
      and p.kyc_status = 'verified'
      and (p.avg_rating is null or p.avg_rating = 0 or p.avg_rating >= 2.5)
  ),
  scored as (
    select
      b.*,
      (case when b.nreq = 0 then 1
            else cardinality(b.matched)::numeric / b.nreq end)::numeric as sc_comp,
      (case when b.dist is null then 0
            else greatest(0, 1 - b.dist / 50.0) end)::numeric           as sc_dist,
      (coalesce(b.avg_rating, 0) / 5.0)::numeric                        as sc_note,
      1::numeric                                                        as sc_dispo
    from base b
  )
  select
    id as freelance_id, full_name, avatar_url, ville, avg_rating,
    is_certified,
    certification_level::text as certification_level,
    hourly_rate, skills,
    matched                 as matched_skills,
    round(dist::numeric, 2) as distance_km,
    round(sc_comp, 4)       as s_competences,
    round(sc_dist, 4)       as s_distance,
    round(sc_note, 4)       as s_note,
    sc_dispo                as s_dispo,
    round(100 * (0.40 * sc_comp + 0.25 * sc_dist + 0.20 * sc_note + 0.15 * sc_dispo))::int as score_pct
  from scored
  -- Score d'abord (pertinence métier), puis avantage aux certifiés, puis la note
  order by score_pct desc, crank desc, avg_rating desc nulls last
  limit greatest(1, coalesce(p_limit, 10));
$$;
GRANT EXECUTE ON FUNCTION public.match_freelances(uuid, integer) TO authenticated;

-- ─── 3. Portfolio : 3 réalisations au gratuit, illimité si certifié ─
CREATE OR REPLACE FUNCTION public.enforce_portfolio_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lvl TEXT; exp TIMESTAMPTZ; used INTEGER;
BEGIN
  SELECT certification_level, certification_expires_at INTO lvl, exp
    FROM public.profiles WHERE id = NEW.freelance_id;

  IF public.cert_rank(lvl, exp) > 0 THEN RETURN NEW; END IF;   -- certifié → illimité

  SELECT count(*) INTO used FROM public.portfolio_items WHERE freelance_id = NEW.freelance_id;
  IF used >= 3 THEN
    RAISE EXCEPTION 'Limite atteinte : 3 réalisations avec la formule gratuite. Faites-vous certifier pour un portfolio illimité.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_portfolio_quota ON public.portfolio_items;
CREATE TRIGGER trg_portfolio_quota BEFORE INSERT ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_portfolio_quota();

-- ── Vérification ──────────────────────────────────────────────
--   SELECT full_name, certification_level, certification_expires_at,
--          public.cert_rank(certification_level, certification_expires_at) AS rang
--     FROM public.profiles WHERE role = 'freelance' ORDER BY rang DESC;
