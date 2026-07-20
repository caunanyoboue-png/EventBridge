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

// Appel d'une Edge Function avec le JWT de l'utilisateur.
async function callFn<T = Record<string, unknown>>(name: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');
  const base = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || (d as { error?: string }).error) {
    throw new Error((d as { error?: string }).error || 'Service indisponible');
  }
  return d as T;
}

/** Recharge via PayDunya — renvoie l'URL de paiement (l'appelant y redirige). */
export async function initiateRecharge(amount: number): Promise<string> {
  const d = await callFn<{ payment_url: string }>('paydunya-initiate', { amount });
  return d.payment_url;
}

/** Retrait via PayDunya Disburse — versement automatique sur le mobile money. */
export async function requestWithdraw(amount: number, phone: string, operator: string): Promise<void> {
  await callFn('paydunya-withdraw', { amount, phone, operator });
}

/** Filet de sécurité : vérifie la dernière recharge en attente auprès de PayDunya et crédite. */
export async function confirmRecharge(): Promise<{ credited: boolean }> {
  return await callFn<{ credited: boolean }>('paydunya-confirm', {});
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
