import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getOrCreateConversation } from '../lib/messaging';
import { type Mission, type Profile, type Contract } from '../types';
import { formatDate, formatCFA, SERVICE_ICONS } from '../lib/utils';
import { distanceKm, formatDistance } from '../lib/geo';
import MapView from '../components/MapView';
import { fetchContractByMission } from '../services/contractService';
import ContractWizard from '../components/contracts/ContractWizard';
import ContractCard from '../components/contracts/ContractCard';
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
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [acceptedFreelances, setAcceptedFreelances] = useState<Profile[]>([]);
  const [selectedFreelance, setSelectedFreelance] = useState<Profile | null>(null);

  useEffect(() => {
    if (missionId) fetchMission();
  }, [missionId]);

  useEffect(() => {
    if (!missionId || !profile) return;
    fetchContractByMission(missionId).then(c => setContract(c));
    if (profile.role === 'organisateur') {
      supabase
        .from('applications')
        .select('freelance:profiles!freelance_id(*)')
        .eq('mission_id', missionId)
        .eq('status', 'accepted')
        .then(({ data }) => {
          setAcceptedFreelances((data || []).map(a => (a.freelance as unknown) as Profile));
        });
    }
  }, [missionId, profile]);

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

  async function contacter() {
    if (!profile || !mission?.organisateur_id) return;
    setContacting(true);
    try {
      const convId = await getOrCreateConversation(profile.id, mission.organisateur_id);
      navigate(`/messages?conv=${convId}`);
    } catch {
      toast.error('Impossible de contacter cet organisateur');
      setContacting(false);
    }
  }

  async function postuler() {
    if (!profile || !mission) return;

    const required = mission.skills_required || [];
    if (required.length > 0) {
      const mySkills: string[] = (profile as Profile & { skills?: string[] }).skills || [];
      const hasMatch = mySkills.some(s => required.includes(s));
      if (!hasMatch) {
        toast.error(`Ce poste requiert : ${required.join(', ')}. Vos compétences ne correspondent pas.`);
        return;
      }
    }

    setApplying(true);
    const { error } = await supabase.from('applications').insert({
      mission_id: mission.id, freelance_id: profile.id, status: 'pending',
    });
    if (error) {
      toast.error(error.code === '23505' ? 'Déjà postulé' : error.message || 'Erreur');
    } else {
      toast.success('Candidature envoyée !');
      setAlreadyApplied(true);
      try {
        await supabase.from('notifications').insert({
          user_id: mission.organisateur_id,
          type: 'new_application',
          title: '📩 Nouvelle candidature',
          body: `${profile.full_name} a postulé à votre mission "${mission.title}"`,
          data: { mission_id: mission.id, freelance_id: profile.id },
          is_read: false,
        });
      } catch { /* notification failure must never block */ }
    }
    setApplying(false);
  }

  async function withdrawApplication() {
    if (!profile || !mission || withdrawing) return;
    setWithdrawing(true);
    const { data: appRow } = await supabase.from('applications')
      .select('id').eq('mission_id', mission.id).eq('freelance_id', profile.id).single();
    if (!appRow) { setWithdrawing(false); return; }
    const { error } = await supabase.from('applications').update({ status: 'withdrawn' }).eq('id', appRow.id);
    if (error) { toast.error(error.message || 'Erreur'); }
    else {
      toast.success('Candidature retirée');
      setAlreadyApplied(false);
      setConfirmWithdraw(false);
      try {
        await supabase.from('notifications').insert({
          user_id: mission.organisateur_id,
          type: 'application_withdrawn',
          title: '↩️ Candidature retirée',
          body: `${profile.full_name} a retiré sa candidature pour "${mission.title}"`,
          data: { mission_id: mission.id, application_id: appRow.id },
          is_read: false,
        });
      } catch { /* notification failure must never block */ }
    }
    setWithdrawing(false);
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

        {/* Photo du lieu */}
        {mission.venue_photo_url && (
          <div className="mb-6 rounded-2xl overflow-hidden" style={{ height: 240 }}>
            <img src={mission.venue_photo_url} alt="Photo du lieu"
              className="w-full h-full object-cover" />
          </div>
        )}

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
            <div className="w-full h-2 rounded-full" style={{ background: '#52367c' }}>
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

          {/* Carte de localisation */}
          {mission.latitude && mission.longitude && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3" style={{ color: '#f0e6d3' }}>
                📍 Localisation
                {profile?.latitude && profile?.longitude && (
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: '#c9a84c' }}>
                    · à {formatDistance(distanceKm(profile.latitude, profile.longitude, mission.latitude!, mission.longitude!))} de vous
                  </span>
                )}
              </h3>
              <MapView
                lat={mission.latitude!}
                lng={mission.longitude!}
                label={`${mission.title} — ${mission.location}`}
              />
            </div>
          )}

          {/* Organisateur */}
          {org && (
            <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(82,54,124,0.4)', border: '1px solid rgba(201,168,76,0.1)' }}>
              <h3 className="font-semibold mb-3" style={{ color: '#f0e6d3' }}>Organisateur</h3>
              <div className="flex items-center gap-3">
                {org.avatar_url ? (
                  <img src={org.avatar_url} alt=""
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover',
                      border: '1.5px solid rgba(201,168,76,0.3)', flexShrink: 0 }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#261642' }}>
                    {org.full_name?.[0]}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <p className="font-medium text-sm" style={{ color: '#f0e6d3' }}>{org.company_name || org.full_name}</p>
                  <p className="text-xs" style={{ color: '#b8a898' }}>
                    ⭐ {org.avg_rating || '–'} · {org.total_missions || 0} mission(s)
                  </p>
                </div>
                <button onClick={() => navigate(`/public-profile?id=${org.id}`)}
                  className="btn-outline-gold px-3 py-1.5 rounded-lg text-xs shrink-0">
                  Voir profil
                </button>
              </div>
            </div>
          )}

          {/* Actions freelance */}
          {profile?.role === 'freelance' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {alreadyApplied ? (
                  <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <span className="text-sm font-medium flex-1" style={{ color: '#10b981' }}>✅ Candidature envoyée</span>
                    {confirmWithdraw ? (
                      <>
                        <span className="text-xs" style={{ color: '#b8a898' }}>Retirer ?</span>
                        <button onClick={withdrawApplication} disabled={withdrawing}
                          className="px-3 py-1 rounded-lg text-xs font-bold border"
                          style={{ borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                          {withdrawing ? '…' : 'Oui'}
                        </button>
                        <button onClick={() => setConfirmWithdraw(false)}
                          className="px-3 py-1 rounded-lg text-xs border"
                          style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#b8a898' }}>
                          Non
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmWithdraw(true)}
                        className="px-3 py-1 rounded-lg text-xs border"
                        style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
                        Retirer
                      </button>
                    )}
                  </div>
                ) : (
                  <button onClick={postuler} disabled={applying}
                    className="btn-gold flex-1 py-3 rounded-xl font-bold text-[#261642]">
                    {applying ? 'Envoi...' : 'Postuler à cette mission'}
                  </button>
                )}
                <button onClick={contacter} disabled={contacting}
                  className="btn-outline-gold px-5 py-3 rounded-xl font-medium"
                  style={{ opacity: contacting ? 0.7 : 1 }}>
                  {contacting ? '…' : '💬 Contacter'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section contrat (organisateur) */}
        {profile?.role === 'organisateur' && (
          <div className="card-glass p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: '#f0e6d3' }}>📄 Contrat CDD</h2>
              {!contract && acceptedFreelances.length > 0 && !showWizard && (
                <button onClick={() => setShowWizard(true)}
                  className="btn-gold px-4 py-2 rounded-xl text-sm font-bold text-[#261642]">
                  + Générer un contrat
                </button>
              )}
            </div>
            {contract ? (
              <ContractCard contract={contract} myRole="organizer" />
            ) : acceptedFreelances.length === 0 ? (
              <p className="text-sm" style={{ color: '#b8a898' }}>
                Acceptez au moins une candidature pour générer un contrat.
              </p>
            ) : showWizard && !selectedFreelance ? (
              <div className="space-y-2">
                <p className="text-xs mb-2" style={{ color: '#b8a898' }}>Sélectionnez le freelance :</p>
                {acceptedFreelances.map(fl => (
                  <button key={fl.id} onClick={() => setSelectedFreelance(fl)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(82,54,124,0.4)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}>
                    {fl.full_name}
                  </button>
                ))}
                <button onClick={() => setShowWizard(false)} className="btn-outline-gold w-full py-2 rounded-xl text-sm mt-1">
                  Annuler
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Section contrat (freelance) */}
        {profile?.role === 'freelance' && contract && (
          <div className="card-glass p-6 mb-6">
            <h2 className="font-semibold mb-4" style={{ color: '#f0e6d3' }}>📄 Contrat CDD</h2>
            <ContractCard contract={contract} myRole="freelance" />
          </div>
        )}

        {/* Wizard création contrat */}
        {showWizard && selectedFreelance && mission && profile && (
          <ContractWizard
            mission={mission}
            organizer={profile}
            freelance={selectedFreelance}
            myRole="organizer"
            onDone={(c: Contract) => { setContract(c); setShowWizard(false); setSelectedFreelance(null); }}
            onCancel={() => { setShowWizard(false); setSelectedFreelance(null); }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
