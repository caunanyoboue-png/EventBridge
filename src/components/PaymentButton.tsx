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
  cancelled:  { label: 'Annulé',     color: '#7a6a7a', Icon: Undo2 },
};

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
      const msg = err instanceof Error ? err.message : 'Erreur paiement';
      toast.error(msg);
      setPaying(false);
    }
  }

  if (loading) return null;

  // Freelance : affichage statut uniquement
  if (myRole === 'freelance') {
    if (!payment) return (
      <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2" style={{ background: 'rgba(82,54,124,0.3)', color: '#b8a898' }}>
        <Hourglass size={15} /> En attente du paiement de l'organisateur
      </div>
    );
    const ui = STATUS_UI[payment.status] || STATUS_UI.pending;
    return (
      <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2"
        style={{ background: `${ui.color}12`, border: `1px solid ${ui.color}40`, color: ui.color }}>
        <ui.Icon size={15} /> Paiement {ui.label} — {formatCFA(payment.amount)}
        {payment.paid_at && (
          <span className="block text-xs mt-1" style={{ color: '#b8a898' }}>
            le {new Date(payment.paid_at).toLocaleDateString('fr-CI')}
          </span>
        )}
      </div>
    );
  }

  // Organisateur
  if (payment?.status === 'completed') {
    return (
      <div className="px-4 py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2"
        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
        <CheckCircle2 size={16} /> Paiement effectué — {formatCFA(payment.amount)}
        {payment.paid_at && (
          <span className="block text-xs mt-1" style={{ color: '#b8a898' }}>
            le {new Date(payment.paid_at).toLocaleDateString('fr-CI')}
          </span>
        )}
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
          style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#b8a898' }}>
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
