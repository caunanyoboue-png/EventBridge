-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Code de présence (anti no-show) sur le séquestre
-- À exécuter APRÈS supabase_migration_wallet_contract.sql.
--
-- Principe : à la mise en séquestre, un CODE est généré. Le freelance n'est
-- payé que s'il confirme sa présence en saisissant ce code, que l'organisateur
-- lui remet SUR PLACE. Le code vit dans une table séparée lisible par le SEUL
-- organisateur (le freelance ne peut pas le lire via l'API — sinon il pourrait
-- s'auto-pointer sans venir). Sinon : l'organisateur est remboursé.
-- Litige : l'admin peut verser OU rembourser dans tous les cas.
-- ═══════════════════════════════════════════════════════════════

-- 1. Horodatage du pointage (sur le paiement — lisible par les 2 parties)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

-- 2. Code de présence — table séparée, LISIBLE PAR LE SEUL ORGANISATEUR
CREATE TABLE IF NOT EXISTS public.payment_checkins (
  payment_id   UUID PRIMARY KEY REFERENCES public.payments(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pc_select ON public.payment_checkins;
CREATE POLICY pc_select ON public.payment_checkins FOR SELECT TO authenticated
  USING (organizer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
-- Aucune policy INSERT/UPDATE : uniquement via les fonctions SECURITY DEFINER ci-dessous.
GRANT SELECT ON public.payment_checkins TO authenticated;

-- 3. Paiement d'un contrat : crée l'escrow + génère le code de présence
CREATE OR REPLACE FUNCTION public.wallet_pay_contract(p_contract_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  c public.contracts%ROWTYPE;
  amt INTEGER; bal INTEGER; rate NUMERIC; comm INTEGER; net INTEGER; pid UUID; newbal INTEGER;
  code TEXT;
  existing public.payments%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT * INTO c FROM public.contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrat introuvable'; END IF;
  IF c.organizer_id <> uid THEN RAISE EXCEPTION 'Seul l''organisateur peut payer ce contrat'; END IF;
  IF c.status <> 'signed' THEN RAISE EXCEPTION 'Le contrat doit être signé avant paiement'; END IF;

  SELECT * INTO existing FROM public.payments
    WHERE contract_id = p_contract_id AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN existing.id; END IF;

  amt := COALESCE(c.total_gross, 0) + COALESCE(c.end_of_contract_indemnity, 0);
  IF amt <= 0 THEN RAISE EXCEPTION 'Montant du contrat invalide'; END IF;

  PERFORM public.ensure_wallet(uid);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF COALESCE(bal, 0) < amt THEN RAISE EXCEPTION 'Solde insuffisant — rechargez votre portefeuille'; END IF;

  SELECT commission_rate INTO rate FROM public.missions WHERE id = c.mission_id;
  IF rate IS NULL OR rate <= 0 OR rate >= 1 THEN rate := 0.10; END IF;
  comm := ROUND(amt * rate);
  net  := amt - comm;

  UPDATE public.wallets SET balance = balance - amt, held = held + amt
    WHERE user_id = uid RETURNING balance INTO newbal;

  INSERT INTO public.payments(contract_id, mission_id, payer_id, payee_id, amount,
      commission_amount, net_amount, transaction_id, status, description, payout_status)
    VALUES (p_contract_id, c.mission_id, uid, c.freelance_id, amt, comm, net,
      'EBW_' || REPLACE(gen_random_uuid()::text, '-', ''), 'completed', 'Paiement contrat (escrow)', 'pending')
    RETURNING id INTO pid;

  -- Code de présence à 6 caractères (donné au freelance sur place)
  code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  INSERT INTO public.payment_checkins(payment_id, code, organizer_id) VALUES (pid, code, uid);

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, mission_id, reference)
    VALUES (uid, 'hold', -amt, newbal, 'Contrat payé — bloqué en escrow', c.mission_id, pid::text);

  RETURN pid;
END $$;
GRANT EXECUTE ON FUNCTION public.wallet_pay_contract(UUID) TO authenticated;

-- 4. Le freelance confirme sa présence avec le code (jamais lisible côté API)
CREATE OR REPLACE FUNCTION public.wallet_confirm_presence(p_payment_id UUID, p_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.payments%ROWTYPE; real_code TEXT;
BEGIN
  SELECT * INTO pr FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable'; END IF;
  IF auth.uid() <> pr.payee_id THEN RAISE EXCEPTION 'Seul le freelance concerné peut confirmer sa présence'; END IF;
  IF pr.checked_in_at IS NOT NULL THEN RETURN; END IF;
  SELECT code INTO real_code FROM public.payment_checkins WHERE payment_id = p_payment_id;
  IF real_code IS NULL OR upper(trim(p_code)) <> real_code THEN
    RAISE EXCEPTION 'Code de présence invalide';
  END IF;
  UPDATE public.payments SET checked_in_at = now() WHERE id = p_payment_id;
END $$;
GRANT EXECUTE ON FUNCTION public.wallet_confirm_presence(UUID, TEXT) TO authenticated;

-- 5. Versement : exige le pointage (sauf admin, pour trancher un litige)
CREATE OR REPLACE FUNCTION public.wallet_release(p_payment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.payments%ROWTYPE; fnbal INTEGER; is_admin BOOLEAN; gated BOOLEAN;
BEGIN
  SELECT * INTO pr FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable'; END IF;
  IF pr.payout_status = 'paid' THEN RETURN; END IF;
  is_admin := EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
  IF auth.uid() <> pr.payer_id AND NOT is_admin THEN RAISE EXCEPTION 'Action non autorisée'; END IF;

  gated := EXISTS (SELECT 1 FROM public.payment_checkins WHERE payment_id = pr.id);
  IF gated AND pr.checked_in_at IS NULL AND NOT is_admin THEN
    RAISE EXCEPTION 'Le freelance doit d''abord confirmer sa présence (code) avant le versement';
  END IF;

  UPDATE public.wallets SET held = GREATEST(0, held - pr.amount) WHERE user_id = pr.payer_id;
  PERFORM public.ensure_wallet(pr.payee_id);
  UPDATE public.wallets SET balance = balance + pr.net_amount
    WHERE user_id = pr.payee_id RETURNING balance INTO fnbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, mission_id, reference)
    VALUES (pr.payee_id, 'earning', pr.net_amount, fnbal, 'Gain mission — escrow libéré', pr.mission_id, p_payment_id::text);
  UPDATE public.payments SET payout_status = 'paid', payout_at = now() WHERE id = p_payment_id;
END $$;
GRANT EXECUTE ON FUNCTION public.wallet_release(UUID) TO authenticated;

-- 6. Remboursement : interdit si le freelance a déjà pointé (sauf admin)
CREATE OR REPLACE FUNCTION public.wallet_refund(p_payment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.payments%ROWTYPE; obal INTEGER; is_admin BOOLEAN;
BEGIN
  SELECT * INTO pr FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable'; END IF;
  IF pr.status = 'cancelled' OR pr.payout_status = 'paid' THEN RETURN; END IF;
  is_admin := EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
  IF auth.uid() <> pr.payer_id AND NOT is_admin THEN RAISE EXCEPTION 'Action non autorisée'; END IF;
  IF pr.checked_in_at IS NOT NULL AND NOT is_admin THEN
    RAISE EXCEPTION 'Le freelance a confirmé sa présence — passez par un litige pour contester';
  END IF;

  UPDATE public.wallets SET held = GREATEST(0, held - pr.amount), balance = balance + pr.amount
    WHERE user_id = pr.payer_id RETURNING balance INTO obal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, mission_id, reference)
    VALUES (pr.payer_id, 'refund', pr.amount, obal, 'Remboursement — freelance absent', pr.mission_id, p_payment_id::text);
  UPDATE public.payments SET status = 'cancelled' WHERE id = p_payment_id;
END $$;
GRANT EXECUTE ON FUNCTION public.wallet_refund(UUID) TO authenticated;
