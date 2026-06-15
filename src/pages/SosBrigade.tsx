import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import MapPicker from '../components/MapPicker';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { distanceKm } from '../lib/geo';
import { type SosSession } from '../types';
import {
  Siren, MapPin, Inbox, Hourglass, CheckCircle2, Phone, Star, User,
  X, Check, Target, Users, Clock, Zap, BellOff, XCircle, ChevronUp, ChevronDown,
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
  freelance?: { full_name: string | null; avatar_url: string | null; skills: string[] | null; avg_rating: number | null; phone?: string | null; ville?: string | null };
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
const SOS_RADIUS_KM = 30; // rayon de matching géographique

type SosSessionGeo = SosSession & { latitude?: number | null; longitude?: number | null };

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
    service_type: string; location: string; slots_needed: number; message: string;
    latitude: number | null; longitude: number | null;
  }>({ service_type: '', location: '', slots_needed: 3, message: '', latitude: null, longitude: null });
  const [loading, setLoading] = useState(false);

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
  const inputStyle = { background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' };

  async function declencher() {
    if (!profile || !form.service_type || !form.location || form.latitude == null || form.longitude == null) return;
    setLoading(true);
    try {
      const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from('sos_sessions').insert({
        organisateur_id: profile.id,
        service_type: form.service_type,
        location: form.location,
        latitude: form.latitude,
        longitude: form.longitude,
        slots_needed: form.slots_needed,
        slots_confirmed: 0,
        radius_km: SOS_RADIUS_KM,
        notified_count: 0,
        status: 'active',
        expires_at,
        message: form.message || null,
      }).select().single();
      if (error) throw error;

      // Notifier les freelances dispo + compétence + GÉOLOCALISÉS à ≤ 30 km du lieu
      const { data: freelances } = await supabase
        .from('profiles')
        .select('id, latitude, longitude')
        .eq('role', 'freelance')
        .eq('is_available', true)
        .contains('skills', [form.service_type])
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
            body: `Besoin urgent de ${form.service_type} à ${form.location}. ${form.slots_needed} poste(s) disponible(s).`,
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
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#b8a898' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #d4af37',
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
          <h1 className="font-display text-3xl font-bold" style={{ color: '#f0e6d3' }}>S.O.S Brigade</h1>
          <p className="mt-2" style={{ color: '#b8a898' }}>
            Besoin d'extras en urgence ? Mobilisez les freelances disponibles en moins de 10 minutes.
          </p>
        </div>

        {!session ? (
          <div className="card-glass p-8 space-y-5">
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Type de prestation *</label>
              <select className={inputClass} style={{ ...inputStyle, background: '#1e0f3c', cursor: 'pointer' }}
                value={form.service_type} onChange={e => setForm(p => ({ ...p, service_type: e.target.value }))}>
                <option value="">Sélectionner...</option>
                {SERVICE_TYPES.map(t => <option key={t} value={t} style={{ background: '#1e0f3c' }}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Adresse exacte *</label>
              <input className={inputClass} style={inputStyle}
                placeholder="Ex: Avenue Delafosse, Plateau, Abidjan"
                value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>
                Placez le lieu sur la carte * <span style={{ color: '#7a6a8a' }}>(centre du rayon de 30 km)</span>
              </label>
              <MapPicker lat={form.latitude} lng={form.longitude}
                onSelect={(lat, lng, addr) => setForm(p => ({
                  ...p, latitude: lat, longitude: lng, location: p.location.trim() ? p.location : addr,
                }))} />
              {form.latitude != null && form.longitude != null && (
                <p className="text-xs mt-2" style={{ color: '#00C896', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Check size={13} /> Lieu défini — seuls les freelances à moins de 30 km seront alertés.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>Nombre d'extras requis</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setForm(p => ({ ...p, slots_needed: Math.max(1, p.slots_needed - 1) }))}
                  className="w-12 h-12 rounded-xl font-bold text-xl"
                  style={{ background: 'rgba(82,54,124,0.5)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.2)' }}>-</button>
                <span className="text-3xl font-bold text-gold-gradient">{form.slots_needed}</span>
                <button onClick={() => setForm(p => ({ ...p, slots_needed: p.slots_needed + 1 }))}
                  className="w-12 h-12 rounded-xl font-bold text-xl"
                  style={{ background: 'rgba(82,54,124,0.5)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.2)' }}>+</button>
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Message (optionnel)</label>
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
              disabled={loading || !form.service_type || !form.location || !form.latitude || !form.longitude}
              className="w-full py-4 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                opacity: (loading || !form.service_type || !form.location || !form.latitude || !form.longitude) ? 0.6 : 1 }}>
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
  const [timeLeft, setTimeLeft] = useState(0);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Minuteur en temps réel */
  useEffect(() => {
    function tick() {
      const secs = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(secs);
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
      .select('id, status, freelance_id, freelance:profiles!freelance_id(full_name,avatar_url,skills,avg_rating,phone,ville)')
      .eq('sos_session_id', session.id)
      .order('responded_at', { ascending: true });
    setResponses((data || []) as unknown as SosResponse[]);
  }

  async function confirmResponse(resp: SosResponse) {
    setConfirming(resp.id);
    try {
      await supabase.from('sos_responses').update({ status: 'confirmed' }).eq('id', resp.id);
      const confirmedCount = responses.filter(r => r.status === 'confirmed').length + 1;
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
                {session.service_type} · <MapPin size={12} /> {session.location}
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

        {/* Barre de progression temporelle */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{
            height: '100%', background: urgentColor,
            width: `${(timeLeft / 1800) * 100}%`,
            transition: 'width 1s linear, background 0.5s',
          }} />
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1,
          background: 'rgba(255,255,255,0.04)' }}>
          {[
            { val: session.notified_count, label: 'Notifiés',    color: '#d4af37' },
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
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f0e6d3', margin: 0,
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <Inbox size={16} color="#d4af37" /> Propositions reçues
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
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Hourglass size={28} color="#7a6a8a" /></div>
            <p style={{ fontSize: 13, color: '#7a6a8a' }}>
              {expired ? 'Session expirée — aucune réponse reçue.' : 'En attente de réponses des freelances...'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map(r => (
              <PropositionCard key={r.id} resp={r}
                onConfirm={() => confirmResponse(r)}
                onReject={() => rejectResponse(r)}
                onViewProfile={() => navigate(`/public-profile?id=${r.freelance_id}`)}
                busy={confirming === r.id}
                canConfirm={confirmed.length < session.slots_needed}
              />
            ))}
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
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3', margin: 0 }}>
                    {r.freelance?.full_name || '—'}
                  </p>
                  {r.freelance?.phone && (
                    <p style={{ fontSize: 11, color: '#d4af37', margin: '2px 0 0',
                      display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Phone size={11} /> {r.freelance.phone}
                    </p>
                  )}
                </div>
                <button onClick={() => navigate(`/public-profile?id=${r.freelance_id}`)}
                  style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                    background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
                    color: '#d4af37', cursor: 'pointer' }}>
                  Profil
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relancer une alerte est verrouillé tant que le compte à rebours tourne */}
      {expired ? (
        <button onClick={async () => {
            await supabase.from('sos_sessions').update({ status: 'cancelled' })
              .eq('id', session.id).eq('status', 'active');
            lsClear(); onReset();
          }}
          style={{ padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: 'transparent', border: '1px solid rgba(201,168,76,0.25)',
            color: '#d4af37', cursor: 'pointer' }}>
          + Nouvelle alerte S.O.S
        </button>
      ) : (
        <p style={{ padding: '11px', borderRadius: 12, fontSize: 12, textAlign: 'center',
          background: 'rgba(82,54,124,0.25)', border: '1px solid rgba(201,168,76,0.12)',
          color: '#A0A0B8', margin: 0 }}>
          Vous pourrez lancer une nouvelle alerte à la fin du compte à rebours.
        </p>
      )}
    </div>
  );
}

/* ── Carte de proposition freelance ── */
function PropositionCard({ resp, onConfirm, onReject, onViewProfile, busy, canConfirm }: {
  resp: SosResponse; onConfirm: () => void; onReject: () => void;
  onViewProfile: () => void; busy: boolean; canConfirm: boolean;
}) {
  const fl = resp.freelance;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden',
      background: 'rgba(82,54,124,0.25)', border: '1px solid rgba(201,168,76,0.12)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <AvatarMini name={fl?.full_name} src={fl?.avatar_url} size={40} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#f0e6d3', margin: 0 }}>
            {fl?.full_name || '—'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {fl?.avg_rating && fl.avg_rating > 0 && (
              <span style={{ fontSize: 12, color: '#d4af37', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Star size={12} fill="#d4af37" /> {fl.avg_rating.toFixed(1)}
              </span>
            )}
            {fl?.ville && (
              <span style={{ fontSize: 11, color: '#8a7a9a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} /> {fl.ville}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setShowDetails(v => !v)}
          style={{ fontSize: 11, color: '#d4af37', background: 'transparent',
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
                  background: 'rgba(201,168,76,0.1)', color: '#d4af37',
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
            background: canConfirm ? 'rgba(16,185,129,0.12)' : 'rgba(82,54,124,0.2)',
            border: 'none', color: canConfirm ? '#10b981' : '#5a4a6a',
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

  useEffect(() => {
    if (!profile) return;
    fetchActiveSos();

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
    // Pas de position GPS activée → le freelance n'est pas disponible géographiquement.
    if (profile.latitude == null || profile.longitude == null) { setLoading(false); return; }
    const skills = profile.skills || [];

    const { data: list } = await supabase.from('sos_sessions')
      .select('*')
      .eq('status', 'active')
      .in('service_type', skills.length ? skills : ['__none__'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(8);

    // Ne garder que les alertes à ≤ 30 km de ma position.
    const sos = (list || []).find(s => {
      const g = s as SosSessionGeo;
      if (g.latitude == null || g.longitude == null) return false;
      return distanceKm(profile.latitude!, profile.longitude!, g.latitude, g.longitude) <= SOS_RADIUS_KM;
    }) as SosSession | undefined;

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
          <h1 className="font-display text-2xl font-bold" style={{ color: '#f0e6d3' }}>S.O.S Brigade</h1>
          <p className="mt-2 text-sm" style={{ color: '#b8a898' }}>Alerte urgente en cours dans votre zone</p>
        </div>

        {loading ? (
          <div className="text-center py-12" style={{ color: '#b8a898' }}>Chargement...</div>
        ) : !activeSos ? (
          <div className="card-glass p-8 text-center">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><BellOff size={38} color="#7a6a8a" strokeWidth={1.5} /></div>
            <p style={{ color: '#b8a898' }}>Aucune alerte S.O.S active dans votre zone.</p>
            <p className="text-sm mt-2" style={{ color: '#5a4a6a' }}>Vous serez alerté dès qu'une urgence correspond à vos compétences.</p>
          </div>
        ) : !myResponse ? (
          /* ── Pas encore répondu ── */
          <div className="card-glass overflow-hidden">
            <div style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', padding: '20px 24px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Siren size={30} color="#fff" strokeWidth={2} /></div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>URGENCE — Répondez maintenant</h2>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {([
                  { Icon: Target, label: 'Prestation', val: activeSos.service_type },
                  { Icon: MapPin, label: 'Lieu',       val: activeSos.location },
                  { Icon: Users,  label: 'Postes',     val: `${activeSos.slots_needed} poste(s) disponible(s)` },
                  { Icon: Clock,  label: 'Expire dans', val: `${Math.max(0, Math.round((new Date(activeSos.expires_at).getTime() - Date.now()) / 60000))} min` },
                ] as { Icon: LucideIcon; label: string; val: string }[]).map(({ Icon, label, val }) => (
                  <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '10px 14px', borderRadius: 10, background: 'rgba(82,54,124,0.3)' }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}><Icon size={18} color="#d4af37" /></span>
                    <div>
                      <p style={{ fontSize: 11, color: '#7a6a7a', margin: 0 }}>{label}</p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#f0e6d3', margin: '2px 0 0' }}>{val}</p>
                    </div>
                  </div>
                ))}
              </div>
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
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0e6d3', margin: '0 0 10px' }}>
              Réponse envoyée !
            </h2>
            <p style={{ fontSize: 14, color: '#b8a898', lineHeight: 1.7, marginBottom: 20 }}>
              Votre candidature pour <strong style={{ color: '#d4af37' }}>{activeSos.service_type}</strong>
              <br />à <strong style={{ color: '#d4af37' }}>{activeSos.location}</strong>
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
            <p style={{ fontSize: 14, color: '#b8a898', lineHeight: 1.7 }}>
              L'organisateur vous a sélectionné pour le poste<br />
              <strong style={{ color: '#d4af37' }}>{activeSos.service_type}</strong><br />
              Rendez-vous à : <strong style={{ color: '#f0e6d3' }}>{activeSos.location}</strong>
            </p>
          </div>
        ) : (
          /* ── Refusé ── */
          <div className="card-glass p-8 text-center">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><XCircle size={46} color="#ef4444" strokeWidth={1.6} /></div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', margin: '0 0 10px' }}>
              Non retenu
            </h2>
            <p style={{ fontSize: 14, color: '#b8a898' }}>
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
        color: '#261642', background: 'linear-gradient(135deg,#d4af37,#e8c97a)' }}>
        {initials}
      </div>;
}
