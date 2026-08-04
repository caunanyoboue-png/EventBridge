-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Fix : slots_filled jamais mis à jour + statut in_progress
-- À exécuter dans Supabase → SQL Editor → Run.
--
-- slots_filled etait fige a 0 (jamais incremente a l'acceptation). Ce trigger
-- le recalcule = nombre de candidatures ACCEPTEES, a chaque changement d'une
-- candidature (insert / update statut / delete). Il ferme aussi la mission
-- (open -> in_progress) quand tous les postes sont pourvus, et la rouvre
-- (in_progress -> open) si un poste se libere. Les statuts draft / completed /
-- cancelled ne sont jamais touches.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_mission_slots_filled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mid    UUID := COALESCE(NEW.mission_id, OLD.mission_id);
  filled INTEGER;
  total  INTEGER;
  st     TEXT;
BEGIN
  SELECT count(*) INTO filled FROM public.applications WHERE mission_id = mid AND status = 'accepted';
  SELECT slots_total, status INTO total, st FROM public.missions WHERE id = mid;
  IF total IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE public.missions SET
    slots_filled = filled,
    status = CASE
      WHEN st = 'open'        AND filled >= total THEN 'in_progress'
      WHEN st = 'in_progress' AND filled <  total THEN 'open'
      ELSE st
    END
  WHERE id = mid;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_sync_slots ON public.applications;
CREATE TRIGGER trg_sync_slots
  AFTER INSERT OR UPDATE OR DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.sync_mission_slots_filled();

-- ─── Backfill des missions existantes ───────────────────────────────────────
UPDATE public.missions m SET
  slots_filled = sub.cnt,
  status = CASE WHEN m.status = 'open' AND sub.cnt >= m.slots_total THEN 'in_progress' ELSE m.status END
FROM (
  SELECT mission_id, count(*) AS cnt
  FROM public.applications WHERE status = 'accepted'
  GROUP BY mission_id
) sub
WHERE m.id = sub.mission_id;
