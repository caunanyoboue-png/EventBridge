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

/** Recharge (simulation) — crédite le solde de l'utilisateur connecté. */
export async function recharge(amount: number): Promise<number> {
  const { data, error } = await supabase.rpc('wallet_recharge', { p_amount: amount });
  if (error) throw error;
  return data as number;
}

/** Retrait (simulation) — débite le solde et trace le versement. */
export async function withdraw(amount: number, method: string): Promise<number> {
  const { data, error } = await supabase.rpc('wallet_withdraw', { p_amount: amount, p_method: method });
  if (error) throw error;
  return data as number;
}

/** Payer une mission depuis le solde (escrow). Renvoie l'id du paiement. */
export async function payMission(missionId: string, freelanceId: string, amount: number): Promise<string> {
  const { data, error } = await supabase.rpc('wallet_pay_mission', {
    p_mission_id: missionId, p_freelance_id: freelanceId, p_amount: amount,
  });
  if (error) throw error;
  return data as string;
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
