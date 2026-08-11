-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Vérification d'identité : ajout du SELFIE avec la pièce
-- À exécuter dans Supabase → SQL Editor → Run
--
-- Le dossier de vérification comporte désormais 3 documents :
--   recto de la pièce · verso de la pièce · selfie tenant la pièce
-- Le selfie est la protection la plus efficace contre l'usurpation
-- (une pièce volée ne suffit plus : il faut le visage du titulaire).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_selfie_path TEXT;

COMMENT ON COLUMN public.profiles.kyc_selfie_path IS
  'Photo du freelance tenant sa pièce d''identité (anti-usurpation).';

-- ─── Le paiement de la certification exige aussi le selfie ──────
CREATE OR REPLACE FUNCTION public.wallet_pay_certification(p_level TEXT, p_period TEXT)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  price INTEGER; bal INTEGER; newbal INTEGER;
  cur_exp TIMESTAMPTZ; new_exp TIMESTAMPTZ; ref TEXT; kyc TEXT; urole TEXT;
  doc_recto TEXT; doc_verso TEXT; doc_selfie TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_level NOT IN ('grey','blue')  THEN RAISE EXCEPTION 'Niveau invalide'; END IF;
  IF p_period NOT IN ('month','year') THEN RAISE EXCEPTION 'Durée invalide'; END IF;

  SELECT role, kyc_status, certification_expires_at,
         kyc_document_path, kyc_document_back_path, kyc_selfie_path
    INTO urole, kyc, cur_exp, doc_recto, doc_verso, doc_selfie
    FROM public.profiles WHERE id = uid;
  IF urole <> 'freelance' THEN RAISE EXCEPTION 'La certification est réservée aux freelances'; END IF;

  -- Dossier complet exigé (recto + verso + selfie), puis validation par un administrateur.
  IF doc_recto IS NULL OR doc_verso IS NULL OR doc_selfie IS NULL THEN
    RAISE EXCEPTION 'Dossier incomplet : envoyez le recto, le verso de votre pièce et un selfie tenant cette pièce.';
  END IF;
  IF COALESCE(kyc, 'unverified') <> 'verified' THEN
    RAISE EXCEPTION 'Votre identité doit d''abord être vérifiée. Nos équipes contrôlent vos pièces sous 24 à 48 h.';
  END IF;

  price := public.certification_price(p_level, p_period, uid);

  PERFORM public.ensure_wallet(uid);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF COALESCE(bal,0) < price THEN
    RAISE EXCEPTION 'Solde insuffisant — rechargez votre portefeuille (% FCFA requis)', price;
  END IF;

  new_exp := GREATEST(COALESCE(cur_exp, now()), now())
             + CASE WHEN p_period = 'year' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;
  ref := 'EBCERT_' || REPLACE(gen_random_uuid()::text, '-', '');

  UPDATE public.wallets SET balance = balance - price WHERE user_id = uid RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (uid, 'certification', -price, newbal,
            'Certification ' || CASE p_level WHEN 'blue' THEN 'Bleue' ELSE 'Grise' END
            || ' (' || CASE p_period WHEN 'year' THEN '1 an' ELSE '1 mois' END || ')', ref);

  INSERT INTO public.certification_subscriptions(user_id, level, period, amount, reference, expires_at)
    VALUES (uid, p_level, p_period, price, ref, new_exp);

  UPDATE public.profiles SET
      certification_level      = p_level,
      certification_expires_at = new_exp,
      certification_paid_at    = now(),
      is_certified             = (kyc = 'verified')
    WHERE id = uid;

  INSERT INTO public.notifications(user_id, type, title, body, data)
    VALUES (uid, 'certification',
            'Certification activée',
            'Votre badge ' || CASE p_level WHEN 'blue' THEN 'Bleu' ELSE 'Gris' END
            || ' est actif jusqu''au ' || to_char(new_exp, 'DD/MM/YYYY') || '.',
            jsonb_build_object('level', p_level, 'period', p_period, 'amount', price, 'expires_at', new_exp));

  RETURN new_exp;
END $$;
GRANT EXECUTE ON FUNCTION public.wallet_pay_certification(TEXT, TEXT) TO authenticated;
