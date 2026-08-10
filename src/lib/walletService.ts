import { supabase } from './supabase';

export interface Wallet { balance: number; held: number; currency: string; }
export interface WalletTx {
  id: string; type: string; amount: number; balance_after: number | null;
  label: string | null; created_at: string; mission_id: string | null;
}

export async function getWallet(userId: string): Promise<Wallet> {
  const { data } = await supabase.from('wallets')
    .select('balance, held, currency').eq('user_id', userId).maybeSingle();
  return (data as Wallet) ?? { balance: 0, held: 0, currency: 'XOF' };
}

export async function getTransactions(userId: string, limit = 40): Promise<WalletTx[]> {
  const { data } = await supabase.from('wallet_transactions')
    .select('id, type, amount, balance_after, label, created_at, mission_id')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  return (data || []) as WalletTx[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RECHARGE — encaissement réel via GeniusPay (Mobile Money).
// La recharge NE crédite plus directement : l'Edge Function « geniuspay-collect »
// crée l'intention + l'URL de paiement ; le solde n'est crédité qu'après la
// confirmation réelle (webhook → wallet_topup_apply). Le RETRAIT reste en
// simulation tant que le payout GeniusPay n'est pas branché.
// ─────────────────────────────────────────────────────────────────────────────

/** Démarre une recharge : crée l'intention côté serveur et renvoie l'URL de paiement GeniusPay. */
export async function rechargeWallet(amount: number): Promise<string> {
  const { data, error } = await supabase.functions.invoke('geniuspay-collect', {
    body: { amount, return_url: window.location.origin },
  });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const b = await ctx.json() as { error?: string };
        if (b?.error) msg = b.error;
      }
    } catch { /* garde le message par défaut */ }
    throw new Error(msg || 'Échec du démarrage du paiement.');
  }
  const url = (data as { payment_url?: string })?.payment_url;
  if (!url) throw new Error((data as { error?: string })?.error || 'URL de paiement indisponible.');
  return url;
}

/** Retrait des gains — SIMULATION : débite le solde et enregistre le retrait. */
export async function requestWithdraw(amount: number, phone: string, operator: string): Promise<void> {
  const method = phone ? `${operator} · ${phone}` : operator;
  const { error } = await supabase.rpc('wallet_withdraw', { p_amount: amount, p_method: method });
  if (error) throw error;
}

/** Libérer l'escrow vers le freelance (à la validation de la mission). */
export async function releaseEscrow(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('wallet_release', { p_payment_id: paymentId });
  if (error) throw error;
}

/** Rembourser l'organisateur (annulation avant validation). */
export async function refundEscrow(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('wallet_refund', { p_payment_id: paymentId });
  if (error) throw error;
}

/** Le freelance confirme sa présence sur place avec le code remis par l'organisateur. */
export async function confirmPresence(paymentId: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('wallet_confirm_presence', { p_payment_id: paymentId, p_code: code });
  if (error) throw error;
}

/** Code de présence d'un paiement — lisible par le SEUL organisateur (RLS). null sinon. */
export async function getCheckinCode(paymentId: string): Promise<string | null> {
  const { data } = await supabase.from('payment_checkins')
    .select('code').eq('payment_id', paymentId).maybeSingle();
  return (data as { code?: string } | null)?.code ?? null;
}
