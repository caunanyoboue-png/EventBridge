import { useState } from 'react';
import { type Mission, type Profile, type Contract, type CddReason, type PaymentMethod } from '../../types';
import { formatCFA } from '../../lib/utils';
import {
  generateContractData, createContract, proposeContract,
  calcTotalGross, calcIndemnity, validateSmig, validateCddDuration,
  CDD_REASON_LABELS,
} from '../../services/contractService';
import toast from 'react-hot-toast';

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
  background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)',
  color: '#f0e6d3',
};
const label: React.CSSProperties = { fontSize: 11, color: '#b8a898', marginBottom: 5, display: 'block' };
const STEPS = ['Parties', 'Mission', 'Rémunération', 'Clauses', 'Récapitulatif'];

interface Props {
  mission: Mission;
  organizer: Profile;
  freelance: Profile;
  myRole: 'organizer' | 'freelance';
  onDone: (contract: Contract) => void;
  onCancel: () => void;
}

export default function ContractWizard({ mission, organizer, freelance, myRole, onDone, onCancel }: Props) {
  const base = generateContractData(mission, organizer, freelance);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    organizer_name:    base.organizer_name,
    organizer_address: base.organizer_address,
    organizer_rccm:    base.organizer_rccm,
    freelance_name:    base.freelance_name,
    freelance_address: base.freelance_address,
    freelance_cni:     base.freelance_cni,
    job_title:         base.job_title,
    job_description:   base.job_description,
    location:          base.location,
    start_date:        base.start_date,
    end_date:          base.end_date,
    cdd_reason:        base.cdd_reason as CddReason,
    hourly_rate:       base.hourly_rate,
    daily_hours:       base.daily_hours,
    total_days:        base.total_days,
    payment_method:    base.payment_method as PaymentMethod,
    trial_period_days: null as number | null,
    has_telework_clause: false,
    has_confidentiality_clause: false,
  });

  function upd(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  const totalGross = calcTotalGross(form.hourly_rate, form.daily_hours, form.total_days);
  const indemnity  = calcIndemnity(totalGross);
  const smig       = validateSmig(form.hourly_rate);
  const duration   = validateCddDuration(form.start_date, form.end_date);

  async function handleSubmit() {
    setSaving(true);
    try {
      const data = {
        ...base,
        ...form,
        total_gross: totalGross,
        end_of_contract_indemnity: indemnity,
        status: 'draft' as const,
        proposed_by: myRole === 'organizer' ? 'organizer' : 'freelance' as 'organizer' | 'freelance',
      };
      const contract = await createContract(data);
      await proposeContract(contract.id, myRole, myRole === 'organizer' ? organizer.id : freelance.id);
      toast.success('Contrat proposé avec succès !');
      onDone(contract);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erreur inconnue';
      toast.error(msg);
      console.error('[ContractWizard]', err);
    }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,30,0.85)', backdropFilter: 'blur(6px)', zIndex: 1000 }}>
      <div className="w-full max-w-xl card-glass p-0 overflow-hidden" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(201,168,76,0.15)' }}>
          <div>
            <h2 className="font-display font-bold text-lg" style={{ color: '#f0e6d3' }}>Contrat de mission</h2>
            <p className="text-xs mt-0.5" style={{ color: '#b8a898' }}>CDD — Code du Travail ivoirien</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'rgba(82,54,124,0.5)', color: '#b8a898' }}>✕</button>
        </div>

        {/* Stepper */}
        <div className="flex items-center px-5 py-3 gap-1" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={i <= step
                    ? { background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#261642' }
                    : { border: '1px solid rgba(201,168,76,0.25)', color: '#7a6a7a' }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-xs hidden sm:block" style={{ color: i === step ? '#c9a84c' : '#7a6a7a' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className="w-5 h-px mx-1" style={{ background: i < step ? '#c9a84c' : 'rgba(201,168,76,0.2)' }} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Étape 1 — Parties */}
          {step === 0 && (
            <>
              <p className="text-xs font-semibold" style={{ color: '#c9a84c' }}>ORGANISATEUR</p>
              <div><label style={label}>Nom / Raison sociale</label>
                <input style={inp} value={form.organizer_name} onChange={e => upd('organizer_name', e.target.value)} /></div>
              <div><label style={label}>Adresse</label>
                <input style={inp} value={form.organizer_address} onChange={e => upd('organizer_address', e.target.value)} /></div>
              <div><label style={label}>RCCM (numéro registre de commerce)</label>
                <input style={inp} value={form.organizer_rccm} onChange={e => upd('organizer_rccm', e.target.value)} /></div>

              <p className="text-xs font-semibold pt-2" style={{ color: '#c9a84c' }}>FREELANCE</p>
              <div><label style={label}>Nom complet</label>
                <input style={inp} value={form.freelance_name} onChange={e => upd('freelance_name', e.target.value)} /></div>
              <div><label style={label}>Adresse</label>
                <input style={inp} value={form.freelance_address} onChange={e => upd('freelance_address', e.target.value)} /></div>
              <div><label style={label}>N° CNI / Passeport</label>
                <input style={inp} value={form.freelance_cni} onChange={e => upd('freelance_cni', e.target.value)} /></div>
            </>
          )}

          {/* Étape 2 — Mission */}
          {step === 1 && (
            <>
              <div><label style={label}>Intitulé du poste *</label>
                <input style={inp} value={form.job_title} onChange={e => upd('job_title', e.target.value)} /></div>
              <div><label style={label}>Description des tâches *</label>
                <textarea style={{ ...inp, resize: 'none' }} rows={3}
                  value={form.job_description} onChange={e => upd('job_description', e.target.value)} /></div>
              <div><label style={label}>Lieu d'exécution *</label>
                <input style={inp} value={form.location} onChange={e => upd('location', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={label}>Date début *</label>
                  <input type="date" style={inp} value={form.start_date} onChange={e => upd('start_date', e.target.value)} /></div>
                <div><label style={label}>Date fin *</label>
                  <input type="date" style={inp} value={form.end_date} onChange={e => upd('end_date', e.target.value)} /></div>
              </div>
              {!duration.ok && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                  {duration.warning}
                </p>
              )}
              <div><label style={label}>Motif du CDD (Art. 15.6) *</label>
                <select style={inp} value={form.cdd_reason} onChange={e => upd('cdd_reason', e.target.value)}>
                  {Object.entries(CDD_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label style={label}>Période d'essai (jours) — optionnel (Art. 14.5)</label>
                <input type="number" min={0} max={30} style={inp}
                  value={form.trial_period_days ?? ''} placeholder="Laisser vide si aucune"
                  onChange={e => upd('trial_period_days', e.target.value ? Number(e.target.value) : null)} /></div>
            </>
          )}

          {/* Étape 3 — Rémunération */}
          {step === 2 && (
            <>
              <div>
                <label style={label}>Taux horaire brut (FCFA) — SMIG min. 355 FCFA/h (Art. 32.1)</label>
                <input type="number" min={355} style={{ ...inp, borderColor: smig.ok ? 'rgba(201,168,76,0.2)' : '#ef4444' }}
                  value={form.hourly_rate} onChange={e => upd('hourly_rate', Number(e.target.value))} />
                {!smig.ok && (
                  <p className="text-xs mt-1 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                    {smig.warning}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={label}>Heures/jour (max 8h — Art. 21.1)</label>
                  <input type="number" min={1} max={8} step={0.5} style={inp}
                    value={form.daily_hours} onChange={e => upd('daily_hours', Number(e.target.value))} />
                </div>
                <div>
                  <label style={label}>Nombre de jours de mission</label>
                  <input type="number" min={1} style={inp}
                    value={form.total_days} onChange={e => upd('total_days', Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label style={label}>Mode de paiement</label>
                <select style={inp} value={form.payment_method} onChange={e => upd('payment_method', e.target.value)}>
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_momo">MTN MoMo</option>
                  <option value="wave">Wave</option>
                  <option value="cash">Espèces</option>
                </select>
              </div>

              {/* Récapitulatif calcul automatique */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
                <p className="text-xs font-semibold" style={{ color: '#c9a84c' }}>Calcul automatique</p>
                <div className="flex justify-between text-xs" style={{ color: '#b8a898' }}>
                  <span>Montant brut total</span>
                  <span style={{ color: '#f0e6d3', fontWeight: 600 }}>{formatCFA(totalGross)} FCFA</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: '#b8a898' }}>
                  <span>Indemnité fin de contrat (3% — Art. 15.8)</span>
                  <span style={{ color: '#c9a84c', fontWeight: 600 }}>{formatCFA(indemnity)} FCFA</span>
                </div>
                <div className="h-px" style={{ background: 'rgba(201,168,76,0.15)' }} />
                <div className="flex justify-between text-xs font-bold">
                  <span style={{ color: '#f0e6d3' }}>Total à verser</span>
                  <span style={{ color: '#c9a84c' }}>{formatCFA(totalGross + indemnity)} FCFA</span>
                </div>
              </div>
            </>
          )}

          {/* Étape 4 — Clauses optionnelles */}
          {step === 3 && (
            <>
              <p className="text-xs" style={{ color: '#b8a898' }}>
                Les clauses légales obligatoires (Art. 3, 4, 5, 15.8, 15.9) sont automatiquement incluses dans le contrat.
                Sélectionnez les clauses supplémentaires ci-dessous :
              </p>
              {[
                { key: 'has_telework_clause', label: 'Clause de télétravail', desc: 'Ordonnance 2021-902 — Art. 16.6' },
                { key: 'has_confidentiality_clause', label: 'Clause de confidentialité', desc: 'Protection des informations commerciales et techniques' },
              ].map(({ key, label: lbl, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl transition-all"
                  style={{ background: (form as Record<string, unknown>)[key] ? 'rgba(201,168,76,0.08)' : 'rgba(82,54,124,0.3)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  <input type="checkbox" className="mt-0.5"
                    checked={(form as Record<string, unknown>)[key] as boolean}
                    onChange={e => upd(key, e.target.checked)} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#f0e6d3' }}>{lbl}</p>
                    <p className="text-xs" style={{ color: '#b8a898' }}>{desc}</p>
                  </div>
                </label>
              ))}

              <div className="rounded-xl p-4 text-xs space-y-1.5" style={{ background: 'rgba(82,54,124,0.3)', border: '1px solid rgba(201,168,76,0.1)' }}>
                <p className="font-semibold" style={{ color: '#c9a84c' }}>Clauses obligatoires incluses automatiquement :</p>
                {['Interdiction du travail forcé (Art. 3)', 'Non-discrimination (Art. 4)', 'Anti-harcèlement (Art. 5)',
                  'Rupture anticipée et indemnités (Art. 15.9)', 'Indemnité de fin de contrat 3% (Art. 15.8)',
                  'Heures supplémentaires +15%/+50% (Art. 21.5)', 'Repos hebdomadaire 24h (Art. 24.1)'].map(c => (
                  <p key={c} style={{ color: '#b8a898' }}>✓ {c}</p>
                ))}
              </div>
            </>
          )}

          {/* Étape 5 — Récapitulatif */}
          {step === 4 && (
            <>
              <div className="space-y-2 text-sm" style={{ color: '#b8a898' }}>
                {[
                  ['Organisateur', form.organizer_name],
                  ['RCCM', form.organizer_rccm || '—'],
                  ['Freelance', form.freelance_name],
                  ['CNI', form.freelance_cni || '—'],
                  ['Poste', form.job_title],
                  ['Lieu', form.location],
                  ['Du', new Date(form.start_date).toLocaleDateString('fr-CI')],
                  ['Au', new Date(form.end_date).toLocaleDateString('fr-CI')],
                  ['Motif CDD', CDD_REASON_LABELS[form.cdd_reason]],
                  ['Taux horaire', formatCFA(form.hourly_rate) + '/h'],
                  ['Durée/jour', (Math.round(form.daily_hours * 100) / 100) + 'h'],
                  ['Jours', String(form.total_days)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span style={{ color: '#f0e6d3', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
                <div className="h-px" style={{ background: 'rgba(201,168,76,0.15)' }} />
                <div className="flex justify-between font-bold">
                  <span>Montant brut</span>
                  <span style={{ color: '#c9a84c' }}>{formatCFA(totalGross)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Indemnité fin contrat (3%)</span>
                  <span style={{ color: '#c9a84c' }}>{formatCFA(indemnity)}</span>
                </div>
                {!smig.ok && (
                  <p className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                    {smig.warning}
                  </p>
                )}
                {!duration.ok && (
                  <p className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                    {duration.warning}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex gap-3" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-outline-gold flex-1 py-2.5 rounded-xl text-sm">
              ← Retour
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-bold text-[#261642]">
              Continuer →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-bold text-[#261642]"
              style={{ opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Envoi...' : '📄 Proposer ce contrat'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
