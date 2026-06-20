-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Fix du recalcul de la réputation (avis)
-- Bugs corrigés :
--  1) Le trigger ne se déclenchait pas sur DELETE → supprimer un avis
--     (action admin) ne recalculait pas la note moyenne.
--  2) Le trigger écrivait le nombre d'avis dans total_missions au lieu de
--     total_reviews → mauvais "nombre de missions" + compteur d'avis figé.
-- Exécuter dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_avg_rating()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
  target := COALESCE(NEW.reviewed_id, OLD.reviewed_id);
  UPDATE public.profiles
  SET avg_rating    = (SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE reviewed_id = target),
      total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE reviewed_id = target)
  WHERE id = target;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_update_rating ON public.reviews;
CREATE TRIGGER trg_reviews_update_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_avg_rating();

-- ─── Recalage des compteurs existants ───────────────────────────
-- total_reviews + avg_rating depuis les avis réels
UPDATE public.profiles p SET
  total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE reviewed_id = p.id),
  avg_rating    = (SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE reviewed_id = p.id);

-- total_missions = missions réellement terminées par le freelance
-- (corrige les valeurs faussées par l'ancien trigger)
UPDATE public.profiles p SET total_missions = (
  SELECT COUNT(*) FROM public.applications a
  JOIN public.missions m ON m.id = a.mission_id
  WHERE a.freelance_id = p.id
    AND a.status IN ('accepted','completed')
    AND m.status = 'completed'
) WHERE p.role = 'freelance';
