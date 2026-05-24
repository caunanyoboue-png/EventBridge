import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Mission, type Profile } from '../types';
import { formatDate, formatCFA, SERVICE_ICONS } from '../lib/utils';
import toast from 'react-hot-toast';

export default function MissionDetail() {
  const [params] = useSearchParams();
  const missionId = params.get('id');
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [mission, setMission] = useState<Mission & { organisateur?: Profile } | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useEffect(() => {
    if (missionId) fetchMission();
  }, [missionId]);

  async function fetchMission() {
    const { data } = await supabase.from('missions')
      .select('*, organisateur:profiles!organisateur_id(*)')
      .eq('id', missionId!).single();
    setMission(data);
    if (profile && data) {
      const { data: app } = await supabase.from('applications')
        .select('id').eq('mission_id', missionId!).eq('freelance_id', profile.id).single();
      setAlreadyApplied(!!app);
    }
    setLoading(false);
  }

  async function postuler() {
    if (!profile || !mission) return;
    setApplying(true);
    const { error } = await supabase.from('applications').insert({
      mission_id: mission.id, freelance_id: profile.id, status: 'pending',
    });
    if (error) toast.error(error.code === '23505' ? 'Déjà postulé' : 'Erreur');
    else { toast.success('Candidature envoyée !'); setAlreadyApplied(true); }
    setApplying(false);
  }

  if (loading) return <DashboardLayout><div className="text-center py-20" style={{ color: '#b8a898' }}>Chargement...</div></DashboardLayout>;
  if (!mission) return <DashboardLayout><div className="text-center py-20" style={{ color: '#b8a898' }}>Mission introuvable</div></DashboardLayout>;

  const org = mission.organisateur as Profile | undefined;
  const slots_filled = mission.slots_filled || 0;
  const totalAmount = mission.hourly_rate * Number(mission.duration_hours || 0);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} style={{ color: '#b8a898' }}>← Retour</button>
          <span className="text-2xl">{SERVICE_ICONS[mission.service_type] || '🎯'}</span>
          <h1 className="font-display text-2xl font-bold flex-1" style={{ color: '#f0e6d3' }}>{mission.title}</h1>
          {mission.is_urgent && <span className="badge-urgent px-3 py-1 rounded-full text-sm font-bold">⚡ URGENT</span>}
        </div>

        <div className="card-glass p-8 mb-6">
          {/* Infos principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
            <div className="flex items-center gap-2" style={{ color: '#b8a898' }}>
              <span>📅</span><span>{formatDate(mission.event_date)}</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: '#b8a898' }}>
              <span>⏰</span><span>{mission.start_time?.substring(0,5)} – {mission.end_time?.substring(0,5)}</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: '#b8a898' }}>
              <span>📍</span><span>{mission.location}{mission.ville ? `, ${mission.ville}` : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>💰</span>
              <span className="font-bold" style={{ color: '#c9a84c' }}>{formatCFA(mission.hourly_rate)}/h · Total: {formatCFA(totalAmount)}</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: '#b8a898' }}>
              <span>👥</span>
              <span>{slots_filled}/{mission.slots_total} poste(s) confirmé(s)</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="w-full h-2 rounded-full" style={{ background: '#3d2460' }}>
              <div className="h-full rounded-full" style={{ width: `${(slots_filled / mission.slots_total) * 100}%`, background: 'linear-gradient(to right,#c9a84c,#e8c97a)' }} />
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2" style={{ color: '#f0e6d3' }}>Description</h3>
            <p className="text-sm leading-relaxed" style={{ color: '#b8a898' }}>{mission.description}</p>
          </div>

          {/* Compétences */}
          {(mission.skills_required || []).length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2" style={{ color: '#f0e6d3' }}>Compétences requises</h3>
              <div className="flex flex-wrap gap-2">
                {(mission.skills_required || []).map(s => (
                  <span key={s} className="px-3 py-1 rounded-full text-xs"
                    style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dress code */}
          {mission.dress_code && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2" style={{ color: '#f0e6d3' }}>Dress code</h3>
              <p className="text-sm" style={{ color: '#b8a898' }}>👔 {mission.dress_code}</p>
            </div>
          )}

          {/* Organisateur */}
          {org && (
            <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(61,36,96,0.4)', border: '1px solid rgba(201,168,76,0.1)' }}>
              <h3 className="font-semibold mb-3" style={{ color: '#f0e6d3' }}>Organisateur</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#1a0a2e' }}>
                  {org.full_name?.[0]}
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#f0e6d3' }}>{org.company_name || org.full_name}</p>
                  <p className="text-xs" style={{ color: '#b8a898' }}>
                    ⭐ {org.avg_rating || '–'} · {org.total_missions || 0} mission(s)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {profile?.role === 'freelance' && (
            <div className="flex gap-3">
              <button onClick={postuler} disabled={applying || alreadyApplied}
                className="btn-gold flex-1 py-3 rounded-xl font-bold text-[#1a0a2e]">
                {alreadyApplied ? '✅ Candidature envoyée' : applying ? 'Envoi...' : 'Postuler à cette mission'}
              </button>
              <button onClick={() => navigate('/messages')}
                className="btn-outline-gold px-5 py-3 rounded-xl font-medium">
                💬 Contacter
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
