import { useEffect, useState } from 'react';
import { Hourglass, Loader2, CheckCircle2, XCircle, Undo2, CreditCard, RotateCw, type LucideIcon } from 'lucide-react';
import { type Payment } from '../types';
import { initiateContractPayment, fetchPaymentByContract } from '../services/paymentService';
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

// Commission/net : valeurs stockées, sinon repli sur 10 % (avant redéploiement de l'Edge Function).
function breakdown(p: Payment) {
  const commission = p.commission_amount ?? Math.round(p.amount * 0.10);
  const net = p.net_amount ?? (p.amount - commission);
  return { commission, net };
}

export default function PaymentButton({ contractId, amount, myRole }: Props) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetchPaymentByContract(contractId)
      .then(p => setPayment(p))
      .finally(() => setLoading(false));
  }, [contractId]);

  // Polling si processing (attend confirmation webhook)
  useEffect(() => {
    if (payment?.status !== 'processing') return;
    const iv = setInterval(async () => {
      const p = await fetchPaymentByContract(contractId);
      setPayment(p);
      if (p?.status === 'completed' || p?.status === 'failed') clearInterval(iv);
    }, 5000);
    return () => clearInterval(iv);
  }, [payment?.status, contractId]);

  // Retour depuis CinetPay (paramètre ?payment=done dans l'URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'done') {
      fetchPaymentByContract(contractId).then(p => setPayment(p));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [contractId]);

  async function handlePay() {
    setPaying(true);
    try {
      const url = await initiateContractPayment(contractId);
      window.location.href = url;
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Erreur paiement';
      // Échec réseau pur (souvent : Edge Function non déployée / injoignable)
      const friendly = /failed to fetch|networkerror|load failed|fetch/i.test(raw)
        ? 'Service de paiement indisponible pour le moment. Réessayez plus tard.'
        : raw;
      toast.error(friendly);
      setPaying(false);
    }
  }

  if (loading) return null;

  // Freelance : affichage statut uniquement
  if (myRole === 'freelance') {
    if (!payment) return (
      <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2" style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}>
        <Hourglass size={15} /> En attente du paiement de l'organisateur
      </div>
    );
    const ui = STATUS_UI[payment.status] || STATUS_UI.pending;
    const { net } = breakdown(payment);
    const paidOut = payment.payout_status === 'paid';
    return (
      <div className="space-y-2">
        <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2"
          style={{ background: `${ui.color}12`, border: `1px solid ${ui.color}40`, color: ui.color }}>
          <ui.Icon size={15} /> Paiement {ui.label}
        </div>
        {payment.status === 'completed' && (
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
        )}
      </div>
    );
  }

  // Organisateur
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
          {paying ? 'Redirection...' : <><RotateCw size={16} /> Réessayer — {formatCFA(amount)}</>}
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
        ? <><Loader2 size={16} className="animate-spin" /> Redirection vers CinetPay...</>
        : <><CreditCard size={16} /> Payer {formatCFA(amount)} via CinetPay</>}
    </button>
  );
}
