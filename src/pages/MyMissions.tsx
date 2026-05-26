import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Mission, type MissionStatus } from '../types';
import { formatDateShort, formatCFA, SERVICE_ICONS } from '../lib/utils';

const TABS: { key: MissionStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'open', label: 'Ouvertes' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'completed', label: 'Terminées' },
  { key: 'cancelled', label: 'Annulées' },
];

export default function MyMissions() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [tab, setTab] = useState<MissionStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchMissions();
  }, [profile]);

  async function fetchMissions() {
    const { data } = await supabase.from('missions')
      .select('*').eq('organisateur_id', profile!.id)
      .order('created_at', { ascending: false });
    setMissions(data || []);
    setLoading(false);
  }

  const filtered = tab === 'all' ? missions : missions.filter(m => m.status === tab);

  const statusColor: Record<string, string> = {
    open: '#10b981', in_progress: '#f59e0b', completed: '#3b82f6',
    cancelled: '#ef4444', draft: '#7a6a7a', disputed: '#ef4444',
  };
  const statusLabel: Record<string, string> = {
    open: 'Ouverte', in_progress: 'En cours', completed: 'Terminée',
    cancelled: 'Annulée', draft: 'Brouillon', disputed: 'Litige',
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold" style={{ color: '#f0e6d3' }}>📋 Mes missions</h1>
        <button onClick={() => navigate('/create-mission')} className="btn-gold px-5 py-2 rounded-xl text-sm font-bold text-[#261642]">
          + Nouvelle mission
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map(t => {
          const count = t.key === 'all' ? missions.length : missions.filter(m => m.status === t.key).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border"
              style={{
                background: tab === t.key ? 'rgba(201,168,76,0.15)' : 'transparent',
                borderColor: tab === t.key ? '#c9a84c' : 'rgba(201,168,76,0.2)',
                color: tab === t.key ? '#c9a84c' : '#b8a898',
              }}>
              {t.label} {count > 0 && <span className="ml-1 text-xs opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 card-glass">
          <p className="text-4xl mb-4">📋</p>
          <p style={{ color: '#b8a898' }}>Aucune mission dans cette catégorie</p>
          <button onClick={() => navigate('/create-mission')}
            className="btn-gold mt-4 px-6 py-2 rounded-xl text-sm font-bold text-[#261642]">
            Publier une mission
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(m => (
            <div key={m.id} className="card-glass p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{SERVICE_ICONS[m.service_type] || '🎯'}</span>
                  <div>
                    <h3 className="font-semibold" style={{ color: '#f0e6d3' }}>{m.title}</h3>
                    <p className="text-sm" style={{ color: '#b8a898' }}>
                      {formatDateShort(m.event_date)} · {m.start_time?.substring(0,5)} - {m.end_time?.substring(0,5)} · {formatCFA(m.hourly_rate)}/h
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#b8a898' }}>
                      👥 {m.slots_filled || 0}/{m.slots_total} poste(s) · 📍 {m.ville}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{
                    background: `${statusColor[m.status || 'open']}15`,
                    color: statusColor[m.status || 'open'],
                    border: `1px solid ${statusColor[m.status || 'open']}40`,
                  }}>
                  {statusLabel[m.status || 'open']}
                </span>
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={() => navigate(`/MissionDetail?id=${m.id}`)}
                  className="btn-outline-gold px-4 py-2 rounded-lg text-sm">
                  Voir détails
                </button>
                {(m.status === 'open' || m.status === 'draft') && (
                  <button onClick={() => navigate(`/edit-mission?id=${m.id}`)}
                    className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                    style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#c9a84c' }}>
                    Modifier
                  </button>
                )}
                <button onClick={() => navigate('/messages')}
                  className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                  style={{ borderColor: 'rgba(201,168,76,0.2)', color: '#b8a898' }}>
                  💬 Messages
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
