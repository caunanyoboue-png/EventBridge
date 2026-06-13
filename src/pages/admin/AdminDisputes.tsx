import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import { Scale } from 'lucide-react';
import { formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Dispute {
  id: string;
  mission_id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string;
  status: string;
  resolution: string | null;
  created_at: string;
  mission?: { title: string };
  reporter?: { full_name: string; email: string };
  reported?: { full_name: string; email: string };
}

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');
  const [filterStatus, setFilterStatus] = useState('open');

  useEffect(() => { fetchDisputes(); }, []);

  async function fetchDisputes() {
    const { data } = await supabase.from('disputes')
      .select(`*, mission:missions(title), reporter:profiles!reporter_id(full_name,email), reported:profiles!reported_id(full_name,email)`)
      .order('created_at', { ascending: false });
    setDisputes((data || []) as Dispute[]);
    setLoading(false);
  }

  async function resolve(id: string, status: 'resolved' | 'closed') {
    if (!resolution.trim()) return toast.error('Entrez une résolution');
    const { error } = await supabase.from('disputes').update({ status, resolution }).eq('id', id);
    if (error) toast.error('Erreur');
    else { toast.success('Litige traité'); setSelected(null); setResolution(''); fetchDisputes(); }
  }

  const filtered = disputes.filter(d => !filterStatus || d.status === filterStatus);

  const statusColor: Record<string, string> = {
    open: '#ef4444', investigating: '#f59e0b', resolved: '#10b981', closed: '#7a6a7a',
  };
  const statusLabel: Record<string, string> = {
    open: 'Ouvert', investigating: 'En cours', resolved: 'Résolu', closed: 'Fermé',
  };

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: '#f0e6d3' }}><Scale size={26} color="#d4af37" /> Gestion des litiges</h1>

      <div className="card-glass p-4 mb-6 flex flex-wrap gap-3">
        {(['open', 'investigating', 'resolved', 'closed', ''] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s as string)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={filterStatus === s
              ? { background: 'rgba(201,168,76,0.2)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.4)' }
              : { background: 'rgba(82,54,124,0.4)', color: '#7a6a7a', border: '1px solid rgba(201,168,76,0.1)' }}>
            {s === '' ? 'Tous' : statusLabel[s]}
          </button>
        ))}
        <span className="text-sm my-auto ml-auto" style={{ color: '#b8a898' }}>{filtered.length} litige(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Aucun litige</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <div key={d.id} className="card-glass p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${statusColor[d.status]}20`, color: statusColor[d.status] }}>
                      {statusLabel[d.status] || d.status}
                    </span>
                    <span className="text-xs" style={{ color: '#7a6a7a' }}>{formatRelative(d.created_at)}</span>
                  </div>
                  <p className="font-medium mb-1" style={{ color: '#f0e6d3' }}>Mission : {d.mission?.title || d.mission_id}</p>
                  <p className="text-sm mb-1" style={{ color: '#b8a898' }}>
                    Plaignant : <span style={{ color: '#f0e6d3' }}>{d.reporter?.full_name || '–'}</span>
                    {' · '}
                    Accusé : <span style={{ color: '#f0e6d3' }}>{d.reported?.full_name || '–'}</span>
                  </p>
                  <p className="text-sm" style={{ color: '#b8a898' }}>Motif : {d.reason}</p>
                  {d.description && <p className="text-xs mt-1" style={{ color: '#7a6a7a' }}>{d.description}</p>}
                  {d.resolution && (
                    <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <p className="text-xs" style={{ color: '#10b981' }}>Résolution : {d.resolution}</p>
                    </div>
                  )}
                </div>
                {d.status === 'open' && (
                  <button onClick={() => { setSelected(d); setResolution(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs shrink-0"
                    style={{ background: 'rgba(201,168,76,0.15)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.2)' }}>
                    Traiter
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal résolution */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelected(null)}>
          <div className="card-glass p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4" style={{ color: '#f0e6d3' }}>Résoudre le litige</h3>
            <p className="text-sm mb-4" style={{ color: '#b8a898' }}>
              Mission : {selected.mission?.title}<br />
              Entre {selected.reporter?.full_name} et {selected.reported?.full_name}
            </p>
            <textarea
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
              style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3', resize: 'none' }}
              rows={4} placeholder="Décision de l'admin..."
              value={resolution} onChange={e => setResolution(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => resolve(selected.id, 'resolved')}
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#d4af37,#e8c97a)', color: '#261642' }}>
                Résoudre
              </button>
              <button onClick={() => resolve(selected.id, 'closed')}
                className="flex-1 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
