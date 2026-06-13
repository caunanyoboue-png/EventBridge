import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import { type Mission } from '../../types';
import { Target } from 'lucide-react';
import { formatDateShort, formatCFA } from '../../lib/utils';
import { ServiceIcon } from '../../lib/serviceIcons';
import toast from 'react-hot-toast';

export default function AdminMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
    !search || m.title.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor: Record<string, string> = {
    open: '#10b981', in_progress: '#f59e0b', completed: '#3b82f6',
    cancelled: '#ef4444', draft: '#7a6a7a', disputed: '#ef4444',
  };

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: '#f0e6d3' }}><Target size={26} color="#d4af37" /> Gestion des missions</h1>

      <div className="card-glass p-4 mb-6 flex gap-3">
        <input className="px-3 py-2 rounded-lg text-sm outline-none flex-1"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        <span className="text-sm my-auto" style={{ color: '#b8a898' }}>{filtered.length} mission(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Chargement...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="card-glass p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ServiceIcon type={m.service_type} size={22} />
                <div>
                  <p className="font-medium" style={{ color: '#f0e6d3' }}>{m.title}</p>
                  <p className="text-xs" style={{ color: '#b8a898' }}>
                    {formatDateShort(m.event_date)} · {formatCFA(m.hourly_rate)}/h · {m.slots_total} poste(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 rounded-full"
                  style={{ background: `${statusColor[m.status || 'open']}20`, color: statusColor[m.status || 'open'] }}>
                  {m.status}
                </span>
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
