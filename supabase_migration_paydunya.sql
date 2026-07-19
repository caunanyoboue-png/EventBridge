-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Branchement PayDunya (recharge + retrait réels)
-- À exécuter APRÈS supabase_migration_wallet.sql.
-- Sécurité : la recharge/retrait ne se font plus en libre-service ;
-- seules les Edge Functions (service_role) créditent/débitent après PayDunya.
-- Exécuter dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Intentions de recharge (une par facture PayDunya) ───────
CREATE TABLE IF NOT EXISTS public.wallet_topups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  provider     TEXT NOT NULL DEFAULT 'paydunya',
  token        TEXT UNIQUE,                 -- token de la facture PayDunya
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_topups_select ON public.wallet_topups;
CREATE POLICY wallet_topups_select ON public.wallet_topups FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
-- Aucun INSERT/UPDATE utilisateur : les Edge Functions (service_role) s'en chargent.

-- ─── 2. Créditer une recharge confirmée par PayDunya (IPN). Idempotent. ─
CREATE OR REPLACE FUNCTION public.wallet_topup_apply(p_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.wallet_topups%ROWTYPE; newbal INTEGER;
BEGIN
  SELECT * INTO t FROM public.wallet_topups WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recharge introuvable'; END IF;
  IF t.status = 'completed' THEN RETURN; END IF; -- déjà appliquée
  PERFORM public.ensure_wallet(t.user_id);
  UPDATE public.wallets SET balance = balance + t.amount WHERE user_id = t.user_id RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (t.user_id, 'recharge', t.amount, newbal, 'Recharge PayDunya', p_token);
  UPDATE public.wallet_topups SET status = 'completed', completed_at = now() WHERE id = t.id;
END $$;

-- ─── 3. Débiter pour un retrait validé par PayDunya (disburse). Atomique. ─
CREATE OR REPLACE FUNCTION public.wallet_withdraw_apply(p_user UUID, p_amount INTEGER, p_method TEXT, p_ref TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal INTEGER; newbal INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  PERFORM public.ensure_wallet(p_user);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = p_user FOR UPDATE;
  IF COALESCE(bal,0) < p_amount THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = p_user RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (p_user, 'withdrawal', -p_amount, newbal, 'Retrait PayDunya (' || COALESCE(p_method,'mobile money') || ')', p_ref);
  RETURN newbal;
END $$;

-- ─── 4. Recréditer si le transfert échoue (reversal) ────────────
CREATE OR REPLACE FUNCTION public.wallet_credit(p_user UUID, p_amount INTEGER, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE newbal INTEGER;
BEGIN
  PERFORM public.ensure_wallet(p_user);
  UPDATE public.wallets SET balance = balance + p_amount WHERE user_id = p_user RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label)
    VALUES (p_user, 'refund', p_amount, newbal, COALESCE(p_label, 'Remboursement'));
END $$;

-- ─── 5. Droits : réservés aux Edge Functions (service_role), interdits aux users ─
-- On COUPE la recharge/retrait en libre-service (sinon on créditerait sans payer !).
REVOKE EXECUTE ON FUNCTION public.wallet_recharge(INTEGER, TEXT)                 FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_withdraw(INTEGER, TEXT)                 FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_topup_apply(TEXT)                       FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_withdraw_apply(UUID, INTEGER, TEXT, TEXT) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_credit(UUID, INTEGER, TEXT)             FROM public, authenticated;

GRANT EXECUTE ON FUNCTION public.wallet_topup_apply(TEXT)                        TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw_apply(UUID, INTEGER, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_credit(UUID, INTEGER, TEXT)              TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_recharge(INTEGER, TEXT)                  TO service_role;
