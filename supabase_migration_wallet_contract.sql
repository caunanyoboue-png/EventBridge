-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Paiement d'un contrat via le PORTEFEUILLE (escrow)
-- Remplace l'ancien paiement par redirection externe.
-- À exécuter APRÈS supabase_migration_wallet.sql, dans Supabase → SQL Editor → Run.
--
-- L'organisateur paie un contrat signé depuis son solde : la somme
-- (brut + indemnité de fin de contrat) est calculée côté serveur à partir
-- du contrat, débitée du solde et bloquée en escrow (held). À la validation,
-- public.wallet_release(payment_id) verse le net au freelance.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Payer un contrat depuis le portefeuille, bloquer en escrow ──────
CREATE OR REPLACE FUNCTION public.wallet_pay_contract(p_contract_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid  UUID := auth.uid();
  c    public.contracts%ROWTYPE;
  amt  INTEGER;
  bal  INTEGER;
  rate NUMERIC;
  comm INTEGER;
  net  INTEGER;
  pid  UUID;
  newbal INTEGER;
  existing public.payments%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT * INTO c FROM public.contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrat introuvable'; END IF;
  IF c.organizer_id <> uid THEN RAISE EXCEPTION 'Seul l''organisateur peut payer ce contrat'; END IF;
  IF c.status <> 'signed' THEN RAISE EXCEPTION 'Le contrat doit être signé avant paiement'; END IF;

  -- Idempotence : s'il existe déjà un paiement abouti pour ce contrat, le renvoyer.
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
    VALUES (p_contract_id, c.mission_id, uid, c.freelance_id, amt,
      comm, net, 'EBW_' || REPLACE(gen_random_uuid()::text, '-', ''),
      'completed', 'Paiement contrat (escrow)', 'pending')
    RETURNING id INTO pid;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, mission_id, reference)
    VALUES (uid, 'hold', -amt, newbal, 'Contrat payé — bloqué en escrow', c.mission_id, pid::text);

  RETURN pid;
END $$;

GRANT EXECUTE ON FUNCTION public.wallet_pay_contract(UUID) TO authenticated;

-- ─── 2. Nettoyage : retirer les colonnes de l'ancien prestataire externe ─
ALTER TABLE public.payments DROP COLUMN IF EXISTS cinetpay_token;
ALTER TABLE public.payments DROP COLUMN IF EXISTS payment_url;
