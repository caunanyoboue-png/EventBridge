import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import MapPicker from '../components/MapPicker';
import MapView from '../components/MapView';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { distanceKm, formatDistance, geocodeAddress, getBrowserPosition } from '../lib/geo';
import { formatCFA } from '../lib/utils';
import { type SosSession } from '../types';
import {
  Siren, MapPin, Inbox, Hourglass, CheckCircle2, Phone, Star, User, Wallet,
  X, Check, Target, Users, Clock, Zap, BellOff, XCircle, ChevronUp, ChevronDown, Search, Navigation,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

const SERVICE_TYPES = [
  'Service en salle', 'Bar / Barman', 'Cuisine gastronomique', 'Hôtesse accueil',
  'Animation', 'Son & Lumière', 'Sécurité', 'Chauffeur', 'Manutention',
];

type SosResponse = {
  id: string;
  status: 'pending' | 'confirmed' | 'rejected';
  freelance_id: string;
  freelance?: { full_name: string | null; avatar_url: string | null; skills: string[] | null; avg_rating: number | null; phone?: string | null; ville?: string | null; latitude?: number | null; longitude?: number | null };
};

/* ──────────────────────────────────────────────────────────────────── */
export default function SosBrigade() {
  const { profile } = useAuth();

  if (!profile) return null;
  if (profile.role === 'freelance') return <FreelanceView />;
  return <OrgView />;
}

/* ══════════════════════════════════════════════════════════════════════
   HELPERS localStorage — session complète sérialisée
══════════════════════════════════════════════════════════════════════ */
const SOS_KEY = 'eb_sos_active';
const SOS_RADIUS_KM = 20; // rayon de matching géographique (km)

// Extrait les id de session des notifications S.O.S reçues par le freelance.
function sosIdsFromNotifs(notifs: { data: unknown }[] | null): string[] {
  return [...new Set((notifs || [])
    .map(n => (n.data as { sos_session_id?: string } | null)?.sos_session_id)
    .filter(Boolean) as string[])];
}

function lsSave(s: SosSession) {
  localStorage.setItem(SOS_KEY, JSON.stringify(s));
}
function lsClear() {
  localStorage.removeItem(SOS_KEY);
}
function lsLoad(): SosSession | null {
  try {
    const raw = localStorage.getItem(SOS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SosSession;
    if (s.status === 'active' && new Date(s.expires_at) > new Date()) return s;
    lsClear();
    return null;
  } catch { lsClear(); return null; }
}

/* ══════════════════════════════════════════════════════════════════════
   VUE ORGANISATEUR
══════════════════════════════════════════════════════════════════════ */
function OrgView() {
  const { profile } = useAuth();
  const [form, setForm] = useState<{
    service_types: string[]; location: string; slots_needed: number; message: string;
    latitude: number | null; longitude: number | null;
    hourly_rate: number; estimated_hours: number;
  }>({ service_types: [], location: '', slots_needed: 3, message: '', latitude: null, longitude: null,
    hourly_rate: 3000, estimated_hours: 4 });
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Sélection 1 à 3 prestations
  function toggleType(t: string) {
    setForm(p => {
      if (p.service_types.includes(t)) return { ...p, service_types: p.service_types.filter(x => x !== t) };
      if (p.service_types.length >= 3) {
        toast.error('Vous ne pouvez pas sélectionner plus de 3 types de prestation.');
        return p;
      }
      return { ...p, service_types: [...p.service_types, t] };
    });
  }

  // Adresse saisie → géocodage → déplace l'épingle (synchro adresse → carte)
  async function searchAddress() {
    if (!form.location.trim()) return;
    setGeocoding(true);
    const r = await geocodeAddress(form.location.trim());
    if (r) setForm(p => ({ ...p, latitude: r.lat, longitude: r.lng }));
    else toast.error('Adresse introuvable — placez le point directement sur la carte.');
    setGeocoding(false);
  }

  // ── Lecture SYNCHRONE depuis localStorage avant le premier render ──
  const [session, setSession] = useState<SosSession | null>(() => lsLoad());
  // Si une session locale existe → pas besoin de spinner
  const [checkingActive, setCheckingActive] = useState<boolean>(() => !lsLoad());

  // Si pas de session locale → vérifier en DB (une seule fois)
  useEffect(() => {
    if (!checkingActive || !profile?.id) return;
    supabase
      .from('sos_sessions')
      .select('*')
      .eq('organisateur_id', profile.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { lsSave(data as SosSession); setSession(data as SosSession); }
        setCheckingActive(false);
      });
  }, [profile?.id, checkingActive]);

  // Rafraîchir les compteurs depuis la DB si session locale présente
  useEffect(() => {
    if (!session?.id) return;
    supabase.from('sos_sessions').select('*').eq('id', session.id).maybeSingle()
      .then(({ data }) => {
        if (!data || data.status !== 'active' || new Date(data.expires_at) <= new Date()) {
          lsClear(); setSession(null);
        } else {
          lsSave(data as SosSession);
          setSession(data as SosSession);
        }
      });
  }, []); // Une seule fois au montage pour refresh des compteurs

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none";
  const inputStyle = { background: 'var(--color-input-bg)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--color-text-primary)' };

  async function declencher() {
    if (!profile || form.service_types.length === 0 || !form.location || form.latitude == null || form.longitude == null) return;
    setLoading(true);
    try {
      // Compte à rebours principal : 30 minutes
      const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const typesLabel = form.service_types.join(', ');
      const { data, error } = await supabase.from('sos_sessions').insert({
        organisateur_id: profile.id,
        service_type: form.service_types[0], // type principal (compatibilité)
        service_types: form.service_types,
        location: form.location,
        latitude: form.latitude,
        longitude: form.longitude,
        slots_needed: form.slots_needed,
        slots_confirmed: 0,
        radius_km: SOS_RADIUS_KM,
        hourly_rate: Math.max(0, form.hourly_rate),
        estimated_hours: Math.max(1, form.estimated_hours),
        notified_count: 0,
        status: 'active',
        expires_at,
        message: form.message || null,
      }).select().single();
      if (error) throw error;

      // Freelances dispo dont une compétence correspond + GÉOLOCALISÉS à ≤ 30 km
      const { data: freelances } = await supabase
        .from('profiles')
        .select('id, latitude, longitude')
        .eq('role', 'freelance')
        .eq('is_available', true)
        .overlaps('skills', form.service_types)
        .neq('id', profile.id)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      const targets = (freelances || []).filter(f =>
        distanceKm(form.latitude!, form.longitude!, f.latitude as number, f.longitude as number) <= SOS_RADIUS_KM
      );
      if (targets.length > 0) {
        await supabase.from('notifications').insert(
          targets.map(f => ({
            user_id: f.id,
            type: 'sos_alert',
            title: 'S.O.S Brigade — Urgence !',
            body: `Besoin urgent de ${typesLabel} à ${form.location}. ${form.slots_needed} poste(s) disponible(s).`,
            data: { sos_session_id: data.id },
            is_read: false,
          }))
        );
        await supabase.from('sos_sessions').update({ notified_count: targets.length }).eq('id', data.id);
        data.notified_count = targets.length;
      }

      lsSave(data as SosSession);
      setSession(data);
      toast.success(`Alerte déclenchée ! ${targets.length} freelance(s) notifié(s).`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Erreur lors du déclenchement');
    } finally { setLoading(false); }
  }

  if (checkingActive) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--color-gold-primary)',
            borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p>Vérification d'une alerte active...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 animate-sos" style={{ width: 72, height: 72,
            borderRadius: '50%', background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            <Siren size={34} color="#fff" strokeWidth={2} />
          </div>
          <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>S.O.S Brigade</h1>
          <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            Besoin d'extras en urgence ? Mobilisez les freelances disponibles en moins de 10 minutes.
          </p>
        </div>

        {!session ? (
          <div className="card-glass p-8 space-y-5">
            <div>
              <label className="text-xs mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
                Type(s) de prestation * <span style={{ color: 'var(--color-text-muted)' }}>(1 à 3)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map(t => {
                  const on = form.service_types.includes(t);
                  return (
                    <button key={t} type="button" onClick={() => toggleType(t)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border inline-flex items-center gap-1.5"
                      style={{
                        background: on ? 'rgba(212,175,55,0.2)' : 'transparent',
                        borderColor: on ? 'var(--color-gold-primary)' : 'rgba(201,168,76,0.25)',
                        color: on ? 'var(--color-gold-light)' : 'var(--color-text-secondary)',
                      }}>
                      {on && <Check size={12} />} {t} {on && <X size={12} />}
                    </button>
                  );
                })}
              </div>
              {form.service_types.length > 0 && (
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{form.service_types.length}/3 sélectionné(s)</p>
              )}
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>
                Adresse exacte * <span style={{ color: 'var(--color-text-muted)' }}>(synchronisée avec la carte)</span>
              </label>
              <div className="flex gap-2">
                <input className={inputClass} style={inputStyle}
                  placeholder="Ex: Avenue Delafosse, Plateau, Abidjan"
                  value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAddress(); } }} />
                <button type="button" onClick={searchAddress} disabled={geocoding || !form.location.trim()}
                  className="px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                  style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.4)',
                    color: 'var(--color-gold-primary)', flexShrink: 0, cursor: 'pointer',
                    opacity: (geocoding || !form.location.trim()) ? 0.6 : 1 }}>
                  <Search size={15} /> {geocoding ? '...' : 'Localiser'}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>
                Lieu sur la carte * <span style={{ color: 'var(--color-text-muted)' }}>(centre du rayon de 30 km)</span>
              </label>
              <MapPicker lat={form.latitude} lng={form.longitude} markerColor="#ef4444"
                onSelect={(lat, lng, addr) => setForm(p => ({ ...p, latitude: lat, longitude: lng, location: addr }))} />
              {form.latitude != null && form.longitude != null && (
                <p className="text-xs mt-2" style={{ color: '#00C896', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Check size={13} /> Lieu défini — seuls les freelances à moins de 30 km seront alertés.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>Nombre d'extras requis</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setForm(p => ({ ...p, slots_needed: Math.max(1, p.slots_needed - 1) }))}
                  className="w-12 h-12 rounded-xl font-bold text-xl"
                  style={{ background: 'var(--color-input-bg)', color: 'var(--color-gold-primary)', border: '1px solid rgba(201,168,76,0.2)' }}>-</button>
                <span className="text-3xl font-bold text-gold-gradient">{form.slots_needed}</span>
                <button onClick={() => setForm(p => ({ ...p, slots_needed: p.slots_needed + 1 }))}
                  className="w-12 h-12 rounded-xl font-bold text-xl"
                  style={{ background: 'var(--color-input-bg)', color: 'var(--color-gold-primary)', border: '1px solid rgba(201,168,76,0.2)' }}>+</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Tarif horaire (FCFA)</label>
                <input type="number" min={0} step={500} className={inputClass} style={inputStyle}
                  value={form.hourly_rate}
                  onChange={e => setForm(p => ({ ...p, hourly_rate: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Durée estimée (h)</label>
                <input type="number" min={1} step={1} className={inputClass} style={inputStyle}
                  value={form.estimated_hours}
                  onChange={e => setForm(p => ({ ...p, estimated_hours: Number(e.target.value) }))} />
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginTop: -8 }}>
              En cas d'annulation, chaque freelance déjà confirmé reçoit 10 % ={' '}
              <span style={{ color: 'var(--color-gold-primary)', fontWeight: 600 }}>
                {Math.round(0.1 * form.hourly_rate * form.estimated_hours).toLocaleString('fr-CI')} FCFA
              </span>.
            </p>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Message (optionnel)</label>
              <textarea className={inputClass} style={{ ...inputStyle, resize: 'none' }} rows={3}
                placeholder="Précisions supplémentaires..."
                value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
            </div>
            {(!form.latitude || !form.longitude) && (
              <p className="text-xs text-center" style={{ color: '#F59E0B' }}>
                Placez le lieu sur la carte pour pouvoir lancer l'alerte.
              </p>
            )}
            <button onClick={declencher}
              disabled={loading || form.service_types.length === 0 || !form.location || !form.latitude || !form.longitude}
              className="w-full py-4 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                opacity: (loading || form.service_types.length === 0 || !form.location || !form.latitude || !form.longitude) ? 0.6 : 1 }}>
              {loading ? 'Déclenchement...' : <><Siren size={19} /> Déclencher l'alerte S.O.S</>}
            </button>
          </div>
        ) : (
          <OrgTracker session={session} onReset={() => setSession(null)} />
        )}
      </div>
    </DashboardLayout>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TRACKER ORGANISATEUR — minuteur live + propositions freelances
══════════════════════════════════════════════════════════════════════ */
function OrgTracker({ session, onReset }: { session: SosSession; onReset: () => void }) {
  const navigate = useNavigate();
  const [responses, setResponses] = useState<SosResponse[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [cancelStep, setCancelStep] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [freeLeft, setFreeLeft] = useState(0);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Minuteur en temps réel */
  useEffect(() => {
    const startMs = session.created_at
      ? new Date(session.created_at).getTime()
      : new Date(session.expires_at).getTime() - 30 * 60 * 1000;
    function tick() {
      const secs = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(secs);
      setFreeLeft(Math.max(0, 600 - Math.floor((Date.now() - startMs) / 1000))); // fenêtre gratuite 10 min
      if (secs === 0) {
        setExpired(true);
        clearInterval(timerRef.current!);
        // Marquer la session comme expirée en base
        supabase.from('sos_sessions').update({ status: 'expired' }).eq('id', session.id).then(() => {});
        lsClear();
      }
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current!);
  }, [session.expires_at]);

  /* Realtime : nouvelles réponses */
  useEffect(() => {
    fetchResponses();
    const ch = supabase.channel('sos-org-tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_responses',
        filter: `sos_session_id=eq.${session.id}` }, () => fetchResponses())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session.id]);

  async function fetchResponses() {
    const { data } = await supabase.from('sos_responses')
      .select('id, status, freelance_id, freelance:profiles!freelance_id(full_name,avatar_url,skills,avg_rating,phone,ville,latitude,longitude)')
      .eq('sos_session_id', session.id)
      .order('responded_at', { ascending: true });
    setResponses((data || []) as unknown as SosResponse[]);
  }

  async function confirmResponse(resp: SosResponse) {
    setConfirming(resp.id);
    try {
      // Garde serveur : ne jamais dépasser le nombre de postes (compte réel en base)
      const { count: already } = await supabase.from('sos_responses')
        .select('*', { count: 'exact', head: true })
        .eq('sos_session_id', session.id).eq('status', 'confirmed');
      if ((already || 0) >= session.slots_needed) {
        toast.error('Tous les postes sont déjà pourvus.');
        setConfirming(null); fetchResponses(); return;
      }
      await supabase.from('sos_responses').update({ status: 'confirmed' }).eq('id', resp.id);
      const confirmedCount = (already || 0) + 1;
      const isFull = confirmedCount >= session.slots_needed;
      // Quand l'équipe est complète, on clôt la session (statut 'completed' :
      // l'alerte disparaît pour les autres freelances).
      await supabase.from('sos_sessions')
        .update(isFull ? { slots_confirmed: confirmedCount, status: 'completed' } : { slots_confirmed: confirmedCount })
        .eq('id', session.id);
      await supabase.from('notifications').insert({
        user_id: resp.freelance_id,
        type: 'sos_confirmed',
        title: 'S.O.S Brigade — Vous êtes confirmé !',
        body: `L'organisateur vous a confirmé pour "${session.service_type}" à ${session.location}. Rendez-vous sur place !`,
        data: { sos_session_id: session.id },
        is_read: false,
      });
      toast.success('Freelance confirmé et notifié !');
      fetchResponses();
    } catch { toast.error('Erreur'); }
    finally { setConfirming(null); }
  }

  async function rejectResponse(resp: SosResponse) {
    await supabase.from('sos_responses').update({ status: 'rejected' }).eq('id', resp.id);
    await supabase.from('notifications').insert({
      user_id: resp.freelance_id,
      type: 'sos_rejected',
      title: 'S.O.S Brigade — Non retenu',
      body: `Vous n'avez pas été retenu pour ce S.O.S. Restez disponible pour les prochaines alertes !`,
      data: { sos_session_id: session.id },
      is_read: false,
    });
    fetchResponses();
  }

  const pending   = responses.filter(r => r.status === 'pending');
  const confirmed = responses.filter(r => r.status === 'confirmed');
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const urgentColor = timeLeft < 300 ? '#ef4444' : timeLeft < 600 ? '#f59e0b' : '#10b981';

  // Fenêtre d'annulation gratuite : 10 premières minutes
  const inFreeWindow = freeLeft > 0;
  const freeMin = Math.ceil(freeLeft / 60);

  // Pénalité = 10 % du montant total dû (freelances confirmés × tarif × durée)
  const baseAmount   = Math.round((session.hourly_rate || 0) * (session.estimated_hours || 0));
  const totalDue     = baseAmount * confirmed.length;
  const penaltyTotal = Math.round(0.1 * totalDue);
  const penaltyPerFreelance = Math.round(0.1 * baseAmount);

  async function cancelSos() {
    setCancelling(true);
    try {
      const applyPenalty = !inFreeWindow && confirmed.length > 0 && penaltyPerFreelance > 0;

      // Compensation due aux freelances confirmés si l'annulation est hors du délai gratuit
      if (applyPenalty) {
        await supabase.from('sos_compensations').insert(
          confirmed.map(r => ({
            sos_session_id: session.id,
            organizer_id: session.organisateur_id,
            freelance_id: r.freelance_id,
            amount: penaltyPerFreelance,
            status: 'due',
          }))
        );
      }

      // Prévenir TOUS les freelances impliqués que le S.O.S est annulé
      // (confirmés + en attente). Les confirmés reçoivent aussi le montant dû.
      const lieu = `« ${session.service_type} » à ${session.location}`;
      const notifs = [
        ...confirmed.map(r => ({
          user_id: r.freelance_id,
          type: 'sos_cancelled',
          title: applyPenalty ? 'S.O.S annulé — compensation due' : 'S.O.S annulé',
          body: applyPenalty
            ? `L'organisateur a annulé le S.O.S ${lieu} après le délai gratuit. La mission n'aura pas lieu. Une compensation de ${penaltyPerFreelance.toLocaleString('fr-CI')} FCFA vous est due.`
            : `L'organisateur a annulé le S.O.S ${lieu}. La mission n'aura pas lieu.`,
          data: { sos_session_id: session.id },
          is_read: false,
        })),
        ...pending.map(r => ({
          user_id: r.freelance_id,
          type: 'sos_cancelled',
          title: 'S.O.S annulé',
          body: `L'organisateur a annulé le S.O.S ${lieu}. Votre proposition n'a plus lieu d'être.`,
          data: { sos_session_id: session.id },
          is_read: false,
        })),
      ];
      if (notifs.length > 0) await supabase.from('notifications').insert(notifs);

      await supabase.from('sos_sessions').update({ status: 'cancelled' }).eq('id', session.id);
      lsClear();
      toast.success(applyPenalty
        ? `S.O.S annulé. ${notifs.length} freelance(s) notifié(s) · pénalité de ${penaltyTotal.toLocaleString('fr-CI')} FCFA enregistrée.`
        : `S.O.S annulé. ${notifs.length} freelance(s) notifié(s).`);
      onReset();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erreur lors de l'annulation");
    } finally { setCancelling(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Bannière SOS active ── */}
      <div className="card-glass overflow-hidden">
        <div style={{ background: 'linear-gradient(135deg,#1a0505,#2d0808)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Siren size={24} color="#fff" strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 3px' }}>
                Alerte S.O.S active
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,200,200,0.75)', margin: 0,
                display: 'flex', alignItems: 'center', gap: 5 }}>
                {(session.service_types?.length ? session.service_types.join(', ') : session.service_type)} · <MapPin size={12} /> {session.location}
              </p>
            </div>
            {/* Minuteur */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: urgentColor,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {mins}:{secs}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {expired ? 'EXPIRÉ' : 'restant'}
              </div>
            </div>
          </div>
        </div>

        {/* Barre de progression temporelle (30 min) */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{
            height: '100%', background: urgentColor,
            width: `${(timeLeft / 1800) * 100}%`,
            transition: 'width 1s linear, background 0.5s',
          }} />
        </div>
        {!expired && inFreeWindow && (
          <div style={{ padding: '8px 16px', background: 'rgba(0,200,150,0.08)',
            borderTop: '1px solid rgba(0,200,150,0.2)', fontSize: 12, color: '#00C896',
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={13} /> Annulation gratuite possible encore {freeMin} min.
          </div>
        )}

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1,
          background: 'rgba(255,255,255,0.04)' }}>
          {[
            { val: session.notified_count, label: 'Notifiés',    color: 'var(--color-gold-primary)' },
            { val: pending.length,         label: 'En attente',  color: '#f59e0b' },
            { val: confirmed.length,       label: `/${session.slots_needed} Confirmés`, color: '#10b981' },
          ].map(({ val, label, color }) => (
            <div key={label} style={{ padding: '14px 10px', textAlign: 'center',
              background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Barre remplissage postes */}
        <div style={{ padding: '10px 16px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Postes pourvus</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
              {confirmed.length}/{session.slots_needed}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{
              height: '100%', borderRadius: 999, transition: 'width 0.5s',
              background: 'linear-gradient(to right,#10b981,#34d399)',
              width: `${Math.min(100, (confirmed.length / session.slots_needed) * 100)}%`,
            }} />
          </div>
        </div>
      </div>

      {/* ── Propositions en attente ── */}
      <div className="card-glass p-5">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0,
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <Inbox size={16} color="var(--color-gold-primary)" /> Propositions reçues
          </h3>
          {pending.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
              background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.3)' }}>
              {pending.length} en attente
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Hourglass size={28} color="var(--color-text-muted)" /></div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {expired ? 'Session expirée — aucune réponse reçue.' : 'En attente de réponses des freelances...'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map(r => {
              const fl = r.freelance;
              const dist = (session.latitude != null && session.longitude != null && fl?.latitude != null && fl?.longitude != null)
                ? distanceKm(session.latitude, session.longitude, fl.latitude, fl.longitude) : null;
              return (
                <PropositionCard key={r.id} resp={r} distance={dist}
                  onConfirm={() => confirmResponse(r)}
                  onReject={() => rejectResponse(r)}
                  onViewProfile={() => navigate(`/public-profile?id=${r.freelance_id}`)}
                  busy={confirming === r.id}
                  canConfirm={confirmed.length < session.slots_needed}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Freelances confirmés ── */}
      {confirmed.length > 0 && (
        <div className="card-glass p-5">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#10b981', margin: '0 0 12px',
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} /> Équipe confirmée ({confirmed.length}/{session.slots_needed})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {confirmed.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981', minWidth: 20 }}>#{i+1}</span>
                <AvatarMini name={r.freelance?.full_name} src={r.freelance?.avatar_url} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                    {r.freelance?.full_name || '—'}
                  </p>
                  {r.freelance?.phone && (
                    <p style={{ fontSize: 11, color: 'var(--color-gold-primary)', margin: '2px 0 0',
                      display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Phone size={11} /> {r.freelance.phone}
                    </p>
                  )}
                </div>
                <button onClick={() => navigate(`/public-profile?id=${r.freelance_id}`)}
                  style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                    background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
                    color: 'var(--color-gold-primary)', cursor: 'pointer' }}>
                  Profil
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compte à rebours terminé → relancer ; sinon → annuler (avec compensation) */}
      {expired ? (
        <button onClick={async () => {
            await supabase.from('sos_sessions').update({ status: 'cancelled' })
              .eq('id', session.id).eq('status', 'active');
            lsClear(); onReset();
          }}
          style={{ padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: 'transparent', border: '1px solid rgba(201,168,76,0.25)',
            color: 'var(--color-gold-primary)', cursor: 'pointer' }}>
          + Nouvelle alerte S.O.S
        </button>
      ) : cancelStep ? (
        <div style={{ borderRadius: 12, padding: '14px 16px',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {inFreeWindow ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-primary)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Vous êtes dans le délai gratuit ({freeMin} min restante(s)). L'annulation est{' '}
              <strong style={{ color: '#00C896' }}>sans frais</strong>. Confirmer ?
            </p>
          ) : confirmed.length > 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-primary)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Attention : l'annulation après le délai gratuit entraîne des frais de{' '}
              <strong style={{ color: '#ef4444' }}>{penaltyTotal.toLocaleString('fr-CI')} FCFA</strong>{' '}
              (10 % du total de <strong style={{ color: 'var(--color-gold-primary)' }}>{totalDue.toLocaleString('fr-CI')} FCFA</strong>),
              répartis entre {confirmed.length} freelance(s) confirmé(s). Confirmer l'annulation ?
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-primary)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Aucun freelance confirmé — l'annulation est sans frais. Confirmer ?
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancelSos} disabled={cancelling}
              style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer',
                opacity: cancelling ? 0.6 : 1 }}>
              {cancelling ? '...' : (!inFreeWindow && confirmed.length > 0) ? 'Annuler et payer la pénalité' : "Confirmer l'annulation"}
            </button>
            <button onClick={() => setCancelStep(false)} disabled={cancelling}
              style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'transparent', border: '1px solid rgba(201,168,76,0.25)',
                color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              Retour
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCancelStep(true)}
          className="cta-glow"
          style={{ padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: 'transparent', border: '1px solid rgba(239,68,68,0.4)',
            color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <X size={16} /> Annuler le S.O.S
        </button>
      )}
    </div>
  );
}

/* ── Carte de proposition freelance ── */
function PropositionCard({ resp, distance, onConfirm, onReject, onViewProfile, busy, canConfirm }: {
  resp: SosResponse; distance?: number | null; onConfirm: () => void; onReject: () => void;
  onViewProfile: () => void; busy: boolean; canConfirm: boolean;
}) {
  const fl = resp.freelance;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden',
      background: 'var(--color-surface)', border: '1px solid rgba(201,168,76,0.12)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <AvatarMini name={fl?.full_name} src={fl?.avatar_url} size={40} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {fl?.full_name || '—'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {fl?.avg_rating && fl.avg_rating > 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-gold-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Star size={12} fill="var(--color-gold-primary)" /> {fl.avg_rating.toFixed(1)}
              </span>
            )}
            {distance != null && (
              <span style={{ fontSize: 11, color: '#00C896', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Navigation size={11} /> {formatDistance(distance)}
              </span>
            )}
            {fl?.ville && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} /> {fl.ville}
              </span>
            )}
          </div>
        </div>
        {fl?.phone && (
          <a href={`tel:${fl.phone}`} onClick={e => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
              borderRadius: 8, background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.3)',
              color: '#00C896', textDecoration: 'none', flexShrink: 0 }}>
            <Phone size={15} />
          </a>
        )}
        <button onClick={() => setShowDetails(v => !v)}
          style={{ fontSize: 11, color: 'var(--color-gold-primary)', background: 'transparent',
            border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {showDetails ? <><ChevronUp size={13} /> Moins</> : <><ChevronDown size={13} /> Détails</>}
          </span>
        </button>
      </div>

      {/* Détails dépliables */}
      {showDetails && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
          {fl?.skills && fl.skills.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {fl.skills.map(s => (
                <span key={s} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999,
                  background: 'rgba(201,168,76,0.1)', color: 'var(--color-gold-primary)',
                  border: '1px solid rgba(201,168,76,0.2)' }}>
                  {s}
                </span>
              ))}
            </div>
          )}
          <button onClick={onViewProfile}
            style={{ marginTop: 10, fontSize: 12, color: '#60a5fa', background: 'transparent',
              border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline',
              display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <User size={13} /> Voir le profil complet
          </button>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
        borderTop: '1px solid rgba(201,168,76,0.08)' }}>
        <button onClick={onReject} disabled={busy}
          style={{ padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(239,68,68,0.08)', border: 'none', borderRight: '1px solid rgba(201,168,76,0.08)',
            color: '#ef4444', opacity: busy ? 0.5 : 1, transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <X size={15} /> Refuser
        </button>
        <button onClick={onConfirm} disabled={busy || !canConfirm}
          style={{ padding: '11px', fontSize: 13, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed',
            background: canConfirm ? 'rgba(16,185,129,0.12)' : 'var(--color-surface)',
            border: 'none', color: canConfirm ? '#10b981' : 'var(--color-text-muted)',
            opacity: (busy || !canConfirm) ? 0.5 : 1, transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {busy ? '...' : !canConfirm ? 'Complet' : <><Check size={15} /> Confirmer</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   VUE FREELANCE
══════════════════════════════════════════════════════════════════════ */
function FreelanceView() {
  const { profile } = useAuth();
  const [activeSos, setActiveSos] = useState<SosSession | null>(null);
  const [myResponse, setMyResponse] = useState<SosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [dueComp, setDueComp] = useState(0);
  const [, forceTick] = useState(0);

  // Minuteur live (re-render chaque seconde tant qu'une alerte est active)
  useEffect(() => {
    if (!activeSos) return;
    const iv = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [activeSos]);

  useEffect(() => {
    if (!profile) return;
    fetchActiveSos();

    // Compensations dues (S.O.S annulés après le délai gratuit)
    supabase.from('sos_compensations').select('amount')
      .eq('freelance_id', profile.id).eq('status', 'due')
      .then(({ data }) => setDueComp((data || []).reduce((s, c) => s + Number(c.amount || 0), 0)));

    // Écouter confirmation en temps réel
    const ch = supabase.channel('freelance-sos-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sos_responses',
        filter: `freelance_id=eq.${profile.id}` }, (payload) => {
          const updated = payload.new as SosResponse;
          setMyResponse(prev => prev ? { ...prev, status: updated.status } : prev);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile]);

  async function fetchActiveSos() {
    if (!profile) return;
    // Source de vérité : les notifications S.O.S reçues (déjà filtrées à 30 km
    // au déclenchement). On affiche la session active correspondante.
    const { data: notifs } = await supabase.from('notifications')
      .select('data')
      .eq('user_id', profile.id)
      .eq('type', 'sos_alert')
      .order('created_at', { ascending: false })
      .limit(10);
    const ids = sosIdsFromNotifs(notifs);
    if (ids.length === 0) { setLoading(false); return; }

    const { data: sessions } = await supabase.from('sos_sessions')
      .select('*')
      .in('id', ids)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    const sos = sessions?.[0] as SosSession | undefined;
    if (sos) {
      setActiveSos(sos);
      // Vérifier si j'ai déjà répondu
      const { data: resp } = await supabase.from('sos_responses')
        .select('*').eq('sos_session_id', sos.id).eq('freelance_id', profile.id).maybeSingle();
      if (resp) setMyResponse(resp as SosResponse);
    }
    setLoading(false);
  }

  async function respond() {
    if (!profile || !activeSos) return;
    setResponding(true);
    try {
      // Re-vérifier la position actuelle (≤ 30 km) au moment de répondre
      if (activeSos.latitude != null && activeSos.longitude != null) {
        try {
          const c = await getBrowserPosition();
          await supabase.from('profiles')
            .update({ latitude: c.latitude, longitude: c.longitude }).eq('id', profile.id);
          const d = distanceKm(c.latitude, c.longitude, activeSos.latitude, activeSos.longitude);
          if (d > SOS_RADIUS_KM) {
            toast.error(`Vous êtes à ${formatDistance(d)} du lieu (max ${SOS_RADIUS_KM} km).`);
            setResponding(false); return;
          }
        } catch { /* position indisponible → on laisse répondre */ }
      }
      const { data, error } = await supabase.from('sos_responses').insert({
        sos_session_id: activeSos.id,
        freelance_id: profile.id,
        status: 'pending',
      }).select().single();
      if (error) throw error;
      setMyResponse(data as SosResponse);

      // Notifier l'organisateur qu'un freelance a répondu
      await supabase.from('notifications').insert({
        user_id: activeSos.organisateur_id,
        type: 'sos_alert',
        title: 'S.O.S Brigade — Nouvelle réponse',
        body: `${profile.full_name || 'Un freelance'} se propose pour "${activeSos.service_type}" à ${activeSos.location}.`,
        data: { sos_session_id: activeSos.id },
        is_read: false,
      });

      toast.success('Réponse envoyée ! En attente de confirmation...');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Erreur');
    } finally { setResponding(false); }
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3 animate-sos" style={{ width: 60, height: 60,
            borderRadius: '50%', background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            <Siren size={28} color="#fff" strokeWidth={2} />
          </div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>S.O.S Brigade</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Alerte urgente en cours dans votre zone</p>
        </div>

        {dueComp > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 16,
            borderRadius: 12, background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.3)' }}>
            <Wallet size={18} color="#00C896" />
            <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
              Compensation(s) due(s) : <strong style={{ color: '#00C896' }}>{formatCFA(dueComp)}</strong>
              <span style={{ color: 'var(--color-text-muted)' }}> — S.O.S annulés après le délai gratuit.</span>
            </span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>Chargement...</div>
        ) : !activeSos ? (
          <div className="card-glass p-8 text-center">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><BellOff size={38} color="var(--color-text-muted)" strokeWidth={1.5} /></div>
            <p style={{ color: 'var(--color-text-secondary)' }}>Aucune alerte S.O.S active dans votre zone.</p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Vous serez alerté dès qu'une urgence correspond à vos compétences.</p>
          </div>
        ) : !myResponse ? (
          /* ── Pas encore répondu ── */
          <div className="card-glass overflow-hidden">
            <div style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', padding: '20px 24px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Siren size={30} color="#fff" strokeWidth={2} /></div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>URGENCE — Répondez maintenant</h2>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {(() => {
                  const types = activeSos.service_types?.length ? activeSos.service_types.join(', ') : activeSos.service_type;
                  const tl = Math.max(0, Math.floor((new Date(activeSos.expires_at).getTime() - Date.now()) / 1000));
                  const mmss = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`;
                  const total = (activeSos.hourly_rate || 0) * (activeSos.estimated_hours || 0);
                  const remu = total > 0 ? `${formatCFA(activeSos.hourly_rate || 0)}/h · ${formatCFA(total)} estimé` : '—';
                  const dist = (profile?.latitude != null && profile?.longitude != null && activeSos.latitude != null && activeSos.longitude != null)
                    ? `À ${formatDistance(distanceKm(profile.latitude, profile.longitude, activeSos.latitude, activeSos.longitude))} de vous` : null;
                  const rows: { Icon: LucideIcon; label: string; val: string }[] = [
                    { Icon: Target, label: 'Prestation(s)', val: types },
                    { Icon: MapPin, label: 'Lieu', val: dist ? `${activeSos.location} — ${dist}` : activeSos.location },
                    { Icon: Wallet, label: 'Rémunération', val: remu },
                    { Icon: Users, label: 'Postes', val: `${activeSos.slots_needed} poste(s) disponible(s)` },
                    { Icon: Clock, label: 'Expire dans', val: mmss },
                  ];
                  return rows.map(({ Icon, label, val }) => (
                    <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
                      padding: '10px 14px', borderRadius: 10, background: 'var(--color-surface)' }}>
                      <span style={{ flexShrink: 0, marginTop: 1 }}><Icon size={18} color="var(--color-gold-primary)" /></span>
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>{label}</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: '2px 0 0' }}>{val}</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
              {activeSos.latitude != null && activeSos.longitude != null && (
                <div style={{ marginBottom: 20 }}>
                  <MapView lat={activeSos.latitude} lng={activeSos.longitude} label={activeSos.location} zoom={14} />
                </div>
              )}
              <button onClick={respond} disabled={responding}
                style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 16, fontWeight: 800,
                  background: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'none', color: '#fff',
                  cursor: 'pointer', opacity: responding ? 0.7 : 1 }}>
                {responding ? 'Envoi...' : <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Zap size={19} fill="#fff" /> Je suis disponible — Je réponds !</span>}
              </button>
            </div>
          </div>
        ) : myResponse.status === 'pending' ? (
          /* ── En attente de confirmation ── */
          <div className="card-glass p-8 text-center">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Hourglass size={44} color="#f59e0b" /></div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>
              Réponse envoyée !
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
              Votre candidature pour <strong style={{ color: 'var(--color-gold-primary)' }}>{activeSos.service_type}</strong>
              <br />à <strong style={{ color: 'var(--color-gold-primary)' }}>{activeSos.location}</strong>
              <br />est en attente de confirmation par l'organisateur.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 20px', borderRadius: 10, background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b',
                animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>En attente de l'organisateur...</span>
            </div>
          </div>
        ) : myResponse.status === 'confirmed' ? (
          /* ── Confirmé ! ── */
          <div className="card-glass p-8 text-center">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><CheckCircle2 size={52} color="#10b981" /></div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#10b981', margin: '0 0 10px' }}>
              Vous êtes confirmé !
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              L'organisateur vous a sélectionné pour le poste<br />
              <strong style={{ color: 'var(--color-gold-primary)' }}>{activeSos.service_type}</strong><br />
              Rendez-vous à : <strong style={{ color: 'var(--color-text-primary)' }}>{activeSos.location}</strong>
            </p>
          </div>
        ) : (
          /* ── Refusé ── */
          <div className="card-glass p-8 text-center">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><XCircle size={46} color="#ef4444" strokeWidth={1.6} /></div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', margin: '0 0 10px' }}>
              Non retenu
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              Vous n'avez pas été retenu pour cette alerte.<br />Restez disponible pour les prochaines !
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function AvatarMini({ name, src, size = 34 }: { name?: string | null; src?: string | null; size?: number }) {
  const initials = (name || 'U').split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || 'U';
  return src
    ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 800,
        color: '#261642', background: 'linear-gradient(135deg,var(--color-gold-primary),var(--color-gold-light))' }}>
        {initials}
      </div>;
}
