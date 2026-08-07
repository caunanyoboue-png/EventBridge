-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Branchement GeniusPay (recharge réelle + payout)
-- À exécuter APRÈS supabase_migration_wallet.sql, dans Supabase → SQL Editor.
--
-- Le solde n'est crédité QUE par le webhook signé (jamais côté client) :
-- on ferme donc la recharge/retrait en libre-service (service_role uniquement).
-- ═══════════════════════════════════════════════════════════════

-- 1) Intentions de recharge (collecte)
CREATE TABLE IF NOT EXISTS public.wallet_topups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  provider     TEXT NOT NULL DEFAULT 'geniuspay',
  reference    TEXT UNIQUE NOT NULL,          -- notre référence (metadata)
  external_ref TEXT,                          -- référence GeniusPay
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_topups_select ON public.wallet_topups;
CREATE POLICY wallet_topups_select ON public.wallet_topups FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role='admin'));

-- 2) Intentions de retrait (payout)
CREATE TABLE IF NOT EXISTS public.wallet_payouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  method       TEXT,                          -- ex : "orange-money-ci · +2250700000000"
  reference    TEXT UNIQUE NOT NULL,
  external_ref TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.wallet_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_payouts_select ON public.wallet_payouts;
CREATE POLICY wallet_payouts_select ON public.wallet_payouts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role='admin'));

-- 3) Créer une intention de recharge (appelée par l'Edge Function avec le JWT de l'utilisateur)
CREATE OR REPLACE FUNCTION public.wallet_topup_create(p_amount INTEGER, p_reference TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount IS NULL OR p_amount < 200 THEN RAISE EXCEPTION 'Montant minimum : 200 FCFA'; END IF;
  INSERT INTO public.wallet_topups(user_id, amount, reference) VALUES (uid, p_amount, p_reference);
END $$;
GRANT EXECUTE ON FUNCTION public.wallet_topup_create(INTEGER, TEXT) TO authenticated;

-- 4) Créditer une recharge confirmée (webhook payment.success). Idempotent.
CREATE OR REPLACE FUNCTION public.wallet_topup_apply(p_reference TEXT, p_external TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.wallet_topups%ROWTYPE; newbal INTEGER;
BEGIN
  SELECT * INTO t FROM public.wallet_topups WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recharge introuvable'; END IF;
  IF t.status = 'completed' THEN RETURN; END IF;
  PERFORM public.ensure_wallet(t.user_id);
  UPDATE public.wallets SET balance = balance + t.amount WHERE user_id = t.user_id RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (t.user_id, 'recharge', t.amount, newbal, 'Recharge Mobile Money', p_reference);
  UPDATE public.wallet_topups SET status='completed', external_ref=COALESCE(p_external,external_ref), completed_at=now() WHERE id=t.id;
END $$;

-- 5) Débiter pour un retrait (au lancement du payout, JWT du freelance). Atomique.
CREATE OR REPLACE FUNCTION public.wallet_payout_start(p_amount INTEGER, p_method TEXT, p_reference TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); bal INTEGER; newbal INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount IS NULL OR p_amount < 200 THEN RAISE EXCEPTION 'Montant minimum : 200 FCFA'; END IF;
  PERFORM public.ensure_wallet(uid);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF COALESCE(bal,0) < p_amount THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = uid RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (uid, 'withdrawal', -p_amount, newbal, 'Retrait (' || COALESCE(p_method,'mobile money') || ')', p_reference);
  INSERT INTO public.wallet_payouts(user_id, amount, method, reference, status)
    VALUES (uid, p_amount, p_method, p_reference, 'processing');
END $$;
GRANT EXECUTE ON FUNCTION public.wallet_payout_start(INTEGER, TEXT, TEXT) TO authenticated;

-- 6) Recréditer si le payout échoue (webhook cashout.failed).
CREATE OR REPLACE FUNCTION public.wallet_payout_reverse(p_reference TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE po public.wallet_payouts%ROWTYPE; newbal INTEGER;
BEGIN
  SELECT * INTO po FROM public.wallet_payouts WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND OR po.status IN ('failed','paid') THEN RETURN; END IF;
  PERFORM public.ensure_wallet(po.user_id);
  UPDATE public.wallets SET balance = balance + po.amount WHERE user_id = po.user_id RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (po.user_id, 'refund', po.amount, newbal, 'Retrait échoué — recrédité', p_reference);
  UPDATE public.wallet_payouts SET status='failed', completed_at=now() WHERE id=po.id;
END $$;

-- 7) Marquer un payout confirmé (webhook cashout.completed).
CREATE OR REPLACE FUNCTION public.wallet_payout_mark_paid(p_reference TEXT, p_external TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.wallet_payouts SET status='paid', external_ref=COALESCE(p_external,external_ref), completed_at=now()
    WHERE reference = p_reference AND status <> 'paid';
END $$;

-- 8) Droits : recharge/retrait libre-service COUPÉS (crédit uniquement via webhook)
REVOKE EXECUTE ON FUNCTION public.wallet_recharge(INTEGER, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_withdraw(INTEGER, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.wallet_topup_apply(TEXT, TEXT)      TO service_role;
GRANT  EXECUTE ON FUNCTION public.wallet_payout_reverse(TEXT)         TO service_role;
GRANT  EXECUTE ON FUNCTION public.wallet_payout_mark_paid(TEXT, TEXT) TO service_role;
