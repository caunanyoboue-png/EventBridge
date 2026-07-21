import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Mission, type MissionStatus } from '../types';
import { formatDateShort } from '../lib/utils';
import { formatRateLabel } from '../lib/missionPricing';
import { ServiceIcon } from '../lib/serviceIcons';
import { IcoClipboard } from '../components/icons/DoodleIcons';
import { roleColor } from '../lib/roleTheme';
import toast from 'react-hot-toast';

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
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

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

  async function publishMission(m: Mission) {
    setActionBusy(true);
    const { error } = await supabase.from('missions').update({ status: 'open' }).eq('id', m.id);
    if (error) { toast.error(error.message || 'Erreur publication'); setActionBusy(false); return; }
    setMissions(prev => prev.map(x => x.id === m.id ? { ...x, status: 'open' as MissionStatus } : x));
    try {
      const { data: count } = await supabase.rpc('notify_matching_freelances', {
        p_mission_id:      m.id,
        p_mission_title:   m.title,
        p_hourly_rate:     m.hourly_rate,
        p_ville:           m.ville || 'Abidjan - Cocody',
        p_skills_required: (m.skills_required || []).length > 0 ? m.skills_required : null,
      });
      toast.success(`Mission publiée ! ${count ?? 0} freelance(s) notifié(s) 🎯`);
    } catch { toast.success('Mission publiée !'); }
    setActionBusy(false);
  }

  async function handleDelete(m: Mission) {
    setActionBusy(true);
    if (m.status === 'draft') {
      const { error } = await supabase.from('missions').delete().eq('id', m.id);
      if (error) toast.error(error.message || 'Erreur suppression');
      else { toast.success('Mission supprimée'); setMissions(prev => prev.filter(x => x.id !== m.id)); }
    } else {
      const { error } = await supabase.from('missions').update({ status: 'cancelled' }).eq('id', m.id);
      if (error) toast.error(error.message || 'Erreur annulation');
      else { toast.success('Mission annulée'); setMissions(prev => prev.map(x => x.id === m.id ? { ...x, status: 'cancelled' as MissionStatus } : x)); }
    }
    setConfirmId(null);
    setActionBusy(false);
  }

  const filtered = tab === 'all' ? missions : missions.filter(m => m.status === tab);

  const statusColor: Record<string, string> = {
    open: '#10b981', in_progress: '#f59e0b', completed: '#3b82f6',
    cancelled: '#ef4444', draft: 'var(--color-text-muted)', disputed: '#ef4444',
  };
  const statusLabel: Record<string, string> = {
    open: 'Ouverte', in_progress: 'En cours', completed: 'Terminée',
    cancelled: 'Annulée', draft: 'Brouillon', disputed: 'Litige',
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--color-text-primary)' }}><IcoClipboard size={28} color={roleColor(profile?.role)} /> Mes missions</h1>
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
                borderColor: tab === t.key ? 'var(--color-gold-primary)' : 'rgba(201,168,76,0.2)',
                color: tab === t.key ? 'var(--color-gold-primary)' : 'var(--color-text-secondary)',
              }}>
              {t.label} {count > 0 && <span className="ml-1 text-xs opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 card-glass">
          <p className="text-4xl mb-4">📋</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>Aucune mission dans cette catégorie</p>
          <button onClick={() => navigate('/create-mission')}
            className="btn-gold mt-4 px-6 py-2 rounded-xl text-sm font-bold text-[#261642]">
            Publier une mission
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(m => (
            <div key={m.id} className="card-glass overflow-hidden">
              {m.venue_photo_url && (
                <div
                  onClick={() => navigate(`/MissionDetail?id=${m.id}`)}
                  style={{ aspectRatio: '16/7', maxHeight: 260, overflow: 'hidden', cursor: 'pointer' }}
                >
                  <img
                    src={m.venue_photo_url}
                    alt="Photo du lieu"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              )}
              <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ServiceIcon type={m.service_type} size={26} />
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{m.title}</h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDateShort(m.event_date)}{m.nb_days && m.nb_days > 1 ? ` (+${m.nb_days - 1}j)` : ''} · {m.start_time?.substring(0,5)} - {m.end_time?.substring(0,5)} · {formatRateLabel(m.roles, m.hourly_rate)}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
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

              <div className="flex gap-3 mt-4 flex-wrap">
                <button onClick={() => navigate(`/MissionDetail?id=${m.id}`)}
                  className="btn-outline-gold px-4 py-2 rounded-lg text-sm">
                  Voir détails
                </button>
                {m.status === 'draft' && (
                  <button onClick={() => publishMission(m)} disabled={actionBusy}
                    className="btn-gold px-4 py-2 rounded-lg text-sm font-bold text-[#261642]"
                    style={{ opacity: actionBusy ? 0.7 : 1 }}>
                    🚀 Publier
                  </button>
                )}
                {(m.status === 'open' || m.status === 'draft') && (
                  <button onClick={() => navigate(`/edit-mission?id=${m.id}`)}
                    className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                    style={{ borderColor: 'rgba(201,168,76,0.3)', color: 'var(--color-gold-primary)' }}>
                    Modifier
                  </button>
                )}
                <button onClick={() => navigate('/messages')}
                  className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                  style={{ borderColor: 'rgba(201,168,76,0.2)', color: 'var(--color-text-secondary)' }}>
                  💬 Messages
                </button>
                {(m.status === 'draft' || m.status === 'open') && (
                  confirmId === m.id ? (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {m.status === 'draft' ? 'Supprimer définitivement ?' : 'Annuler cette mission ?'}
                      </span>
                      <button onClick={() => handleDelete(m)} disabled={actionBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                        style={{ borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.1)', opacity: actionBusy ? 0.6 : 1 }}>
                        {actionBusy ? '…' : 'Oui'}
                      </button>
                      <button onClick={() => setConfirmId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs border"
                        style={{ borderColor: 'rgba(201,168,76,0.3)', color: 'var(--color-text-secondary)' }}>
                        Non
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(m.id)}
                      className="px-4 py-2 rounded-lg text-sm border ml-auto transition-all hover:opacity-80"
                      style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
                      {m.status === 'draft' ? '🗑 Supprimer' : '✗ Annuler'}
                    </button>
                  )
                )}
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
