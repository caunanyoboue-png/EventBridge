import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, Phone } from 'lucide-react';
import { formatCFA, getInitials } from '../../lib/utils';
import { type Payment } from '../../types';
import { IcoWallet } from '../../components/icons/DoodleIcons';
import { roleColor } from '../../lib/roleTheme';
import toast from 'react-hot-toast';

// Moyens de versement courants en Côte d'Ivoire (mobile money + Wave + espèces)
const PAYOUT_METHODS = ['Orange Money', 'MTN Money', 'Moov Money', 'Wave', 'Espèces'];

function netOf(p: Payment) {
  const commission = p.commission_amount ?? Math.round(p.amount * 0.10);
  return p.net_amount ?? (p.amount - commission);
}

function PayoutModal({ payment, onClose, onConfirm }: {
  payment: Payment; onClose: () => void;
  onConfirm: (method: string, ref: string) => Promise<void>;
}) {
  const [method, setMethod] = useState(PAYOUT_METHODS[0]);
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,10,30,0.85)', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} className="card-glass p-6 w-full max-w-md">
        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Enregistrer le versement</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          {payment.payee?.full_name} — <span style={{ color: '#00C896', fontWeight: 700 }}>{formatCFA(netOf(payment))}</span>
          {payment.payee?.phone && <> · {payment.payee.phone}</>}
        </p>
        <label className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Moyen utilisé</label>
        <select value={method} onChange={e => setMethod(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3 mt-1"
          style={{ background: 'var(--color-input-bg)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--color-text-primary)' }}>
          {PAYOUT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Référence de la transaction (optionnel)"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
          style={{ background: 'var(--color-input-bg)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--color-text-primary)' }} />
        <div className="flex gap-2">
          <button type="button" disabled={busy}
            onClick={async () => { setBusy(true); await onConfirm(method, ref); setBusy(false); }}
            className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-bold text-[#261642]">
            {busy ? '…' : 'Confirmer le versement'}
          </button>
          <button type="button" onClick={onClose} className="px-4 rounded-xl text-sm border"
            style={{ borderColor: 'rgba(201,168,76,0.3)', color: 'var(--color-text-secondary)' }}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPayouts() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'paid'>('pending');
  const [target, setTarget] = useState<Payment | null>(null);

  useEffect(() => { fetchPayments(); }, []);

  async function fetchPayments() {
    const { data } = await supabase.from('payments')
      .select('*, payee:profiles!payee_id(full_name, phone), payer:profiles!payer_id(full_name)')
      .eq('status', 'completed')
      .order('paid_at', { ascending: false });
    setPayments((data || []) as Payment[]);
    setLoading(false);
  }

  async function markPaid(method: string, ref: string) {
    if (!target) return;
    const { error } = await supabase.from('payments').update({
      payout_status: 'paid',
      payout_at: new Date().toISOString(),
      payout_method: method,
      payout_ref: ref.trim() || null,
    }).eq('id', target.id);
    if (error) { toast.error('Erreur lors de l\'enregistrement'); return; }
    try {
      await supabase.from('notifications').insert({
        user_id: target.payee_id,
        type: 'payment_received',
        title: 'Versement effectué',
        body: `Votre versement de ${formatCFA(netOf(target))} a été effectué via ${method}.`,
        data: { payment_id: target.id, contract_id: target.contract_id },
        is_read: false,
      });
    } catch { /* notif non bloquante */ }
    toast.success('Versement enregistré');
    setTarget(null);
    fetchPayments();
  }

  const pending = payments.filter(p => p.payout_status !== 'paid');
  const paid = payments.filter(p => p.payout_status === 'paid');
  const list = tab === 'pending' ? pending : paid;
  const totalPending = pending.reduce((s, p) => s + netOf(p), 0);
  const totalPaid = paid.reduce((s, p) => s + netOf(p), 0);

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: 'var(--color-text-primary)' }}>
        <IcoWallet size={25} color={roleColor('admin')} /> Versements freelances
      </h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card-glass p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{pending.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>À verser</div>
        </div>
        <div className="card-glass p-4 text-center">
          <div className="text-xl font-bold" style={{ color: 'var(--color-gold-primary)' }}>{formatCFA(totalPending)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Montant en attente</div>
        </div>
        <div className="card-glass p-4 text-center">
          <div className="text-xl font-bold" style={{ color: '#00C896' }}>{formatCFA(totalPaid)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Total versé</div>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {(['pending', 'paid'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={tab === t
              ? { background: 'var(--color-gold-primary)', color: '#261642' }
              : { background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid rgba(201,168,76,0.2)' }}>
            {t === 'pending' ? `À verser (${pending.length})` : `Versés (${paid.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>Chargement...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
          {tab === 'pending' ? 'Aucun versement en attente' : 'Aucun versement effectué'}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(p => (
            <div key={p.id} className="card-glass p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-48">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'var(--color-gold-primary)', color: '#261642' }}>
                  {getInitials(p.payee?.full_name || '?')}
                </div>
                <div>
                  <div className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{p.payee?.full_name || '–'}</div>
                  <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
                    {p.payee?.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {p.payee.phone}</span>}
                    <span>{p.description || 'Contrat'}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{formatCFA(netOf(p))}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  brut {formatCFA(p.amount)} · comm. {formatCFA(p.commission_amount ?? Math.round(p.amount * 0.10))}
                </div>
              </div>

              {p.payout_status === 'paid' ? (
                <span className="text-xs inline-flex items-center gap-1 shrink-0" style={{ color: '#00C896' }}>
                  <CheckCircle2 size={14} /> Versé{p.payout_at ? ' le ' + new Date(p.payout_at).toLocaleDateString('fr-CI') : ''}
                  {p.payout_method ? ` · ${p.payout_method}` : ''}
                </span>
              ) : (
                <button onClick={() => setTarget(p)}
                  className="btn-gold px-4 py-2 rounded-xl text-sm font-bold text-[#261642] shrink-0">
                  Marquer versé
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {target && <PayoutModal payment={target} onClose={() => setTarget(null)} onConfirm={markPaid} />}
    </DashboardLayout>
  );
}
