-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Stockage des PDF de contrats (bucket privé sécurisé)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- Le PDF d'un contrat contient des données sensibles (CNI, salaire) :
-- → bucket PRIVÉ, lisible uniquement par les 2 parties (URL signée à la demande).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Bucket privé "contracts" ────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. RLS sur les objets : réservé aux parties du contrat ──────
-- Le chemin est "<contract_id>/v<version>.pdf" → foldername[1] = contract_id.

DROP POLICY IF EXISTS "contracts_pdf_read" ON storage.objects;
CREATE POLICY "contracts_pdf_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.organizer_id = auth.uid() OR c.freelance_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "contracts_pdf_insert" ON storage.objects;
CREATE POLICY "contracts_pdf_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.organizer_id = auth.uid() OR c.freelance_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "contracts_pdf_update" ON storage.objects;
CREATE POLICY "contracts_pdf_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.organizer_id = auth.uid() OR c.freelance_id = auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.organizer_id = auth.uid() OR c.freelance_id = auth.uid())
    )
  );

-- ─── 3. Enregistrer le pdf_url même sur un contrat verrouillé ────
-- La policy contracts_update interdit toute modif d'un contrat 'signed'.
-- Cette fonction (SECURITY DEFINER) ne touche QUE pdf_url, et seulement
-- si l'appelant est partie au contrat.
CREATE OR REPLACE FUNCTION public.set_contract_pdf_url(p_contract_id uuid, p_pdf_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = p_contract_id
      AND (c.organizer_id = auth.uid() OR c.freelance_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Accès refusé : vous n''êtes pas partie à ce contrat';
  END IF;

  UPDATE public.contracts SET pdf_url = p_pdf_path WHERE id = p_contract_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_contract_pdf_url(uuid, text) TO authenticated;
