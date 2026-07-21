import { useNavigate } from 'react-router-dom';
import { User, Building2, Calendar, MapPin, Wallet } from 'lucide-react';
import { type Contract } from '../../types';
import { formatCFA } from '../../lib/utils';
import ContractStatusBadge from './ContractStatusBadge';

export default function ContractCard({ contract, myRole }: {
  contract: Contract;
  myRole: 'organizer' | 'freelance';
}) {
  const navigate  = useNavigate();
  const other     = myRole === 'organizer' ? contract.freelance : contract.organizer;
  const startDate = contract.start_date
    ? new Date(contract.start_date).toLocaleDateString('fr-CI', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  return (
    <div
      onClick={() => navigate(`/contracts/${contract.id}`)}
      className="card-glass p-5 hover:-translate-y-1 transition-all duration-200 cursor-pointer"
      style={{ borderRadius: 14 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{contract.job_title}</h3>
          <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            {myRole === 'organizer' ? <><User size={12} /> Freelance</> : <><Building2 size={12} /> Org.</>} : {other?.full_name || other?.company_name || '—'}
          </p>
        </div>
        <ContractStatusBadge status={contract.status} />
      </div>

      <div className="space-y-1 text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        <div className="flex items-center gap-2">
          <Calendar size={13} color="var(--color-text-muted)" /><span>{startDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={13} color="var(--color-text-muted)" /><span className="truncate">{contract.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Wallet size={13} color="var(--color-gold-primary)" />
          <span style={{ color: 'var(--color-gold-primary)', fontWeight: 600 }}>
            {formatCFA(contract.total_gross)} brut
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>v{contract.version}</span>
        <button
          onClick={e => { e.stopPropagation(); navigate(`/contracts/${contract.id}`); }}
          className="btn-outline-gold px-3 py-1 rounded-lg text-xs">
          Voir le contrat →
        </button>
      </div>
    </div>
  );
}
