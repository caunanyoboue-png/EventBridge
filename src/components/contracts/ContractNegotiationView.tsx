import { useState, useEffect, useCallback } from 'react';
import { type Contract, type ContractNegotiationEntry } from '../../types';
import { formatCFA } from '../../lib/utils';
import {
  fetchNegotiationHistory, acceptContract, rejectContract,
  signContract, counterPropose, CDD_REASON_LABELS,
} from '../../services/contractService';
import { generateContractPDF } from '../../services/pdfService';
import { updateContractPdfUrl } from '../../services/contractService';
import { useContractRealtime } from '../../hooks/useContractRealtime';
import ContractStatusBadge from './ContractStatusBadge';
import ContractDiffViewer from './ContractDiffViewer';
import PaymentButton from '../PaymentButton';
import toast from 'react-hot-toast';

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
  background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3',
};

interface Props {
  contract: Contract;
  myRole: 'organizer' | 'freelance';
  myId: string;
  onUpdate: (c: Contract) => void;
}

export default function ContractNegotiationView({ contract: initialContract, myRole, myId, onUpdate }: Props) {
  const [contract, setContract]   = useState<Contract>(initialContract);
  const [history, setHistory]     = useState<ContractNegotiationEntry[]>([]);
  const [busy, setBusy]           = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject]     = useState(false);
  const [showCounter, setShowCounter]   = useState(false);
  const [counterRate, setCounterRate]   = useState(contract.hourly_rate);
  const [counterDays, setCounterDays]   = useState(contract.total_days);
  const [counterMsg, setCounterMsg]     = useState('');
  const [genPdf, setGenPdf]       = useState(false);

  useEffect(() => {
    fetchNegotiationHistory(contract.id).then(h => setHistory(h as ContractNegotiationEntry[]));
  }, [contract.id]);

  const handleRealtime = useCallback((updated: Contract) => {
    setContract(updated);
    onUpdate(updated);
    toast('Contrat mis à jour en temps réel', { icon: '🔔' });
  }, [onUpdate]);

  useContractRealtime(contract.id, handleRealtime);

  const otherProposed =
    (contract.status === 'proposed_by_organizer' && myRole === 'freelance') ||
    (contract.status === 'proposed_by_freelance'  && myRole === 'organizer') ||
    (contract.status === 'counter_proposed' && contract.proposed_by !== myRole);

  const iWaited =
    (contract.status === 'proposed_by_organizer' && myRole === 'organizer') ||
    (contract.status === 'proposed_by_freelance'  && myRole === 'freelance') ||
    (contract.status === 'counter_proposed' && contract.proposed_by === myRole);

  const canSign =
    contract.status === 'accepted_by_both' &&
    !(myRole === 'organizer' ? contract.organizer_signed_at : contract.freelance_signed_at);

  async function handleAccept() {
    if (busy) return;
    setBusy(true);
    try {
      await acceptContract(contract.id, myRole, myId);
      const updated = { ...contract, status: 'accepted_by_both' as const };
      setContract(updated); onUpdate(updated);
      toast.success('Contrat accepté !');
    }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erreur inconnue';
      toast.error(msg); console.error('[handleAccept]', err);
    }
    finally { setBusy(false); }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('Le motif de refus est obligatoire'); return; }
    if (busy) return;
    setBusy(true);
    try {
      await rejectContract(contract.id, myRole, myId, rejectReason);
      const updated = { ...contract, status: 'rejected' as const, rejection_reason: rejectReason };
      setContract(updated); onUpdate(updated);
      toast.success('Contrat refusé.');
      setShowReject(false);
    }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erreur inconnue';
      toast.error(msg); console.error('[handleReject]', err);
    }
    finally { setBusy(false); }
  }

  async function handleCounter() {
    if (busy) return;
    setBusy(true);
    try {
      await counterPropose(contract.id, { hourly_rate: counterRate, total_days: counterDays }, myRole, myId, counterMsg);
      const updated = { ...contract, status: 'counter_proposed' as const, proposed_by: myRole,
        hourly_rate: counterRate, total_days: counterDays };
      setContract(updated); onUpdate(updated);
      toast.success('Contre-proposition envoyée !');
      setShowCounter(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erreur inconnue';
      toast.error(msg);
      console.error('[handleCounter]', err);
    }
    finally { setBusy(false); }
  }

  async function handleSign() {
    setBusy(true);
    try {
      await signContract(contract.id, myRole, myId);
      toast.success('Signature apposée !');
      if (contract.organizer_signed_at || contract.freelance_signed_at) {
        // Les deux ont signé → générer PDF
        setGenPdf(true);
        try {
          const url = await generateContractPDF(contract);
          await updateContractPdfUrl(contract.id, url);
          toast.success('PDF du contrat généré !');
        } catch { toast.error('Erreur génération PDF'); }
        finally { setGenPdf(false); }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erreur inconnue';
      toast.error(msg); console.error('[handleSign]', err);
    }
    finally { setBusy(false); }
  }

  const STATUS_ACTIONS = {
    'Action': !['rejected', 'signed', 'expired'].includes(contract.status),
  };

  return (
    <div className="space-y-5">
      {/* Header statut */}
      <div className="card-glass p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold" style={{ color: '#f0e6d3' }}>{contract.job_title}</h2>
          <p className="text-xs mt-1" style={{ color: '#b8a898' }}>Version {contract.version} · Contrat CDD</p>
        </div>
        <div className="flex items-center gap-3">
          <ContractStatusBadge status={contract.status} />
          {contract.pdf_url && (
            <a href={contract.pdf_url} target="_blank" rel="noreferrer"
              className="btn-outline-gold px-3 py-1.5 rounded-lg text-xs">
              📄 PDF
            </a>
          )}
        </div>
      </div>

      {/* Résumé du contrat */}
      <div className="card-glass p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#c9a84c' }}>Détails du contrat</h3>
        <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: '#b8a898' }}>
          {[
            ['Organisateur', contract.organizer_name],
            ['Freelance', contract.freelance_name],
            ['Poste', contract.job_title],
            ['Lieu', contract.location],
            ['Début', new Date(contract.start_date).toLocaleDateString('fr-CI')],
            ['Fin', new Date(contract.end_date).toLocaleDateString('fr-CI')],
            ['Motif CDD', CDD_REASON_LABELS[contract.cdd_reason] || contract.cdd_reason],
            ['Taux horaire', formatCFA(contract.hourly_rate) + '/h'],
            ['Durée/jour', contract.daily_hours + 'h'],
            ['Jours', String(contract.total_days)],
            ['Montant brut', formatCFA(contract.total_gross)],
            ['Indemnité (3%)', formatCFA(contract.end_of_contract_indemnity)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span>{k}</span><span style={{ color: '#f0e6d3' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Signatures */}
        <div className="mt-4 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid rgba(201,168,76,0.15)' }}>
          {[
            { label: 'Organisateur', signed: contract.organizer_signed_at },
            { label: 'Freelance', signed: contract.freelance_signed_at },
          ].map(({ label, signed }) => (
            <div key={label} className="text-xs px-3 py-2 rounded-lg text-center"
              style={{ background: signed ? 'rgba(16,185,129,0.1)' : 'rgba(82,54,124,0.3)', border: `1px solid ${signed ? 'rgba(16,185,129,0.3)' : 'rgba(201,168,76,0.1)'}` }}>
              <p style={{ color: signed ? '#10b981' : '#b8a898' }}>
                {signed ? `✓ Signé le ${new Date(signed).toLocaleDateString('fr-CI')}` : '⏳ En attente de signature'}
              </p>
              <p style={{ color: '#7a6a7a' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Zone d'actions */}
      {STATUS_ACTIONS['Action'] && (
        <div className="card-glass p-5 space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: '#c9a84c' }}>Actions</h3>

          {/* L'autre partie a proposé */}
          {otherProposed && !showReject && !showCounter && (
            <div className="flex gap-3 flex-wrap">
              <button onClick={handleAccept} disabled={busy}
                className="btn-gold px-5 py-2.5 rounded-xl text-sm font-bold text-[#261642]">
                ✓ Accepter
              </button>
              <button onClick={() => setShowCounter(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border"
                style={{ borderColor: '#c9a84c', color: '#c9a84c', background: 'transparent' }}>
                ✎ Contre-proposer
              </button>
              <button onClick={() => setShowReject(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border"
                style={{ borderColor: '#ef4444', color: '#ef4444', background: 'transparent' }}>
                ✗ Refuser
              </button>
            </div>
          )}

          {/* J'ai proposé — en attente */}
          {iWaited && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#c9a84c' }} />
              <p className="text-sm" style={{ color: '#b8a898' }}>En attente de réponse de l'autre partie...</p>
            </div>
          )}

          {/* Refus */}
          {showReject && (
            <div className="space-y-3">
              <label className="text-xs block" style={{ color: '#b8a898' }}>Motif de refus (obligatoire)</label>
              <textarea style={{ ...inp, resize: 'none' }} rows={3}
                placeholder="Expliquez la raison du refus..."
                value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={() => setShowReject(false)} className="btn-outline-gold flex-1 py-2 rounded-xl text-sm">Annuler</button>
                <button onClick={handleReject} disabled={busy || !rejectReason.trim()}
                  className="flex-1 py-2 rounded-xl text-sm font-bold border"
                  style={{ background: 'rgba(239,68,68,0.15)', borderColor: '#ef4444', color: '#ef4444', opacity: busy || !rejectReason.trim() ? 0.5 : 1 }}>
                  {busy ? '...' : 'Confirmer le refus'}
                </button>
              </div>
            </div>
          )}

          {/* Contre-proposition */}
          {showCounter && (
            <div className="space-y-3">
              <p className="text-xs font-semibold" style={{ color: '#c9a84c' }}>Votre contre-proposition</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#b8a898' }}>Taux horaire (FCFA/h)</label>
                  <input type="number" style={inp} value={counterRate} onChange={e => setCounterRate(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#b8a898' }}>Nombre de jours</label>
                  <input type="number" style={inp} value={counterDays} onChange={e => setCounterDays(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: '#b8a898' }}>Message (optionnel)</label>
                <textarea style={{ ...inp, resize: 'none' }} rows={2}
                  placeholder="Expliquez votre proposition..."
                  value={counterMsg} onChange={e => setCounterMsg(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowCounter(false)} className="btn-outline-gold flex-1 py-2 rounded-xl text-sm">Annuler</button>
                <button onClick={handleCounter} disabled={busy}
                  className="btn-gold flex-1 py-2 rounded-xl text-sm font-bold text-[#261642]">
                  {busy ? '...' : 'Envoyer la contre-proposition'}
                </button>
              </div>
            </div>
          )}

          {/* Signature */}
          {canSign && (
            <button onClick={handleSign} disabled={busy || genPdf}
              className="btn-gold w-full py-3 rounded-xl text-sm font-bold text-[#261642]">
              {genPdf ? '📄 Génération PDF...' : busy ? 'Signature...' : '✍ Signer électroniquement'}
            </button>
          )}
        </div>
      )}

      {/* Section paiement (contrat signé) */}
      {contract.status === 'signed' && (
        <div className="card-glass p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#c9a84c' }}>💳 Paiement</h3>
          <PaymentButton
            contractId={contract.id}
            amount={contract.total_gross + contract.end_of_contract_indemnity}
            myRole={myRole}
          />
        </div>
      )}

      {/* Historique des versions */}
      {history.length > 0 && (
        <div className="card-glass p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#c9a84c' }}>Historique des négociations</h3>
          <div className="space-y-3">
            {history.map((entry, i) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(201,168,76,0.2)', color: '#c9a84c' }}>v{entry.version}</div>
                  {i < history.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'rgba(201,168,76,0.15)' }} />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold capitalize" style={{ color: '#f0e6d3' }}>
                      {entry.actor_role === 'organizer' ? 'Organisateur' : 'Freelance'} — {entry.action.replace('_', ' ')}
                    </span>
                    <span className="text-xs" style={{ color: '#7a6a7a' }}>
                      {new Date(entry.created_at).toLocaleDateString('fr-CI')}
                    </span>
                  </div>
                  {entry.message && (
                    <p className="text-xs" style={{ color: '#b8a898' }}>"{entry.message}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diff avec version précédente */}
      {contract.version > 1 && history.length > 0 && (
        <div className="card-glass p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#c9a84c' }}>
            Modifications (v{contract.version - 1} → v{contract.version})
          </h3>
          <ContractDiffViewer
            current={contract}
            previous={history[history.length - 1]?.snapshot ?? contract}
          />
        </div>
      )}
    </div>
  );
}
