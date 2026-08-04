import { useEffect, useState } from 'react';
import { Hourglass, Loader2, CheckCircle2, XCircle, Undo2, Wallet, BadgeCheck, RotateCw, KeyRound, type LucideIcon } from 'lucide-react';
import { type Payment } from '../types';
import { payContractFromWallet, fetchPaymentByContract } from '../services/paymentService';
import { releaseEscrow, refundEscrow, confirmPresence, getCheckinCode } from '../lib/walletService';
import { supabase } from '../lib/supabase';
import { formatCFA } from '../lib/utils';
import toast from 'react-hot-toast';

interface Props {
  contractId: string;
  amount: number;       // total_gross + indemnity
  myRole: 'organizer' | 'freelance';
}

const STATUS_UI: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  pending:    { label: 'En attente', color: '#f59e0b', Icon: Hourglass },
  processing: { label: 'En cours',   color: '#3b82f6', Icon: Loader2 },
  completed:  { label: 'Payé',       color: '#10b981', Icon: CheckCircle2 },
  failed:     { label: 'Échoué',     color: '#ef4444', Icon: XCircle },
  cancelled:  { label: 'Annulé',     color: 'var(--color-text-muted)', Icon: Undo2 },
};

// Commission/net : valeurs stockées, sinon repli sur 10 %.
function breakdown(p: Payment) {
  const commission = p.commission_amount ?? Math.round(p.amount * 0.10);
  const net = p.net_amount ?? (p.amount - commission);
  return { commission, net };
}

