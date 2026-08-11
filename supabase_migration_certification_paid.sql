-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Certification PAYANTE (abonnement depuis le portefeuille)
-- À exécuter dans Supabase → SQL Editor → Run
--
-- Modèle retenu :
--   • Le freelance PAIE d'abord depuis son solde, PUIS l'admin vérifie ses pièces.
--   • Le badge n'est VISIBLE qu'une fois l'identité vérifiée (kyc_status = 'verified').
--   • Si l'admin refuse les pièces → remboursement intégral en un clic.
--   • Abonnement mensuel ou annuel, avec date d'expiration et retour auto au gratuit.
--   • Les PRIX sont calculés CÔTÉ SERVEUR : le client ne peut pas les manipuler.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Colonnes d'abonnement sur le profil ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS certification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS certification_paid_at    TIMESTAMPTZ;

-- ─── 2. Le grand livre accepte le type « certification » ────────
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('recharge','hold','release','earning','withdrawal','refund','certification'));

-- ─── 3. Historique des abonnements ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.certification_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level       TEXT NOT NULL CHECK (level IN ('grey','blue')),
  period      TEXT NOT NULL CHECK (period IN ('month','year')),
  amount      INTEGER NOT NULL,
  reference   TEXT UNIQUE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','refunded','expired')),
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_certsub_user ON public.certification_subscriptions(user_id, created_at DESC);

ALTER TABLE public.certification_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS certsub_select ON public.certification_subscriptions;
CREATE POLICY certsub_select ON public.certification_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
-- Aucune policy INSERT/UPDATE : seules les fonctions ci-dessous (SECURITY DEFINER) écrivent.

-- ─── 4. Grille tarifaire (source de vérité, côté serveur) ───────
-- Gris : 1 500/mois · 15 000/an   |   Bleu : 4 000/mois · 40 000/an
-- Le Bleu déjà actif bénéficie de 10 % de remise sur son renouvellement.
CREATE OR REPLACE FUNCTION public.certification_price(p_level TEXT, p_period TEXT, p_user UUID)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE base INTEGER; cur_level TEXT; cur_exp TIMESTAMPTZ;
BEGIN
  base := CASE
    WHEN p_level = 'grey' AND p_period = 'month' THEN 1500
    WHEN p_level = 'grey' AND p_period = 'year'  THEN 15000
    WHEN p_level = 'blue' AND p_period = 'month' THEN 4000
    WHEN p_level = 'blue' AND p_period = 'year'  THEN 40000
    ELSE NULL END;
  IF base IS NULL THEN RAISE EXCEPTION 'Formule inconnue'; END IF;

  SELECT certification_level, certification_expires_at INTO cur_level, cur_exp
    FROM public.profiles WHERE id = p_user;

  -- Avantage Bleu : renouvellement à -10 %
  IF p_level = 'blue' AND cur_level = 'blue' AND cur_exp IS NOT NULL AND cur_exp > now() THEN
    base := ROUND(base * 0.9);
  END IF;
  RETURN base;
END $$;
GRANT EXECUTE ON FUNCTION public.certification_price(TEXT, TEXT, UUID) TO authenticated;

-- ─── 5. PAYER sa certification depuis le portefeuille ───────────
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

  price := public.certification_price(p_level, p_period, uid);

  PERFORM public.ensure_wallet(uid);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF COALESCE(bal,0) < price THEN
    RAISE EXCEPTION 'Solde insuffisant — rechargez votre portefeuille (% FCFA requis)', price;
  END IF;

  -- Prolongation si l'abonnement en cours n'est pas expiré
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

  -- Le badge n'est visible qu'une fois l'identité vérifiée par l'admin.
  UPDATE public.profiles SET
      certification_level      = p_level,
      certification_expires_at = new_exp,
      certification_paid_at    = now(),
      is_certified             = (kyc = 'verified')
    WHERE id = uid;

  RETURN new_exp;
END $$;
GRANT EXECUTE ON FUNCTION public.wallet_pay_certification(TEXT, TEXT) TO authenticated;

-- ─── 6. Le badge s'allume dès que l'admin valide les pièces ─────
CREATE OR REPLACE FUNCTION public.sync_certified_on_kyc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.certification_level IS DISTINCT FROM OLD.certification_level THEN
    -- expires_at NULL = certification accordée à la main par l'admin (sans échéance) :
    -- on ne la révoque jamais, sinon les profils déjà certifiés perdraient leur badge.
    NEW.is_certified := (NEW.certification_level <> 'none'
                         AND NEW.kyc_status = 'verified'
                         AND (NEW.certification_expires_at IS NULL
                              OR NEW.certification_expires_at > now()));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_certified ON public.profiles;
CREATE TRIGGER trg_sync_certified BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_certified_on_kyc();

-- ─── 7. REMBOURSER (admin : pièces refusées après paiement) ─────
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
END $$;
GRANT EXECUTE ON FUNCTION public.certification_refund(UUID) TO authenticated;

-- ─── 8. Expiration automatique (retour au gratuit) ──────────────
CREATE OR REPLACE FUNCTION public.certification_expire_due()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.certification_subscriptions SET status = 'expired'
    WHERE status = 'active' AND expires_at <= now();
  WITH done AS (
    UPDATE public.profiles SET certification_level = 'none', is_certified = false
      WHERE certification_level <> 'none'
        AND certification_expires_at IS NOT NULL   -- jamais les certifications admin sans échéance
        AND certification_expires_at <= now()
    RETURNING 1)
  SELECT count(*) INTO n FROM done;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.certification_expire_due() TO service_role;
-- Planification (si l'extension pg_cron est activée sur le projet) :
--   SELECT cron.schedule('eb-cert-expire', '0 3 * * *', $$SELECT public.certification_expire_due()$$);
-- Sinon, l'appeler manuellement de temps en temps depuis le SQL Editor.

-- ─── 9. Niveau gratuit : 10 candidatures par mois ───────────────
CREATE OR REPLACE FUNCTION public.enforce_free_application_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lvl TEXT; exp TIMESTAMPTZ; used INTEGER;
BEGIN
  SELECT certification_level, certification_expires_at INTO lvl, exp
    FROM public.profiles WHERE id = NEW.freelance_id;

  -- Certifié et à jour → aucune limite
  IF lvl IS NOT NULL AND lvl <> 'none' AND COALESCE(exp, now() + INTERVAL '1 day') > now() THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO used FROM public.applications
    WHERE freelance_id = NEW.freelance_id
      AND applied_at >= date_trunc('month', now());

  IF used >= 10 THEN
    RAISE EXCEPTION 'Limite atteinte : 10 candidatures par mois avec la formule gratuite. Faites-vous certifier pour candidater sans limite.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_free_application_quota ON public.applications;
CREATE TRIGGER trg_free_application_quota BEFORE INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_application_quota();

-- ── Vérification ──────────────────────────────────────────────
-- SELECT public.certification_price('blue','month', auth.uid());   -- doit renvoyer 4000
