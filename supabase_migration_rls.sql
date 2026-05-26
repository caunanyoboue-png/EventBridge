-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Migration RLS complète
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. TABLE : missions ────────────────────────────────────────
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Supprime les policies existantes
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='missions' AND schemaname='public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.missions'; END LOOP;
END $$;

-- Tout le monde peut voir les missions ouvertes
CREATE POLICY "missions public select"
  ON public.missions FOR SELECT USING (true);

-- Seul l'organisateur propriétaire peut créer / modifier / supprimer
CREATE POLICY "organisateur insert missions"
  ON public.missions FOR INSERT
  WITH CHECK (auth.uid() = organisateur_id);

CREATE POLICY "organisateur update missions"
  ON public.missions FOR UPDATE
  USING (auth.uid() = organisateur_id);

CREATE POLICY "organisateur delete missions"
  ON public.missions FOR DELETE
  USING (auth.uid() = organisateur_id);


-- ─── 2. TABLE : applications ────────────────────────────────────
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='applications' AND schemaname='public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.applications'; END LOOP;
END $$;

-- Freelance peut voir ses propres candidatures
CREATE POLICY "freelance view own applications"
  ON public.applications FOR SELECT
  USING (auth.uid() = freelance_id);

-- Organisateur peut voir les candidatures de ses missions
CREATE POLICY "organisateur view mission applications"
  ON public.applications FOR SELECT
  USING (
    auth.uid() IN (
      SELECT organisateur_id FROM public.missions WHERE id = mission_id
    )
  );

-- Freelance peut postuler (créer)
CREATE POLICY "freelance insert application"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = freelance_id);

-- Freelance peut retirer sa candidature (UPDATE status → withdrawn)
CREATE POLICY "freelance update own application"
  ON public.applications FOR UPDATE
  USING (auth.uid() = freelance_id);

-- Organisateur peut accepter / refuser (UPDATE status)
CREATE POLICY "organisateur update application status"
  ON public.applications FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT organisateur_id FROM public.missions WHERE id = mission_id
    )
  );


-- ─── 3. TABLE : conversations ───────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='conversations' AND schemaname='public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.conversations'; END LOOP;
END $$;

-- Les deux participants peuvent voir la conversation
CREATE POLICY "participants view conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- N'importe quel utilisateur connecté peut créer une conversation
CREATE POLICY "users create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Les participants peuvent mettre à jour (last_message, unread_count…)
CREATE POLICY "participants update conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);


-- ─── 4. TABLE : messages ────────────────────────────────────────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='messages' AND schemaname='public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.messages'; END LOOP;
END $$;

-- Les participants de la conversation peuvent voir les messages
CREATE POLICY "participants view messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() IN (
      SELECT participant_1 FROM public.conversations WHERE id = conversation_id
      UNION
      SELECT participant_2 FROM public.conversations WHERE id = conversation_id
    )
  );

-- L'expéditeur peut envoyer un message
CREATE POLICY "sender insert message"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND auth.uid() IN (
      SELECT participant_1 FROM public.conversations WHERE id = conversation_id
      UNION
      SELECT participant_2 FROM public.conversations WHERE id = conversation_id
    )
  );

-- Marquer les messages comme lus (UPDATE is_read)
CREATE POLICY "participants update messages"
  ON public.messages FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT participant_1 FROM public.conversations WHERE id = conversation_id
      UNION
      SELECT participant_2 FROM public.conversations WHERE id = conversation_id
    )
  );


-- ─── 5. Ajouter la colonne responded_at si manquante ────────────
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;
