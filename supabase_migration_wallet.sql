-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Portefeuille (wallet) + escrow + versements — MODE SIMULATION
-- Aucun mouvement d'argent réel : tout est virtuel, prêt à brancher CinetPay
-- (collecte pour la recharge, transfert pour le retrait) le jour venu.
-- Exécuter dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Portefeuille (un solde par utilisateur) ─────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0,   -- FCFA disponibles (dépensables / retirables)
  held        INTEGER NOT NULL DEFAULT 0,   -- FCFA bloqués en escrow (organisateur)
  currency    TEXT NOT NULL DEFAULT 'XOF',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS wallets_updated_at ON public.wallets;
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. Grand livre : chaque mouvement du portefeuille ──────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN
                   ('recharge','hold','release','earning','withdrawal','refund')),
  amount         INTEGER NOT NULL,          -- signé : + crédit, - débit
  balance_after  INTEGER,
  status         TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  label          TEXT,
  mission_id     UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  reference      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wtx_user ON public.wallet_transactions(user_id, created_at DESC);

-- ─── 3. RLS : chacun voit SON portefeuille + ses transactions (admin voit tout) ─
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallets_select ON public.wallets;
CREATE POLICY wallets_select ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS wtx_select ON public.wallet_transactions;
CREATE POLICY wtx_select ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
-- Aucune policy INSERT/UPDATE : seules les fonctions ci-dessous (SECURITY DEFINER) modifient les soldes.

-- ─── 4. Helper : garantir l'existence d'un portefeuille ─────────
CREATE OR REPLACE FUNCTION public.ensure_wallet(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets(user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
END $$;

-- ─── 5. RECHARGE (simulation) : crédite le solde de l'appelant ──
-- En réel, cette fonction sera appelée par le webhook CinetPay après une collecte réussie.
CREATE OR REPLACE FUNCTION public.wallet_recharge(p_amount INTEGER, p_ref TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); newbal INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  PERFORM public.ensure_wallet(uid);
  UPDATE public.wallets SET balance = balance + p_amount WHERE user_id = uid RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (uid, 'recharge', p_amount, newbal, 'Recharge du portefeuille', p_ref);
  RETURN newbal;
END $$;

-- ─── 6. PAYER UNE MISSION : débite l'organisateur, bloque en escrow ─
-- Débite le solde, augmente le "held", crée la ligne payments (escrow), calcule commission/net.
CREATE OR REPLACE FUNCTION public.wallet_pay_mission(p_mission_id UUID, p_freelance_id UUID, p_amount INTEGER)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); bal INTEGER; rate NUMERIC; comm INTEGER; net INTEGER; pid UUID; newbal INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  PERFORM public.ensure_wallet(uid);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF COALESCE(bal,0) < p_amount THEN RAISE EXCEPTION 'Solde insuffisant — rechargez votre portefeuille'; END IF;

  SELECT commission_rate INTO rate FROM public.missions WHERE id = p_mission_id;
  IF rate IS NULL OR rate <= 0 OR rate >= 1 THEN rate := 0.10; END IF;
  comm := ROUND(p_amount * rate);
  net  := p_amount - comm;

  UPDATE public.wallets SET balance = balance - p_amount, held = held + p_amount
    WHERE user_id = uid RETURNING balance INTO newbal;

  INSERT INTO public.payments(mission_id, payer_id, payee_id, amount, commission_amount, net_amount,
      transaction_id, status, description, payout_status)
    VALUES (p_mission_id, uid, p_freelance_id, p_amount, comm, net,
      'EBW_' || REPLACE(gen_random_uuid()::text, '-', ''), 'completed', 'Paiement mission (escrow)', 'pending')
    RETURNING id INTO pid;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, mission_id, reference)
    VALUES (uid, 'hold', -p_amount, newbal, 'Mission payée — bloquée en escrow', p_mission_id, pid::text);
  RETURN pid;
END $$;

-- ─── 7. LIBÉRER L'ESCROW vers le freelance (à la validation) ────
CREATE OR REPLACE FUNCTION public.wallet_release(p_payment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.payments%ROWTYPE; fnbal INTEGER;
BEGIN
  SELECT * INTO pr FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable'; END IF;
  IF pr.payout_status = 'paid' THEN RETURN; END IF; -- déjà libéré (idempotent)
  IF auth.uid() <> pr.payer_id AND NOT EXISTS
     (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  THEN RAISE EXCEPTION 'Action non autorisée'; END IF;

  UPDATE public.wallets SET held = GREATEST(0, held - pr.amount) WHERE user_id = pr.payer_id;
  PERFORM public.ensure_wallet(pr.payee_id);
  UPDATE public.wallets SET balance = balance + pr.net_amount
    WHERE user_id = pr.payee_id RETURNING balance INTO fnbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, mission_id, reference)
    VALUES (pr.payee_id, 'earning', pr.net_amount, fnbal, 'Gain mission — escrow libéré', pr.mission_id, p_payment_id::text);
  UPDATE public.payments SET payout_status = 'paid', payout_at = now() WHERE id = p_payment_id;
END $$;

-- ─── 8. REMBOURSER l'organisateur (annulation avant validation) ─
CREATE OR REPLACE FUNCTION public.wallet_refund(p_payment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.payments%ROWTYPE; obal INTEGER;
BEGIN
  SELECT * INTO pr FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable'; END IF;
  IF pr.status = 'cancelled' OR pr.payout_status = 'paid' THEN RETURN; END IF;
  IF auth.uid() <> pr.payer_id AND NOT EXISTS
     (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  THEN RAISE EXCEPTION 'Action non autorisée'; END IF;

  UPDATE public.wallets SET held = GREATEST(0, held - pr.amount), balance = balance + pr.amount
    WHERE user_id = pr.payer_id RETURNING balance INTO obal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, mission_id, reference)
    VALUES (pr.payer_id, 'refund', pr.amount, obal, 'Remboursement — mission annulée', pr.mission_id, p_payment_id::text);
  UPDATE public.payments SET status = 'cancelled' WHERE id = p_payment_id;
END $$;

-- ─── 9. RETRAIT (simulation payout) : le freelance retire vers son mobile money ─
-- En réel, déclenchera un transfert CinetPay ; ici on débite juste le solde + on trace.
CREATE OR REPLACE FUNCTION public.wallet_withdraw(p_amount INTEGER, p_method TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); bal INTEGER; newbal INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  PERFORM public.ensure_wallet(uid);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF COALESCE(bal,0) < p_amount THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = uid RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, label, reference)
    VALUES (uid, 'withdrawal', -p_amount, newbal, 'Retrait (' || COALESCE(p_method,'mobile money') || ')', p_method);
  RETURN newbal;
END $$;

-- ─── 10. Droits d'exécution ─────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.wallet_recharge(INTEGER, TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_pay_mission(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_release(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_refund(UUID)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw(INTEGER, TEXT)          TO authenticated;
