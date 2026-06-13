import { type Contract } from '../../types';
import { formatCFA } from '../../lib/utils';

const DIFF_FIELDS: Array<{ key: keyof Contract; label: string; format?: (v: unknown) => string }> = [
  { key: 'job_title',       label: 'Intitulé du poste' },
  { key: 'location',        label: 'Lieu' },
  { key: 'start_date',      label: 'Date début', format: v => new Date(v as string).toLocaleDateString('fr-CI') },
  { key: 'end_date',        label: 'Date fin',   format: v => new Date(v as string).toLocaleDateString('fr-CI') },
  { key: 'hourly_rate',     label: 'Taux horaire', format: v => formatCFA(v as number) + '/h' },
  { key: 'daily_hours',     label: 'Heures/jour', format: v => `${v}h` },
  { key: 'total_days',      label: 'Nombre de jours', format: v => `${v} jour(s)` },
  { key: 'total_gross',     label: 'Montant brut total', format: v => formatCFA(v as number) },
  { key: 'cdd_reason',      label: 'Motif CDD' },
  { key: 'trial_period_days', label: 'Période d\'essai', format: v => v ? `${v} jour(s)` : 'Aucune' },
  { key: 'has_telework_clause',      label: 'Télétravail',      format: v => v ? 'Oui' : 'Non' },
  { key: 'has_confidentiality_clause', label: 'Confidentialité', format: v => v ? 'Oui' : 'Non' },
];

export default function ContractDiffViewer({
  current, previous,
}: { current: Contract; previous: Contract }) {
  const diffs = DIFF_FIELDS.filter(({ key }) => {
    return String(current[key]) !== String(previous[key]);
  });

  if (diffs.length === 0) {
    return (
      <p className="text-xs text-center py-4" style={{ color: '#b8a898' }}>
        Aucune modification détectée par rapport à la version précédente.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold mb-3" style={{ color: '#b8a898' }}>
        {diffs.length} champ(s) modifié(s) par rapport à la version précédente :
      </p>
      {diffs.map(({ key, label, format }) => {
        const oldVal = format ? format(previous[key]) : String(previous[key] ?? '—');
        const newVal = format ? format(current[key])  : String(current[key]  ?? '—');
        return (
          <div key={key} className="rounded-lg p-3"
            style={{ background: 'rgba(82,54,124,0.3)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#d4af37' }}>{label}</p>
            <div className="flex gap-3 text-xs">
              <div className="flex-1 rounded px-2 py-1" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                <span style={{ opacity: 0.7 }}>Avant : </span>{oldVal}
              </div>
              <div className="flex-1 rounded px-2 py-1" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399' }}>
                <span style={{ opacity: 0.7 }}>Après : </span>{newVal}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
