import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getOrCreateConversation } from '../lib/messaging';
import { type Application, type Mission, type ApplicationStatus } from '../types';
import { formatDateShort, formatCFA } from '../lib/utils';
import { ServiceIcon } from '../lib/serviceIcons';
import { Mail, Inbox, Hourglass, CheckCircle2, XCircle, Undo2, MessageCircle, AlertTriangle, X, type LucideIcon } from 'lucide-react';
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
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);

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
    setWithdrawBusy(true);
    const app = applications.find(a => a.id === id);
    const { error } = await supabase.from('applications').update({ status: 'withdrawn' }).eq('id', id);
    if (error) { toast.error(error.message || 'Erreur'); setWithdrawBusy(false); return; }
    toast.success('Candidature annulée');
    setConfirmId(null);
    if (app) {
      const m = app.mission as Mission & { organisateur_id?: string };
      const orgId = m?.organisateur_id || (m as Mission & { organisateur?: { id: string } })?.organisateur?.id;
      if (orgId) {
        try {
          await supabase.from('notifications').insert({
            user_id: orgId,
            type: 'application_withdrawn',
            title: 'Candidature annulée',
            body: `${profile!.full_name} a annulé sa candidature pour "${m?.title}"`,
            data: { mission_id: m?.id, application_id: id },
            is_read: false,
          });
        } catch { /* notification failure must never block */ }
      }
    }
    setWithdrawBusy(false);
    fetchApplications();
  }

  const filtered = tab === 'all' ? applications : applications.filter(a => a.status === tab);

  const statusInfo: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
    pending:   { label: 'En attente', color: '#F59E0B', Icon: Hourglass },
    accepted:  { label: 'Acceptée',   color: '#00C896', Icon: CheckCircle2 },
    rejected:  { label: 'Refusée',    color: '#EF4444', Icon: XCircle },
    withdrawn: { label: 'Retirée',    color: '#A0A0B8', Icon: Undo2 },
  };

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: '#f0e6d3' }}><Mail size={26} color="#d4af37" /> Mes candidatures</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map(t => {
          const count = t.key === 'all' ? applications.length : applications.filter(a => a.status === t.key).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border"
              style={{
                background: tab === t.key ? 'rgba(201,168,76,0.15)' : 'transparent',
                borderColor: tab === t.key ? '#d4af37' : 'rgba(201,168,76,0.2)',
                color: tab === t.key ? '#d4af37' : '#b8a898',
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
          <div className="flex justify-center mb-4"><Inbox size={40} color="#7a6a8a" strokeWidth={1.5} /></div>
          <p style={{ color: '#b8a898' }}>Aucune candidature ici</p>
          <button onClick={() => navigate('/missions')}
            className="btn-gold mt-4 px-6 py-2 rounded-xl text-sm font-bold text-[#261642]">
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
              <div key={a.id} className="card-glass p-5" style={{ borderLeft: `3px solid ${info.color}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <ServiceIcon type={m?.service_type} size={26} />
                    <div>
                      <h3 className="font-semibold" style={{ color: '#f0e6d3' }}>{m?.title}</h3>
                      <p className="text-sm" style={{ color: '#A0A0B8' }}>
                        {m?.event_date ? formatDateShort(m.event_date) : ''} · {m?.hourly_rate ? formatCFA(m.hourly_rate) : ''}/h
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: info.color }}>
                    <info.Icon size={15} /> {info.label}
                  </span>
                </div>

                <p className="text-xs mb-4" style={{ color: '#b8a898' }}>
                  Postulée le {a.applied_at ? new Date(a.applied_at).toLocaleDateString('fr-CI') : '–'}
                </p>

                <div className="flex gap-3 flex-wrap items-center">
                  <button onClick={() => navigate(`/MissionDetail?id=${m?.id}`)}
                    className="btn-outline-gold px-4 py-2 rounded-lg text-sm">
                    Voir la mission
                  </button>
                  {orgId && (
                    <button onClick={() => navigate(`/public-profile?id=${orgId}`)}
                      className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                      style={{ borderColor: 'rgba(201,168,76,0.25)', color: '#d4af37' }}>
                      Voir l'organisateur
                    </button>
                  )}
                  {orgId && (
                    <button onClick={() => contacterOrg(orgId)}
                      className="btn-gold px-4 py-2 rounded-lg text-sm font-bold text-[#261642] inline-flex items-center gap-2">
                      <MessageCircle size={15} /> Contacter
                    </button>
                  )}

                  {(a.status === 'pending' || a.status === 'accepted') && (
                    confirmId === a.id ? (
                      <div className="flex items-center gap-2 ml-auto">
                        {a.status === 'accepted' && (
                          <span className="text-xs font-medium inline-flex items-center gap-1.5" style={{ color: '#F59E0B' }}>
                            <AlertTriangle size={13} /> Candidature acceptée — confirmer l'annulation ?
                          </span>
                        )}
                        {a.status === 'pending' && (
                          <span className="text-xs" style={{ color: '#b8a898' }}>
                            Annuler cette candidature ?
                          </span>
                        )}
                        <button onClick={() => retirer(a.id)} disabled={withdrawBusy}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                          style={{ borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.1)', opacity: withdrawBusy ? 0.6 : 1 }}>
                          {withdrawBusy ? '…' : 'Oui, annuler'}
                        </button>
                        <button onClick={() => setConfirmId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs border"
                          style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#b8a898' }}>
                          Non
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmId(a.id)}
                        className="px-4 py-2 rounded-lg text-sm border ml-auto transition-all hover:opacity-80 inline-flex items-center gap-1.5"
                        style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
                        <X size={14} /> Annuler
                      </button>
                    )
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
