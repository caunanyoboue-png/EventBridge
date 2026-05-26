import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getOrCreateConversation } from '../lib/messaging';
import { type Application, type Mission, type ApplicationStatus } from '../types';
import { formatDateShort, formatCFA, SERVICE_ICONS } from '../lib/utils';
import toast from 'react-hot-toast';

const TABS: { key: ApplicationStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'accepted', label: 'Acceptées' },
  { key: 'rejected', label: 'Refusées' },
  { key: 'withdrawn', label: 'Retirées' },
];

export default function MyApplications() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [tab, setTab] = useState<ApplicationStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (profile) fetchApplications(); }, [profile]);

  async function fetchApplications() {
    const { data } = await supabase.from('applications')
      .select('*, mission:missions(*, organisateur:profiles!organisateur_id(id, full_name, avatar_url))')
      .eq('freelance_id', profile!.id)
      .order('applied_at', { ascending: false });
    setApplications(data || []);
    setLoading(false);
  }

  async function contacterOrg(orgId: string) {
    if (!profile) return;
    try {
      const convId = await getOrCreateConversation(profile.id, orgId);
      navigate(`/messages?conv=${convId}`);
    } catch {
      toast.error("Impossible de contacter l'organisateur");
    }
  }

  async function retirer(id: string) {
    const { error } = await supabase.from('applications').update({ status: 'withdrawn' }).eq('id', id);
    if (error) toast.error('Erreur');
    else { toast.success('Candidature retirée'); fetchApplications(); }
  }

  const filtered = tab === 'all' ? applications : applications.filter(a => a.status === tab);

  const statusInfo: Record<string, { label: string; color: string }> = {
    pending: { label: '⏳ En attente', color: '#f59e0b' },
    accepted: { label: '✅ Acceptée !', color: '#10b981' },
    rejected: { label: '❌ Refusée', color: '#ef4444' },
    withdrawn: { label: '↩️ Retirée', color: '#7a6a7a' },
  };

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6" style={{ color: '#f0e6d3' }}>📩 Mes candidatures</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map(t => {
          const count = t.key === 'all' ? applications.length : applications.filter(a => a.status === t.key).length;
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
          <p className="text-4xl mb-4">📩</p>
          <p style={{ color: '#b8a898' }}>Aucune candidature ici</p>
          <button onClick={() => navigate('/missions')}
            className="btn-gold mt-4 px-6 py-2 rounded-xl text-sm font-bold text-[#1a0a2e]">
            Voir les missions
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(a => {
            const m = a.mission as Mission & { organisateur?: { id: string } };
            const info = statusInfo[a.status] || statusInfo.pending;
            const orgId = m?.organisateur?.id;
            return (
              <div key={a.id} className="card-glass p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{SERVICE_ICONS[m?.service_type] || '🎯'}</span>
                    <div>
                      <h3 className="font-semibold" style={{ color: '#f0e6d3' }}>{m?.title}</h3>
                      <p className="text-sm" style={{ color: '#b8a898' }}>
                        {m?.event_date ? formatDateShort(m.event_date) : ''} · {m?.hourly_rate ? formatCFA(m.hourly_rate) : ''}/h
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: info.color }}>{info.label}</span>
                </div>

                <p className="text-xs mb-4" style={{ color: '#b8a898' }}>
                  Postulée le {a.applied_at ? new Date(a.applied_at).toLocaleDateString('fr-CI') : '–'}
                </p>

                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => navigate(`/MissionDetail?id=${m?.id}`)}
                    className="btn-outline-gold px-4 py-2 rounded-lg text-sm">
                    Voir la mission
                  </button>
                  {orgId && (
                    <button onClick={() => navigate(`/public-profile?id=${orgId}`)}
                      className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                      style={{ borderColor: 'rgba(201,168,76,0.25)', color: '#c9a84c' }}>
                      Voir l'organisateur
                    </button>
                  )}
                  {orgId && (
                    <button onClick={() => contacterOrg(orgId)}
                      className="btn-gold px-4 py-2 rounded-lg text-sm font-bold text-[#1a0a2e]">
                      💬 Contacter
                    </button>
                  )}
                  {a.status === 'pending' && (
                    <button onClick={() => retirer(a.id)}
                      className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                      style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
