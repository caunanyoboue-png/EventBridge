import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type Contract } from '../types';

export function useContractRealtime(
  contractId: string | null,
  onUpdate: (contract: Contract) => void,
) {
  useEffect(() => {
    if (!contractId) return;
    const channel = supabase
      .channel(`contract-${contractId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'contracts',
        filter: `id=eq.${contractId}`,
      }, payload => {
        onUpdate(payload.new as Contract);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contractId, onUpdate]);
}
