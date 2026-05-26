-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Matching intelligent + Notifications
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Table notifications ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT         NOT NULL DEFAULT 'mission_match',
  title      TEXT         NOT NULL,
  body       TEXT         NOT NULL,
  data       JSONB        DEFAULT '{}',
  is_read    BOOLEAN      DEFAULT false,
  created_at TIMESTAMPTZ  DEFAULT now()
);

-- Index pour requêtes rapides
CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications(user_id, is_read)
  WHERE is_read = false;

-- Index unique pour éviter les doublons de notification pour une même mission
CREATE UNIQUE INDEX IF NOT EXISTS notifications_mission_user_unique
  ON public.notifications(user_id, (data->>'mission_id'))
  WHERE type = 'mission_match';

-- ─── 2. RLS ─────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE tablename='notifications' AND schemaname='public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.notifications'; END LOOP;
END $$;

CREATE POLICY "users view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── 3. Fonction de matching SECURITY DEFINER ───────────────────
-- Contourne le RLS pour insérer les notifications côté serveur
CREATE OR REPLACE FUNCTION public.notify_matching_freelances(
  p_mission_id     UUID,
  p_mission_title  TEXT,
  p_hourly_rate    INTEGER,
  p_ville          TEXT,
  p_skills_required TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freelance     RECORD;
  v_count         INTEGER := 0;
  v_skill_count   INTEGER;
BEGIN
  v_skill_count := COALESCE(array_length(p_skills_required, 1), 0);

  FOR v_freelance IN
    SELECT
      p.id,
      p.ville,
      p.avg_rating,
      CASE
        WHEN v_skill_count = 0 THEN 1.0
        ELSE (
          SELECT COUNT(*)::FLOAT / v_skill_count
          FROM unnest(p.skills) s
          WHERE s = ANY(p_skills_required)
        )
      END AS match_score
    FROM public.profiles p
    WHERE p.role = 'freelance'
      AND p.status = 'active'
      AND p.is_available = true
      AND (
        v_skill_count = 0
        OR p.skills && p_skills_required   -- au moins 1 compétence commune
      )
    ORDER BY
      CASE WHEN p.ville = p_ville THEN 0 ELSE 1 END,  -- même ville en priorité
      p.avg_rating DESC NULLS LAST
    LIMIT 50
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    VALUES (
      v_freelance.id,
      'mission_match',
      '🎯 Nouvelle mission pour vous !',
      p_mission_title
        || ' · ' || COALESCE(p_ville, '')
        || ' · ' || p_hourly_rate::TEXT || ' FCFA/h',
      jsonb_build_object(
        'mission_id',   p_mission_id,
        'match_score',  ROUND(v_freelance.match_score::NUMERIC, 2)
      ),
      false
    )
    ON CONFLICT (user_id, (data->>'mission_id'))
    WHERE type = 'mission_match'
    DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ─── 4. Activer Realtime pour notifications ──────────────────────
-- (si pas encore fait dans le dashboard Supabase → Database → Publications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
