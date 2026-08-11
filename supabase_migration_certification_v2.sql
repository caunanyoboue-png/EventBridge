-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Certification payante : parcours sécurisé (v2)
-- À exécuter APRÈS supabase_migration_certification_paid.sql
--
-- Ce que ça ajoute :
--   1. Garde-fou SERVEUR : impossible de payer sans avoir envoyé ses pièces.
--   2. Notifications à chaque étape (paiement reçu · badge activé · pièces refusées).
--   3. Annulation par le freelance lui-même, tant que ses pièces ne sont pas validées.
-- (La confirmation avant débit est côté interface : modale récapitulative.)
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Paiement : exige que les pièces soient déjà déposées ────
CREATE OR REPLACE FUNCTION public.wallet_pay_certification(p_level TEXT, p_period TEXT)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  price INTEGER; bal INTEGER; newbal INTEGER;
  cur_exp TIMESTAMPTZ; new_exp TIMESTAMPTZ; ref TEXT; kyc TEXT; urole TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_level NOT IN ('grey','blue')  THEN RAISE EXCEPTION 'Niveau invalide'; END IF;
  IF p_period NOT IN ('month','year') THEN RAISE EXCEPTION 'Durée invalide'; END IF;

  SELECT role, kyc_status, certification_expires_at INTO urole, kyc, cur_exp
    FROM public.profiles WHERE id = uid;
  IF urole <> 'freelance' THEN RAISE EXCEPTION 'La certification est réservée aux freelances'; END IF;

  -- Garde-fou : les pièces doivent avoir été envoyées (en attente de contrôle ou déjà validées).
  IF COALESCE(kyc, 'unverified') NOT IN ('pending','verified') THEN
    RAISE EXCEPTION 'Envoyez d''abord votre pièce d''identité, puis réglez votre certification.';
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

  -- Notification : paiement encaissé
  INSERT INTO public.notifications(user_id, type, title, body, data)
    VALUES (uid, 'certification',
            'Paiement de certification reçu',
            CASE WHEN kyc = 'verified'
              THEN 'Votre badge est actif jusqu''au ' || to_char(new_exp, 'DD/MM/YYYY') || '.'
              ELSE 'Vos pièces sont en cours de vérification (24 à 48 h). Votre badge s''activera dès validation.'
            END,
            jsonb_build_object('level', p_level, 'period', p_period, 'amount', price, 'expires_at', new_exp));

  RETURN new_exp;
END $$;
GRANT EXECUTE ON FUNCTION public.wallet_pay_certification(TEXT, TEXT) TO authenticated;

-- ─── 2. Annulation par le freelance (avant validation des pièces) ─
CREATE OR REPLACE FUNCTION public.certification_cancel()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); s public.certification_subscriptions%ROWTYPE; kyc TEXT; newbal INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT kyc_status INTO kyc FROM public.profiles WHERE id = uid;
  IF kyc = 'verified' THEN
    RAISE EXCEPTION 'Vos pièces sont déjà validées et votre badge est actif : contactez le support pour toute demande.';
  END IF;

  SELECT * INTO s FROM public.certification_subscriptions
    WHERE user_id = uid AND status = 'active'
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aucun abonnement à annuler'; END IF;

  PERFORM public.ensure_wallet(uid);
  UPDATE public.wallets SET balance = balance + s.amount WHERE user_id = uid RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (uid, 'refund', s.amount, newbal, 'Annulation de la certification', s.reference);

  UPDATE public.certification_subscriptions SET status = 'refunded' WHERE id = s.id;
  UPDATE public.profiles SET certification_level = 'none', certification_expires_at = NULL,
                             certification_paid_at = NULL, is_certified = false
    WHERE id = uid;

  INSERT INTO public.notifications(user_id, type, title, body)
    VALUES (uid, 'certification', 'Certification annulée',
            'Votre abonnement a été annulé et ' || s.amount || ' FCFA ont été recrédités sur votre portefeuille.');

  RETURN s.amount;
END $$;
GRANT EXECUTE ON FUNCTION public.certification_cancel() TO authenticated;

-- ─── 3. Remboursement admin : ajoute la notification ────────────
CREATE OR REPLACE FUNCTION public.certification_refund(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.certification_subscriptions%ROWTYPE; newbal INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Action réservée à l''administrateur';
  END IF;

  SELECT * INTO s FROM public.certification_subscriptions
    WHERE user_id = p_user AND status = 'active'
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aucun abonnement actif à rembourser'; END IF;

  PERFORM public.ensure_wallet(p_user);
  UPDATE public.wallets SET balance = balance + s.amount WHERE user_id = p_user RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (p_user, 'refund', s.amount, newbal, 'Remboursement certification (pièces refusées)', s.reference);

  UPDATE public.certification_subscriptions SET status = 'refunded' WHERE id = s.id;
  UPDATE public.profiles SET certification_level = 'none', certification_expires_at = NULL,
                             certification_paid_at = NULL, is_certified = false
    WHERE id = p_user;

  INSERT INTO public.notifications(user_id, type, title, body)
    VALUES (p_user, 'certification', 'Certification remboursée',
            'Vos pièces n''ont pas pu être validées. ' || s.amount || ' FCFA ont été recrédités sur votre portefeuille.');
END $$;
GRANT EXECUTE ON FUNCTION public.certification_refund(UUID) TO authenticated;

-- ─── 4. Notifier le freelance à l'issue du contrôle des pièces ──
CREATE OR REPLACE FUNCTION public.notify_kyc_decision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN
    IF NEW.kyc_status = 'verified' THEN
      INSERT INTO public.notifications(user_id, type, title, body)
        VALUES (NEW.id, 'certification',
                CASE WHEN NEW.certification_level <> 'none'
                     THEN 'Votre badge est actif' ELSE 'Identité vérifiée' END,
                CASE WHEN NEW.certification_level <> 'none'
                     THEN 'Vos pièces ont été validées : votre badge '
                          || CASE NEW.certification_level WHEN 'blue' THEN 'Bleu' ELSE 'Gris' END
                          || ' est désormais visible par les organisateurs.'
                     ELSE 'Votre pièce d''identité a été validée.' END);
    ELSIF NEW.kyc_status = 'rejected' THEN
      INSERT INTO public.notifications(user_id, type, title, body)
        VALUES (NEW.id, 'certification', 'Pièces refusées',
                'Vos pièces n''ont pas pu être validées. Renvoyez un document lisible depuis la page Certification.');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_kyc_decision ON public.profiles;
CREATE TRIGGER trg_notify_kyc_decision AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_kyc_decision();
