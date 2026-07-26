import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { getWallet, getTransactions, rechargeWallet, requestWithdraw, type Wallet as W, type WalletTx } from '../lib/walletService';
import { formatCFA } from '../lib/utils';
import { roleColor } from '../lib/roleTheme';
import { IcoWallet } from '../components/icons/DoodleIcons';
import toast from 'react-hot-toast';

const QUICK = [5000, 10000, 25000, 50000];
const WITHDRAW_MODES = [
  { value: 'orange-money-ci', label: 'Orange Money' },
  { value: 'mtn-ci',          label: 'MTN MoMo' },
  { value: 'moov-ci',         label: 'Moov Money' },
  { value: 'wave-ci',         label: 'Wave' },
];

const TX_LABEL: Record<string, string> = {
  recharge: 'Recharge', hold: 'Mission payée (escrow)', release: 'Escrow libéré',
  earning: 'Gain mission', withdrawal: 'Retrait', refund: 'Remboursement',
};

export default function Wallet() {
  const { profile } = useAuth();
  const [w, setW] = useState<W>({ balance: 0, held: 0, currency: 'XOF' });
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [amount, setAmount] = useState<number>(10000);
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState(WITHDRAW_MODES[0].value);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const isFreelance = profile?.role === 'freelance';
  const accent = roleColor(profile?.role);

  async function load() {
    if (!profile) return;
    const [ww, tt] = await Promise.all([getWallet(profile.id), getTransactions(profile.id)]);
    setW(ww); setTxs(tt); setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.id]);

  async function doRecharge() {
    if (amount < 200) { toast.error('Montant minimum : 200 FCFA.'); return; }
    setBusy(true);
    try {
      await rechargeWallet(amount);
      toast.success('Portefeuille rechargé (simulation).');
      await load();
    } catch (e) {
      toast.error((e as Error).message || 'Erreur');
    } finally { setBusy(false); }
  }

  async function doWithdraw() {
    if (amount < 200) { toast.error('Montant minimum : 200 FCFA.'); return; }
    if (amount > w.balance) { toast.error('Montant supérieur au solde disponible.'); return; }
    if (!phone.trim()) { toast.error('Renseignez votre numéro mobile money.'); return; }
    setBusy(true);
    try {
      await requestWithdraw(amount, phone.trim(), operator);
      toast.success('Retrait enregistré (simulation).');
      await load();
    } catch (e) {
      toast.error((e as Error).message || 'Erreur');
    } finally { setBusy(false); }
  }

  const inputStyle = { background: 'var(--color-input-bg)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--color-text-primary)' };

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: 'var(--color-text-primary)' }}>
        <IcoWallet size={26} color={accent} /> Portefeuille
      </h1>

      {/* Solde */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="card-glass p-6">
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{isFreelance ? 'Gains disponibles' : 'Solde disponible'}</p>
          <p className="font-display text-4xl font-bold mt-1" style={{ color: accent }}>{formatCFA(w.balance)}</p>
        </div>
        {!isFreelance && (
          <div className="card-glass p-6">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Bloqué en escrow (missions en cours)</p>
            <p className="font-display text-4xl font-bold mt-1" style={{ color: '#f59e0b' }}>{formatCFA(w.held)}</p>
          </div>
        )}
      </div>

      {/* Action : recharge (organisateur) ou retrait (freelance) */}
      <div className="card-glass p-6 mb-6">
        <h2 className="font-semibold mb-1" style={{ color: 'var(--color-gold-primary)' }}>
          {isFreelance ? 'Retirer mes gains' : 'Recharger le portefeuille'}
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {isFreelance
            ? 'Versement sur votre compte mobile money (Orange Money, MTN, Moov, Wave).'
            : 'Rechargez par mobile money (Orange Money, MTN, Moov, Wave).'}
        </p>

        {!isFreelance && (
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK.map(q => (
              <button key={q} onClick={() => setAmount(q)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                style={{ borderColor: amount === q ? accent : 'rgba(201,168,76,0.25)',
                  color: amount === q ? accent : 'var(--color-text-secondary)',
                  background: amount === q ? 'rgba(212,175,55,0.12)' : 'transparent' }}>
                {formatCFA(q)}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Montant (FCFA)</label>
            <input type="number" value={amount} min={200} step={500}
              onChange={e => setAmount(Number(e.target.value))}
              className="px-3 py-2 rounded-lg text-sm outline-none" style={{ ...inputStyle, width: 150 }} />
          </div>
          {isFreelance && (
            <>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Numéro mobile money</label>
                <input type="tel" value={phone} placeholder="+225 07 00 00 00 00"
                  onChange={e => setPhone(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm outline-none" style={{ ...inputStyle, width: 180 }} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Opérateur</label>
                <select value={operator} onChange={e => setOperator(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                  {WITHDRAW_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </>
          )}
          <button onClick={isFreelance ? doWithdraw : doRecharge} disabled={busy}
            className="btn-gold px-6 py-2.5 rounded-xl text-sm font-bold text-[#261642] disabled:opacity-60">
            {busy ? '…' : isFreelance ? 'Retirer' : 'Recharger'}
          </button>
        </div>
      </div>

      {/* Historique */}
      <div className="card-glass p-6">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--color-gold-primary)' }}>Historique</h2>
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Chargement…</p>
        ) : txs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Aucune opération pour l'instant.</p>
        ) : (
          <div>
            {txs.map(t => {
              const positive = t.amount >= 0;
              return (
                <div key={t.id} className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{t.label || TX_LABEL[t.type] || t.type}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{new Date(t.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <p className="text-sm font-bold" style={{ color: positive ? '#00C896' : '#ef4444' }}>
                    {positive ? '+' : '−'}{formatCFA(Math.abs(t.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