export default function PaymentButton({ contractId, amount, myRole }: Props) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [code, setCode] = useState('');
  const [checkinCode, setCheckinCode] = useState<string | null>(null);

  const checkedIn = !!payment?.checked_in_at;
  const paidOut = payment?.payout_status === 'paid';

  useEffect(() => {
    fetchPaymentByContract(contractId).then(p => setPayment(p)).finally(() => setLoading(false));
  }, [contractId]);

  // Organisateur : récupère le code de présence à communiquer (lisible par lui seul).
  useEffect(() => {
    if (myRole === 'organizer' && payment?.status === 'completed' && !paidOut) {
      getCheckinCode(payment.id).then(setCheckinCode).catch(() => setCheckinCode(null));
    }
  }, [myRole, payment?.id, payment?.status, paidOut]);

  async function reload(): Promise<Payment | null> {
    const p = await fetchPaymentByContract(contractId);
    setPayment(p);
    return p;
  }

  // Notification (jamais bloquante) — garde les 2 parties informées à chaque étape de l'escrow.
  async function notify(userId: string, title: string, body: string, missionId?: string | null) {
    try {
      await supabase.from('notifications').insert({
        user_id: userId, type: 'payment', title, body,
        data: missionId ? { mission_id: missionId } : {}, is_read: false,
      });
    } catch { /* jamais bloquant */ }
  }

  async function handlePay() {
    setPaying(true);
    try {
      await payContractFromWallet(contractId);
      const p = await reload();
      if (p?.payee_id) notify(p.payee_id, 'Paiement en séquestre',
        "Un organisateur a payé votre prestation (fonds bloqués en séquestre). Présentez-vous à l'événement et saisissez le code de présence remis sur place pour débloquer votre versement.", p.mission_id);
      toast.success('Paiement effectué — somme bloquée en escrow.');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Erreur paiement';
      toast.error(/solde insuffisant/i.test(raw) ? 'Solde insuffisant — rechargez votre portefeuille.' : raw);
    } finally { setPaying(false); }
  }

  async function handleRelease() {
    if (!payment) return;
    setReleasing(true);
    try {
      await releaseEscrow(payment.id);
      const p = await reload();
      if (p?.payee_id) notify(p.payee_id, 'Vous avez été payé',
        `Votre prestation a été validée : ${formatCFA(breakdown(p).net)} crédités sur votre portefeuille.`, p.mission_id);
      toast.success('Prestation validée — gains versés au freelance.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally { setReleasing(false); }
  }

  async function handleRefund() {
    if (!payment) return;
    setRefunding(true);
    try {
      await refundEscrow(payment.id);
      const p = await reload();
      if (p?.payee_id) notify(p.payee_id, 'Paiement annulé',
        "Le paiement de votre prestation a été annulé (présence non confirmée). Si vous étiez présent, contactez l'organisateur ou ouvrez un litige.", p.mission_id);
      toast.success('Remboursé — la somme est revenue sur votre portefeuille.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally { setRefunding(false); }
  }

  async function handleConfirmPresence() {
    if (!payment || !code.trim()) return;
    setChecking(true);
    try {
      await confirmPresence(payment.id, code.trim());
      const p = await reload();
      setCode('');
      if (p?.payer_id) notify(p.payer_id, 'Présence confirmée',
        'Le freelance a confirmé sa présence. Vous pouvez valider la prestation et le payer.', p.mission_id);
      toast.success('Présence confirmée !');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Erreur';
      toast.error(/invalide/i.test(raw) ? 'Code de présence invalide.' : raw);
    } finally { setChecking(false); }
  }

  if (loading) return null;

  // ── FREELANCE ────────────────────────────────────────────────────────────
  if (myRole === 'freelance') {
    if (!payment) return (
      <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2" style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}>
        <Hourglass size={15} /> En attente du paiement de l'organisateur
      </div>
    );
    const ui = STATUS_UI[payment.status] || STATUS_UI.pending;
    const { net } = breakdown(payment);
    return (
      <div className="space-y-2">
        <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2"
          style={{ background: `${ui.color}12`, border: `1px solid ${ui.color}40`, color: ui.color }}>
          <ui.Icon size={15} /> Paiement {ui.label}
        </div>
        {payment.status === 'completed' && (
          <>
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--color-surface)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-secondary)' }}>Net à recevoir</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{formatCFA(net)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span style={{ color: 'var(--color-text-secondary)' }}>Versement</span>
                <span style={{ color: paidOut ? '#00C896' : '#F59E0B', fontWeight: 600 }}>
                  {paidOut
                    ? `Versé${payment.payout_at ? ' le ' + new Date(payment.payout_at).toLocaleDateString('fr-CI') : ''}`
                    : 'En attente'}
                </span>
              </div>
              {paidOut && payment.payout_method && (
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  via {payment.payout_method}{payment.payout_ref ? ` · réf ${payment.payout_ref}` : ''}
                </div>
              )}
            </div>

            {/* Pointage : saisir le code remis sur place pour débloquer le versement */}
            {!paidOut && !checkedIn && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid rgba(201,168,76,0.2)' }}>
                <p className="text-xs mb-2 flex items-start gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  <KeyRound size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--color-gold-primary)' }} />
                  Sur place, saisissez le <strong>code de présence</strong> que l'organisateur vous remet pour débloquer votre paiement.
                </p>
                <div className="flex gap-2">
                  <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Ex : A1B2C3"
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none text-center font-bold"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--color-text-primary)', letterSpacing: '0.25em' }} />
                  <button onClick={handleConfirmPresence} disabled={checking || !code.trim()}
                    className="btn-gold px-4 py-2 rounded-lg text-sm font-bold text-[#261642] disabled:opacity-60">
                    {checking ? '…' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}

            {!paidOut && checkedIn && (
              <div className="px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
                style={{ background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.3)', color: '#00C896' }}>
                <BadgeCheck size={15} /> Présence confirmée — en attente du versement par l'organisateur
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── ORGANISATEUR ─────────────────────────────────────────────────────────
  if (payment?.status === 'completed') {
    const { commission, net } = breakdown(payment);
    return (
      <div className="space-y-2">
        <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
          <CheckCircle2 size={16} /> Paiement effectué — {formatCFA(payment.amount)}
          {payment.paid_at && (
            <span className="block text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              le {new Date(payment.paid_at).toLocaleDateString('fr-CI')}
            </span>
          )}
        </div>
        <div className="px-4 py-2.5 rounded-xl text-xs" style={{ background: 'var(--color-surface)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-secondary)' }}>Commission plateforme</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{formatCFA(commission)}</span>
          </div>
          <div className="flex justify-between mt-0.5">
            <span style={{ color: 'var(--color-text-secondary)' }}>Net reversé au freelance</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{formatCFA(net)}</span>
          </div>
        </div>

        {paidOut ? (
          <div className="px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
            style={{ background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.3)', color: '#00C896' }}>
            <BadgeCheck size={15} /> Gains versés au freelance{payment.payout_at ? ' le ' + new Date(payment.payout_at).toLocaleDateString('fr-CI') : ''}
          </div>
        ) : (
          <>
            {/* Code de présence à remettre au freelance SUR PLACE */}
            {!checkedIn && checkinCode && (
              <div className="px-4 py-3 rounded-xl text-center" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)' }}>
                <p className="text-xs mb-1 flex items-center justify-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  <KeyRound size={13} style={{ color: 'var(--color-gold-primary)' }} /> Code de présence — à remettre au freelance <strong>sur place</strong>
                </p>
                <p className="font-display text-2xl font-bold" style={{ color: 'var(--color-gold-primary)', letterSpacing: '0.3em' }}>{checkinCode}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>En attente du pointage du freelance…</p>
              </div>
            )}

            {checkedIn && (
              <div className="px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
                style={{ background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.3)', color: '#00C896' }}>
                <BadgeCheck size={15} /> Présence du freelance confirmée{payment.checked_in_at ? ' le ' + new Date(payment.checked_in_at).toLocaleDateString('fr-CI') : ''}
              </div>
            )}

            <button onClick={handleRelease} disabled={releasing || !checkedIn}
              title={!checkedIn ? 'Disponible une fois le freelance présent (code saisi)' : ''}
              className="btn-gold w-full py-3 rounded-xl text-sm font-bold text-[#261642] flex items-center justify-center gap-2"
              style={{ opacity: (releasing || !checkedIn) ? 0.55 : 1, cursor: checkedIn ? 'pointer' : 'not-allowed' }}>
              {releasing ? 'Versement…' : <><BadgeCheck size={16} /> Valider la prestation et verser au freelance</>}
            </button>

            {!checkedIn && (
              <button onClick={handleRefund} disabled={refunding}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                {refunding ? 'Remboursement…' : <><Undo2 size={15} /> Le freelance ne s'est pas présenté — me faire rembourser</>}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  if (payment?.status === 'cancelled') {
    return (
      <div className="space-y-2">
        <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
          <Undo2 size={15} /> Paiement annulé — remboursé sur votre portefeuille
        </div>
        <button onClick={handlePay} disabled={paying}
          className="btn-gold w-full py-3 rounded-xl text-sm font-bold text-[#261642] flex items-center justify-center gap-2"
          style={{ opacity: paying ? 0.7 : 1 }}>
          {paying ? <><Loader2 size={16} className="animate-spin" /> Paiement…</> : <><Wallet size={16} /> Payer à nouveau {formatCFA(amount)}</>}
        </button>
      </div>
    );
  }

  if (payment?.status === 'processing') {
    return (
      <div className="space-y-2">
        <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2"
          style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6' }}>
          <Loader2 size={15} className="animate-spin" /> Paiement en cours de traitement…
        </div>
        <button onClick={handlePay} disabled={paying}
          className="w-full py-2 rounded-xl text-xs border"
          style={{ borderColor: 'rgba(201,168,76,0.3)', color: 'var(--color-text-secondary)' }}>
          Reprendre le paiement
        </button>
      </div>
    );
  }

  if (payment?.status === 'failed') {
    return (
      <div className="space-y-2">
        <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
          <XCircle size={15} /> Paiement échoué
        </div>
        <button onClick={handlePay} disabled={paying}
          className="btn-gold w-full py-3 rounded-xl text-sm font-bold text-[#261642] flex items-center justify-center gap-2"
          style={{ opacity: paying ? 0.7 : 1 }}>
          {paying ? 'Paiement…' : <><RotateCw size={16} /> Réessayer — {formatCFA(amount)}</>}
        </button>
      </div>
    );
  }

  // Pas de paiement encore → bouton principal
  return (
    <button onClick={handlePay} disabled={paying}
      className="btn-gold w-full py-3 rounded-xl text-sm font-bold text-[#261642] flex items-center justify-center gap-2"
      style={{ opacity: paying ? 0.7 : 1 }}>
      {paying
        ? <><Loader2 size={16} className="animate-spin" /> Paiement…</>
        : <><Wallet size={16} /> Payer {formatCFA(amount)} depuis mon portefeuille</>}
    </button>
  );
}
