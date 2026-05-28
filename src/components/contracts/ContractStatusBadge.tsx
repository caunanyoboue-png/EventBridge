import { type ContractStatus } from '../../types';

const CONFIG: Record<ContractStatus, { label: string; bg: string; color: string; border: string }> = {
  draft:                  { label: 'Brouillon',       bg: 'rgba(120,120,120,0.15)', color: '#9ca3af', border: 'rgba(120,120,120,0.3)' },
  proposed_by_organizer:  { label: 'Proposé (org.)',  bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', border: 'rgba(59,130,246,0.35)' },
  proposed_by_freelance:  { label: 'Proposé (free.)', bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa', border: 'rgba(139,92,246,0.35)' },
  counter_proposed:       { label: 'Contre-proposé',  bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
  accepted_by_both:       { label: 'Accepté',         bg: 'rgba(16,185,129,0.15)',  color: '#34d399', border: 'rgba(16,185,129,0.35)' },
  rejected:               { label: 'Refusé',          bg: 'rgba(239,68,68,0.15)',   color: '#f87171', border: 'rgba(239,68,68,0.35)'  },
  signed:                 { label: '✓ Signé',         bg: 'rgba(16,185,129,0.25)',  color: '#10b981', border: 'rgba(16,185,129,0.5)'  },
  expired:                { label: 'Expiré',          bg: 'rgba(107,114,128,0.15)', color: '#6b7280', border: 'rgba(107,114,128,0.3)' },
};

export default function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const c = CONFIG[status] ?? CONFIG.draft;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      letterSpacing: '0.3px',
    }}>
      {c.label}
    </span>
  );
}
