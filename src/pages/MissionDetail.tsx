import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { useAuthGate } from '../contexts/AuthGateContext';
import { supabase } from '../lib/supabase';
import { getOrCreateConversation } from '../lib/messaging';
import { type Mission, type Profile, type Contract } from '../types';
import { Zap, Calendar, Clock, MapPin, Wallet, Users, Shirt, Star, CheckCircle2, MessageCircle, FileText } from 'lucide-react';
import { formatDate, formatCFA } from '../lib/utils';
import { ServiceIcon } from '../lib/serviceIcons';
import { distanceKm, formatDistance } from '../lib/geo';
import MapView from '../components/MapView';
import { fetchContractByMission } from '../services/contractService';
import ContractWizard from '../components/contracts/ContractWizard';
import ContractCard from '../components/contracts/ContractCard';
import MatchedFreelances from '../components/MatchedFreelances';
import toast from 'react-hot-toast';

const OVERLAY: CSSProperties = {
  position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16, background: 'rgba(15,10,30,0.85)', zIndex: 1000,
};

function ReviewModal({ name, onClose, onSubmit }: {
  name: string; onClose: () => void; onSubmit: (rating: number, comment: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div style={OVERLAY} onClick={onClose}>
      <div className="card-glass p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold mb-1" style={{ color: '#f0e6d3' }}>Noter {name}</h3>
        <p className="text-xs mb-4" style={{ color: '#b8a898' }}>Votre avis aide toute la communauté.</p>
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i} type="button" onClick={() => setRating(i)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
              <Star size={28} fill={i <= rating ? '#d4af37' : 'none'} color="#d4af37" />
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
          placeholder="Commentaire (optionnel)"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3', resize: 'none' }} />
        <div className="flex gap-2">
          <button type="button" disabled={busy}
            onClick={async () => { setBusy(true); await onSubmit(rating, comment); setBusy(false); }}
            className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-bold text-[#261642]">
            {busy ? '…' : 'Envoyer l\'avis'}
          </button>
          <button type="button" onClick={onClose} className="px-4 rounded-xl text-sm border"
            style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#b8a898' }}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

function DisputeModal({ name, onClose, onSubmit }: {
  name: string; onClose: () => void; onSubmit: (reason: string, description: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div style={OVERLAY} onClick={onClose}>
      <div className="card-glass p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold mb-1" style={{ color: '#f0e6d3' }}>Signaler un litige</h3>
        <p className="text-xs mb-4" style={{ color: '#b8a898' }}>Concernant {name}. Notre équipe examinera votre signalement.</p>
        <input value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Motif (ex : absence, paiement, comportement)"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }} />
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Décrivez ce qui s'est passé"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3', resize: 'none' }} />
        <div className="flex gap-2">
          <button type="button" disabled={busy || !reason.trim()}
            onClick={async () => { setBusy(true); await onSubmit(reason, description); setBusy(false); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: '#ef4444', color: '#fff' }}>
            {busy ? '…' : 'Envoyer le signalement'}
          </button>
          <button type="button" onClick={onClose} className="px-4 rounded-xl text-sm border"
            style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#b8a898' }}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

export default function MissionDetail() {
  const [params] = useSearchParams();
  const missionId = params.get('id');
  const { profile } = useAuth();
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const isGuest = !profile;
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
  const [myAppStatus, setMyAppStatus] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [reviewTarget, setReviewTarget] = useState<{ id: string; name: string; type: 'org_to_free' | 'free_to_org' } | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (missionId) fetchMission();
  }, [missionId]);

  useEffect(() => {
    if (!missionId || !profile) return;
    fetchContractByMission(missionId).then(c => setContract(c));
    supabase.from('reviews').select('reviewed_id')
      .eq('mission_id', missionId).eq('reviewer_id', profile.id)
      .then(({ data }) => setReviewedIds(new Set((data || []).map(r => r.reviewed_id as string))));
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
    // Invité : colonnes sûres (pas d'adresse exacte, ni GPS, ni contact organisateur)
    const cols = isGuest
      ? 'id,organisateur_id,title,description,service_type,skills_required,ville,event_date,start_time,end_time,hourly_rate,slots_total,slots_filled,is_urgent,status,venue_photo_url,created_at'
      : '*';
    const org = isGuest ? 'id,full_name,avatar_url,role,company_name,avg_rating' : '*';
    const { data } = await supabase.from('missions')
      .select(`${cols}, organisateur:profiles!organisateur_id(${org})`)
      .eq('id', missionId!).single();
    const m = data as unknown as (Mission & { organisateur?: Profile }) | null;
    if (isGuest && m?.organisateur) {
      m.organisateur.full_name = (m.organisateur.full_name || '').trim().split(' ')[0] || 'Organisateur';
    }
    setMission(m);
    if (profile && data) {
      const { data: app } = await supabase.from('applications')
        .select('status').eq('mission_id', missionId!).eq('freelance_id', profile.id).maybeSingle();
      setAlreadyApplied(!!app);
      setMyAppStatus(app?.status ?? null);
    }
    setLoading(false);
  }

  async function contacter() {
    if (!requireAuth('contacter l\'organisateur')) return;
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
    if (!requireAuth('postuler à cette mission')) return;
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
          title: 'Nouvelle candidature',
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

  // Organisateur : clôturer la mission (après l'événement)
  async function markCompleted() {
    if (!mission || completing) return;
    setCompleting(true);
    const { error } = await supabase.from('missions').update({ status: 'completed' }).eq('id', mission.id);
    if (error) { toast.error('Erreur lors de la clôture'); setCompleting(false); return; }
    setMission(m => (m ? { ...m, status: 'completed' } : m));
    if (acceptedFreelances.length) {
      try {
        await supabase.from('notifications').insert(acceptedFreelances.map(f => ({
          user_id: f.id, type: 'mission_completed', title: 'Mission terminée',
          body: `La mission "${mission.title}" est marquée comme terminée. Vous pouvez laisser un avis à l'organisateur.`,
          data: { mission_id: mission.id }, is_read: false,
        })));
      } catch { /* notif jamais bloquante */ }
    }
    toast.success('Mission marquée comme terminée');
    setCompleting(false);
  }

  async function submitReview(rating: number, comment: string) {
    if (!mission || !profile || !reviewTarget) return;
    // NB : la table `reviews` n'a pas de colonne `type` (le rôle se déduit du reviewer).
    const { error } = await supabase.from('reviews').insert({
      mission_id: mission.id, reviewer_id: profile.id, reviewed_id: reviewTarget.id,
      rating, comment: comment.trim() || null,
    });
    if (error) { toast.error(error.code === '23505' ? 'Vous avez déjà noté cette personne.' : 'Erreur'); return; }
    setReviewedIds(prev => new Set([...prev, reviewTarget.id]));
    try {
      await supabase.from('notifications').insert({
        user_id: reviewTarget.id, type: 'review', title: 'Nouvel avis reçu',
        body: `${profile.full_name} vous a laissé un avis (${rating}/5) sur "${mission.title}".`,
        data: { mission_id: mission.id }, is_read: false,
      });
    } catch { /* notif jamais bloquante */ }
    toast.success('Avis envoyé, merci !');
    setReviewTarget(null);
  }

  async function submitDispute(reason: string, description: string) {
    if (!mission || !profile || !disputeTarget) return;
    const { error } = await supabase.from('disputes').insert({
      mission_id: mission.id, reporter_id: profile.id, reported_id: disputeTarget.id,
      reason: reason.trim(), description: description.trim() || null, status: 'open',
    });
    if (error) { toast.error('Erreur lors du signalement'); return; }
    toast.success('Litige signalé. Notre équipe va l\'examiner.');
    setDisputeTarget(null);
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
          <ServiceIcon type={mission.service_type} size={26} />
          <h1 className="font-display text-2xl font-bold flex-1" style={{ color: '#f0e6d3' }}>{mission.title}</h1>
          {mission.is_urgent && <span className="badge-urgent px-3 py-1 rounded-full text-sm font-bold inline-flex items-center gap-1.5"><Zap size={14} fill="currentColor" /> URGENT</span>}
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
            <div className="flex items-center gap-2.5" style={{ color: '#b8a898' }}>
              <Calendar size={16} color="#d4af37" /><span>{formatDate(mission.event_date)}</span>
            </div>
            <div className="flex items-center gap-2.5" style={{ color: '#b8a898' }}>
              <Clock size={16} color="#d4af37" /><span>{mission.start_time?.substring(0,5)} – {mission.end_time?.substring(0,5)}</span>
            </div>
            <div className="flex items-center gap-2.5" style={{ color: '#b8a898' }}>
              <MapPin size={16} color="#d4af37" /><span>{[mission.location, mission.ville].filter(Boolean).join(', ')}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Wallet size={16} color="#d4af37" />
              <span className="font-bold" style={{ color: '#d4af37' }}>{formatCFA(mission.hourly_rate)}/h · Total: {formatCFA(totalAmount)}</span>
            </div>
            <div className="flex items-center gap-2.5" style={{ color: '#b8a898' }}>
              <Users size={16} color="#d4af37" />
              <span>{slots_filled}/{mission.slots_total} poste(s) confirmé(s)</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="w-full h-2 rounded-full" style={{ background: '#52367c' }}>
              <div className="h-full rounded-full" style={{ width: `${(slots_filled / mission.slots_total) * 100}%`, background: 'linear-gradient(to right,#d4af37,#e8c97a)' }} />
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
              <p className="text-sm flex items-center gap-2" style={{ color: '#b8a898' }}><Shirt size={15} color="#d4af37" /> {mission.dress_code}</p>
            </div>
          )}

          {/* Carte de localisation */}
          {mission.latitude && mission.longitude && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#f0e6d3' }}>
                <MapPin size={16} color="#d4af37" /> Localisation
                {profile?.latitude && profile?.longitude && (
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: '#d4af37' }}>
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
                    style={{ background: 'linear-gradient(135deg,#d4af37,#e8c97a)', color: '#261642' }}>
                    {org.full_name?.[0]}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <p className="font-medium text-sm" style={{ color: '#f0e6d3' }}>{org.company_name || org.full_name}</p>
                  <p className="text-xs flex items-center gap-1.5" style={{ color: '#b8a898' }}>
                    <Star size={12} fill="#d4af37" color="#d4af37" /> {org.avg_rating || '–'} · {org.total_missions || 0} mission(s)
                  </p>
                </div>
                <button onClick={() => navigate(`/public-profile?id=${org.id}`)}
                  className="btn-outline-gold px-3 py-1.5 rounded-lg text-xs shrink-0">
                  Voir profil
                </button>
              </div>
            </div>
          )}

          {/* Actions freelance / invité */}
          {(profile?.role === 'freelance' || isGuest) && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {alreadyApplied ? (
                  <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <span className="text-sm font-medium flex-1 flex items-center gap-2" style={{ color: '#10b981' }}><CheckCircle2 size={15} /> Candidature envoyée</span>
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
                  {contacting ? '…' : <span className="inline-flex items-center gap-2"><MessageCircle size={15} /> Contacter</span>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Freelances recommandés — matching multicritères (organisateur, phase recrutement) */}
        {profile?.role === 'organisateur'
          && mission.organisateur_id === profile?.id
          && mission.status !== 'completed' && mission.status !== 'cancelled' && (
          <MatchedFreelances missionId={mission.id} />
        )}

        {/* Clôture, avis & litige */}
        {(profile?.role === 'organisateur' || myAppStatus === 'accepted') && (
          <div className="card-glass p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#f0e6d3' }}>
              <CheckCircle2 size={17} color="#00C896" /> Clôture &amp; avis
            </h2>

            {/* Organisateur : marquer terminée */}
            {profile?.role === 'organisateur' && mission.status !== 'completed' && (
              acceptedFreelances.length === 0 ? (
                <p className="text-sm" style={{ color: '#b8a898' }}>
                  Confirmez au moins un freelance pour pouvoir clôturer la mission.
                </p>
              ) : (
                <button onClick={markCompleted} disabled={completing}
                  className="btn-gold px-5 py-2.5 rounded-xl text-sm font-bold text-[#261642]">
                  {completing ? '…' : <span className="inline-flex items-center gap-2"><CheckCircle2 size={15} /> Marquer la mission comme terminée</span>}
                </button>
              )
            )}

            {/* Freelance : en attente de la clôture */}
            {profile?.role !== 'organisateur' && mission.status !== 'completed' && (
              <p className="text-sm" style={{ color: '#b8a898' }}>
                Vous pourrez laisser un avis dès que l'organisateur aura clôturé la mission.
              </p>
            )}

            {/* Après clôture : noter + signaler */}
            {mission.status === 'completed' && (
              <div className="space-y-3">
                {profile?.role === 'organisateur' ? (
                  acceptedFreelances.length === 0 ? (
                    <p className="text-sm" style={{ color: '#b8a898' }}>Aucun freelance à évaluer.</p>
                  ) : acceptedFreelances.map(f => (
                    <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(82,54,124,0.3)' }}>
                      <span className="text-sm" style={{ color: '#f0e6d3' }}>{f.full_name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setReviewTarget({ id: f.id, name: f.full_name, type: 'org_to_free' })}
                          disabled={reviewedIds.has(f.id)}
                          className="btn-outline-gold px-3 py-1.5 rounded-lg text-xs disabled:opacity-50">
                          {reviewedIds.has(f.id) ? 'Noté ✓' : 'Noter'}
                        </button>
                        <button onClick={() => setDisputeTarget({ id: f.id, name: f.full_name })}
                          className="px-3 py-1.5 rounded-lg text-xs border"
                          style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#ef4444' }}>
                          Signaler
                        </button>
                      </div>
                    </div>
                  ))
                ) : org && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setReviewTarget({ id: org.id, name: org.full_name || 'Organisateur', type: 'free_to_org' })}
                      disabled={reviewedIds.has(org.id)}
                      className="btn-gold px-4 py-2 rounded-lg text-sm font-bold text-[#261642] disabled:opacity-50">
                      {reviewedIds.has(org.id) ? 'Avis envoyé ✓' : 'Noter l\'organisateur'}
                    </button>
                    <button onClick={() => setDisputeTarget({ id: org.id, name: org.full_name || 'Organisateur' })}
                      className="px-4 py-2 rounded-lg text-sm border"
                      style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#ef4444' }}>
                      Signaler un litige
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section contrat (organisateur) */}
        {profile?.role === 'organisateur' && (
          <div className="card-glass p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2" style={{ color: '#f0e6d3' }}><FileText size={17} color="#d4af37" /> Contrat CDD</h2>
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

        {reviewTarget && <ReviewModal name={reviewTarget.name} onClose={() => setReviewTarget(null)} onSubmit={submitReview} />}
        {disputeTarget && <DisputeModal name={disputeTarget.name} onClose={() => setDisputeTarget(null)} onSubmit={submitDispute} />}
      </div>
    </DashboardLayout>
  );
}
