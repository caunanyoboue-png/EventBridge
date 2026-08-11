-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Statistiques réelles de la page d'accueil
-- À exécuter dans Supabase → SQL Editor → Run
--
-- La page d'accueil affichait des chiffres inventés (500+ freelances,
-- 1 200+ missions, 4,8/5, 98 %). Cette fonction renvoie les VRAIS compteurs.
--
-- Elle est SECURITY DEFINER et n'expose que des AGRÉGATS (aucune donnée
-- personnelle), ce qui permet de l'ouvrir aux visiteurs non connectés
-- sans toucher aux politiques RLS des tables.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.public_landing_stats()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    -- Freelances actifs
    'freelances', (SELECT count(*) FROM public.profiles
                    WHERE role = 'freelance' AND status = 'active'),
    -- Missions menées à leur terme
    'missions',   (SELECT count(*) FROM public.missions
                    WHERE status = 'completed'),
    -- Nombre d'avis (sert à savoir si la note est significative)
    'reviews',    (SELECT count(*) FROM public.reviews),
    -- Note moyenne sur 5, arrondie au dixième
    'avg_rating', (SELECT COALESCE(round(avg(rating)::numeric, 1), 0) FROM public.reviews),
    -- Satisfaction = part des avis à 4 étoiles ou plus
    'satisfaction', (SELECT CASE WHEN count(*) = 0 THEN 0
                                 ELSE round(100.0 * count(*) FILTER (WHERE rating >= 4) / count(*))
                            END
                       FROM public.reviews)
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_landing_stats() TO anon, authenticated;

-- ── Vérification ──────────────────────────────────────────────
--   SELECT public.public_landing_stats();
