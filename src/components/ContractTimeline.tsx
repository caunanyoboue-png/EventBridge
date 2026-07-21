import { useEffect, useState, type ReactNode } from 'react';
import {
  Check, Loader2, FileText, FileSignature, CreditCard, CheckCircle2,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchPaymentByContract } from '../services/paymentService';
import { type Contract } from '../types';

type StepStatus = 'success' | 'active' | 'pending' | 'error';

// Palette EventBridge (pas de tokens shadcn).
const COL: Record<StepStatus, string> = {
  success: '#00C896',
  active: 'var(--color-gold-primary)',
  pending: 'var(--color-text-muted)',
  error: '#EF4444',
};

// Timeline de progression d'un contrat — adapté du pattern "Agent planning"
// aux couleurs premium d'EventBridge (violet nuit + or).
export default function ContractTimeline({ contract }: { contract: Contract }) {
  const [paid, setPaid] = useState(false);
  const [missionDone, setMissionDone] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchPaymentByContract(contract.id).then(p => { if (alive) setPaid(p?.status === 'completed'); });
    if (contract.mission_id) {
      supabase.from('missions').select('status').eq('id', contract.mission_id).maybeSingle()
        .then(({ data }) => { if (alive) setMissionDone(data?.status === 'completed'); });
    }
    return () => { alive = false; };
  }, [contract.id, contract.mission_id]);

  const rejected = contract.status === 'rejected' || contract.status === 'expired';

  // Nombre d'étapes franchies (le contrat existe → "proposé" est déjà fait).
  let stage = 1;
  if (['accepted_by_both', 'signed'].includes(contract.status)) stage = 2;
  if (contract.status === 'signed') stage = 3;
  if (paid) stage = 4;
  if (missionDone) stage = 5;

  const steps: { label: string; Icon: typeof Check; hint: ReactNode }[] = [
    { label: 'Contrat proposé', Icon: FileText, hint: 'Termes soumis aux deux parties' },
    { label: 'Accepté par les deux', Icon: Check, hint: 'Accord trouvé sur les conditions' },
    { label: 'Signé électroniquement', Icon: FileSignature, hint: 'Signatures organisateur + freelance' },
    { label: 'Paiement effectué', Icon: CreditCard, hint: 'Encaissé via CinetPay (escrow)' },
    { label: 'Mission terminée', Icon: CheckCircle2, hint: 'Prestation réalisée et clôturée' },
  ];

  const statusOf = (i: number): StepStatus => {
    if (rejected && i === 1) return 'error';
    if (i < stage) return 'success';
    if (i === stage) return rejected ? 'pending' : 'active';
    return 'pending';
  };

  return (
    <div className="card-glass mb-6" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', cursor: 'pointer', background: 'transparent', border: 'none',
          borderBottom: open ? '1px solid rgba(201,168,76,0.12)' : 'none',
        }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {rejected
            ? <FileText size={17} color={COL.error} />
            : stage >= 5
              ? <CheckCircle2 size={17} color={COL.success} />
              : <Loader2 size={17} color={COL.active} className="animate-spin" />}
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.01em' }}>
            Avancement du contrat
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
            {rejected ? 'arrêté' : `${stage}/5`}
          </span>
        </span>
        {open ? <ChevronDown size={17} color="var(--color-text-muted)" /> : <ChevronRight size={17} color="var(--color-text-muted)" />}
      </button>

      {/* Timeline */}
      {open && (
        <div style={{ padding: '18px 18px 6px' }}>
          {steps.map((step, i) => {
            const st = statusOf(i);
            const isLast = i === steps.length - 1;
            const color = COL[st];
            return (
              <div key={step.label} style={{ position: 'relative', display: 'flex', gap: 14, opacity: st === 'pending' ? 0.55 : 1 }}>
                {/* Ligne de liaison */}
                {!isLast && (
                  <div style={{
                    position: 'absolute', left: 13, top: 28, bottom: -6, width: 2, zIndex: 0,
                    background: i < stage ? 'rgba(0,200,150,0.4)' : 'rgba(201,168,76,0.18)',
                  }} />
                )}
                {/* Pastille icône */}
                <div style={{ position: 'relative', zIndex: 1, flexShrink: 0, width: 28, height: 28, marginTop: 2 }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${color}22`, border: `1px solid ${color}66`,
                    color, boxShadow: st === 'active' ? `0 0 0 4px ${color}1a` : 'none',
                  }}>
                    {st === 'success'
                      ? <Check size={14} />
                      : st === 'active'
                        ? <Loader2 size={14} className="animate-spin" />
                        : st === 'error'
                          ? <step.Icon size={14} />
                          : <step.Icon size={14} />}
                  </div>
                </div>
                {/* Contenu */}
                <div style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13.5, fontWeight: st === 'active' || st === 'error' ? 700 : 500,
                    color: st === 'error' ? COL.error : st === 'pending' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                  }}>
                    {step.label}
                    {st === 'active' && !rejected && <span style={{ color: COL.active, fontWeight: 600 }}> · en cours</span>}
                    {st === 'error' && <span style={{ fontWeight: 600 }}> · refusé</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{step.hint}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
