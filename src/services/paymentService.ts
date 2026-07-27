import { supabase } from '../lib/supabase';
import { type Payment } from '../types';

/**
 * Paie un contrat signé depuis le solde du portefeuille de l'organisateur.
 * Le montant (brut + indemnité) est calculé côté serveur à partir du contrat ;
 * la somme est bloquée en escrow puis libérée au freelance à la validation.
 * Renvoie l'id du paiement créé.
 */
export async function payContractFromWallet(contractId: string): Promise<string> {
  const { data, error } = await supabase.rpc('wallet_pay_contract', { p_contract_id: contractId });
  if (error) throw error;
  return data as string;
}

export async function fetchPaymentByContract(contractId: string): Promise<Payment | null> {
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Payment | null;
}
