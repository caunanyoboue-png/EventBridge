import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import { type Mission } from '../../types';
import { Target, Eye } from 'lucide-react';
import { formatDateShort, formatCFA } from '../../lib/utils';
import { ServiceIcon } from '../../lib/serviceIcons';
import toast from 'react-hot-toast';

const statusColor: Record<string, string> = {
  open: '#10b981', in_progress: '#f59e0b', completed: '#3b82f6',
  cancelled: '#ef4444', draft: '#7a6a7a', disputed: '#ef4444',
};
const statusLabel: Record<string, string> = {
  open: 'Ouverte', in_progress: 'En cours', completed: 'Terminée',
  cancelled: 'Annulée', draft: 'Brouillon', disputed: 'En litige',
};

export default function AdminMissions() {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { fetchMissions(); }, []);

  async function fetchMissions() {
    const { data } = await supabase.from('missions').select('*').order('created_at', { ascending: false });
    setMissions(data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('missions').update({ status }).eq('id', id);
    if (error) toast.error('Erreur');
    else { toast.success('Statut mis à jour'); fetchMissions(); }
  }

  const filtered = missions.filter(m =>
    (!search || m.title.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || (m.status || 'open') === filterStatus)
  );

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: '#f0e6d3' }}><Target size={26} color="#d4af37" /> Gestion des missions</h1>

      <div className="card-glass p-4 mb-6 flex flex-wrap gap-3 items-center">
        <input className="px-3 py-2 rounded-lg text-sm outline-none flex-1 min-w-40"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          placeholder="Rechercher une mission..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm my-auto" style={{ color: '#b8a898' }}>{filtered.length} mission(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Aucune mission</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="card-glass p-5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <ServiceIcon type={m.service_type} size={22} />
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ color: '#f0e6d3' }}>{m.title}</p>
                  <p className="text-xs" style={{ color: '#b8a898' }}>
                    {formatDateShort(m.event_date)} · {formatCFA(m.hourly_rate)}/h · {m.slots_total} poste(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full"
                  style={{ background: `${statusColor[m.status || 'open']}20`, color: statusColor[m.status || 'open'] }}>
                  {statusLabel[m.status || 'open'] || m.status}
                </span>
                <button onClick={() => navigate(`/MissionDetail?id=${m.id}`)}
                  className="px-3 py-1 rounded-lg text-xs inline-flex items-center gap-1"
                  style={{ background: 'rgba(201,168,76,0.15)', color: '#d4af37' }}>
                  <Eye size={13} /> Voir
                </button>
                {m.status === 'open' && (
                  <button onClick={() => updateStatus(m.id, 'cancelled')}
                    className="px-3 py-1 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                    Annuler
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
