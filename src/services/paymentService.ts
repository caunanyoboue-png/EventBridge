import { supabase } from '../lib/supabase';
import { type Payment } from '../types';

export async function initiateContractPayment(contractId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl
    || import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${supabaseUrl}/functions/v1/cinetpay-initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ contract_id: contractId }),
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Erreur paiement');
  return data.payment_url as string;
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
