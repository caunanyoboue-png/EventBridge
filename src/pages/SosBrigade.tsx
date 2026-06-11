import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type SosSession } from '../types';
import toast from 'react-hot-toast';

const SERVICE_TYPES = [
  'Service en salle', 'Bar / Barman', 'Cuisine gastronomique', 'Hôtesse accueil',
  'Animation', 'Son & Lumière', 'Sécurité', 'Chauffeur', 'Manutention',
];

type SosResponse = {
  id: string;
  status: 'pending' | 'confirmed' | 'rejected';
  freelance_id: string;
  freelance?: { full_name: string | null; avatar_url: string | null; skills: string[] | null; avg_rating: number | null };
};

/* ──────────────────────────────────────────────────────────────────── */
export default function SosBrigade() {
  const { profile } = useAuth();

  if (!profile) return null;
  if (profile.role === 'freelance') return <FreelanceView />;
  return <OrgView />;
}

/* ══════════════════════════════════════════════════════════════════════
   VUE ORGANISATEUR
══════════════════════════════════════════════════════════════════════ */
function OrgView() {
  const { profile } = useAuth();
  const [form, setForm] = useState({ service_type: '', location: '', slots_needed: 3, message: '' });
  const [session, setSession] = useState<SosSession | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none";
  const inputStyle = { background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' };

  async function declencher() {
    if (!profile || !form.service_type || !form.location) return;
    setLoading(true);
    try {
      const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from('sos_sessions').insert({
        organisateur_id: profile.id,
        service_type: form.service_type,
        location: form.location,
        slots_needed: form.slots_needed,
        slots_confirmed: 0,
        radius_km: 10,
        notified_count: 0,
        status: 'active',
        expires_at,
        message: form.message || null,
      }).select().single();
      if (error) throw error;

      // Notifier les freelances disponibles avec la compétence
      const { data: freelances } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'freelance')
        .eq('is_available', true)
        .contains('skills', [form.service_type])
        .neq('id', profile.id);

      const targets = freelances || [];
      if (targets.length > 0) {
        await supabase.from('notifications').insert(
          targets.map(f => ({
            user_id: f.id,
            type: 'sos_alert',
            title: '🚨 S.O.S Brigade — Urgence !',
            body: `Besoin urgent de ${form.service_type} à ${form.location}. ${form.slots_needed} poste(s) disponible(s).`,
            data: { sos_session_id: data.id },
            is_read: false,
          }))
        );
        await supabase.from('sos_sessions').update({ notified_count: targets.length }).eq('id', data.id);
        data.notified_count = targets.length;
      }

      setSession(data);
      toast.success(`🚨 Alerte déclenchée ! ${targets.length} freelance(s) notifié(s).`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Erreur lors du déclenchement');
    } finally { setLoading(false); }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 inline-block">🚨</div>
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
              <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>Nombre d'extras requis</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setForm(p => ({ ...p, slots_needed: Math.max(1, p.slots_needed - 1) }))}
                  className="w-12 h-12 rounded-xl font-bold text-xl"
                  style={{ background: 'rgba(82,54,124,0.5)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)' }}>-</button>
                <span className="text-3xl font-bold text-gold-gradient">{form.slots_needed}</span>
                <button onClick={() => setForm(p => ({ ...p, slots_needed: p.slots_needed + 1 }))}
                  className="w-12 h-12 rounded-xl font-bold text-xl"
                  style={{ background: 'rgba(82,54,124,0.5)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)' }}>+</button>
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Message (optionnel)</label>
              <textarea className={inputClass} style={{ ...inputStyle, resize: 'none' }} rows={3}
                placeholder="Précisions supplémentaires..."
                value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
            </div>
            <button onClick={declencher} disabled={loading || !form.service_type || !form.location}
              className="w-full py-4 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', opacity: (loading || !form.service_type || !form.location) ? 0.6 : 1 }}>
              {loading ? 'Déclenchement...' : '🚨 Déclencher l\'alerte S.O.S'}
            </button>
          </div>
        ) : (
          <OrgTracker session={session} onReset={() => setSession(null)} />
        )}
      </div>
    </DashboardLayout>
  );
}

/* ── Tracker organisateur avec liste des réponses ── */
function OrgTracker({ session, onReset }: { session: SosSession; onReset: () => void }) {
  const [responses, setResponses] = useState<SosResponse[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const timeLeft = Math.max(0, Math.round((new Date(session.expires_at).getTime() - Date.now()) / 60000));

  useEffect(() => {
    fetchResponses();
    // Temps réel : nouvelles réponses freelances
    const ch = supabase.channel('sos-org-tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_responses',
        filter: `sos_session_id=eq.${session.id}` }, () => fetchResponses())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session.id]);

  async function fetchResponses() {
    const { data } = await supabase.from('sos_responses')
      .select('id, status, freelance_id, freelance:profiles!freelance_id(full_name,avatar_url,skills,avg_rating)')
      .eq('sos_session_id', session.id)
      .order('responded_at', { ascending: true });
    setResponses((data || []) as unknown as SosResponse[]);
  }

  async function confirmResponse(resp: SosResponse) {
    setConfirming(resp.id);
    try {
      await supabase.from('sos_responses').update({ status: 'confirmed' }).eq('id', resp.id);
      await supabase.from('sos_sessions')
        .update({ slots_confirmed: responses.filter(r => r.status === 'confirmed').length + 1 })
        .eq('id', session.id);
      // Notification au freelance
      await supabase.from('notifications').insert({
        user_id: resp.freelance_id,
        type: 'sos_confirmed',
        title: '✅ S.O.S Brigade — Vous êtes confirmé !',
        body: `L'organisateur vous a confirmé pour le poste "${session.service_type}" à ${session.location}. Rendez-vous sur place !`,
        data: { sos_session_id: session.id },
        is_read: false,
      });
      toast.success('Freelance confirmé !');
      fetchResponses();
    } catch { toast.error('Erreur'); }
    finally { setConfirming(null); }
  }

  async function rejectResponse(resp: SosResponse) {
    await supabase.from('sos_responses').update({ status: 'rejected' }).eq('id', resp.id);
    await supabase.from('notifications').insert({
      user_id: resp.freelance_id,
      type: 'sos_rejected',
      title: '❌ S.O.S Brigade — Non retenu',
      body: `Vous n'avez pas été retenu pour ce poste S.O.S. Restez disponible pour les prochaines alertes !`,
      data: { sos_session_id: session.id },
      is_read: false,
    });
    fetchResponses();
  }

  const pending   = responses.filter(r => r.status === 'pending');
  const confirmed = responses.filter(r => r.status === 'confirmed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status card */}
      <div className="card-glass p-6 text-center">
        <div className="relative inline-flex items-center justify-center mb-6">
          {[1,2,3].map(i => (
            <div key={i} className="absolute rounded-full border-2 animate-ping-slow"
              style={{ width: `${i*60}px`, height: `${i*60}px`,
                borderColor: 'rgba(220,38,38,0.4)', animationDelay: `${i*0.4}s` }} />
          ))}
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl relative z-10"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>🚨</div>
        </div>
        <h2 className="text-xl font-bold text-gold-gradient mb-1">Recherche en cours...</h2>
        <p className="text-sm mb-4" style={{ color: '#b8a898' }}>{session.service_type} · {session.location}</p>
        <p className="text-xs mb-6" style={{ color: '#7a6a7a' }}>
          Rayon : {session.radius_km} km · Expire dans {timeLeft} min
        </p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { val: session.notified_count, label: 'Notifiés',  color: '#c9a84c' },
            { val: confirmed.length,       label: 'Confirmés', color: '#10b981' },
            { val: session.slots_needed,   label: 'Requis',    color: '#ef4444' },
          ].map(({ val, label, color }) => (
            <div key={label} className="card-glass p-3 text-center">
              <div className="text-2xl font-bold" style={{ color }}>{val}</div>
              <div className="text-xs mt-1" style={{ color: '#b8a898' }}>{label}</div>
            </div>
          ))}
        </div>
        {/* Barre progression */}
        <div className="w-full h-2 rounded-full mb-1" style={{ background: '#52367c' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, (confirmed.length / session.slots_needed) * 100)}%`,
              background: 'linear-gradient(to right,#10b981,#34d399)' }} />
        </div>
        <p className="text-xs" style={{ color: '#b8a898' }}>{confirmed.length}/{session.slots_needed} postes confirmés</p>
      </div>

      {/* Réponses en attente */}
      {pending.length > 0 && (
        <div className="card-glass p-5">
          <h3 className="font-semibold mb-4 text-sm" style={{ color: '#f0e6d3' }}>
            ⏳ En attente de confirmation ({pending.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(r => (
              <FreelanceResponseRow key={r.id} resp={r}
                onConfirm={() => confirmResponse(r)}
                onReject={() => rejectResponse(r)}
                busy={confirming === r.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmés */}
      {confirmed.length > 0 && (
        <div className="card-glass p-5">
          <h3 className="font-semibold mb-4 text-sm" style={{ color: '#10b981' }}>
            ✅ Confirmés ({confirmed.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {confirmed.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)' }}>
                <AvatarMini name={r.freelance?.full_name} src={r.freelance?.avatar_url} />
                <span style={{ fontSize: 13, color: '#f0e6d3' }}>{r.freelance?.full_name || '—'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#10b981', fontWeight: 700 }}>✅ Confirmé</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {responses.length === 0 && (
        <div className="card-glass p-6 text-center">
          <p style={{ color: '#b8a898', fontSize: 14 }}>En attente de réponses des freelances...</p>
        </div>
      )}

      <button onClick={onReset} className="btn-outline-gold px-6 py-2 rounded-xl text-sm">
        Nouvelle alerte S.O.S
      </button>
    </div>
  );
}

function FreelanceResponseRow({ resp, onConfirm, onReject, busy }: {
  resp: SosResponse; onConfirm: () => void; onReject: () => void; busy: boolean;
}) {
  const fl = resp.freelance;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      borderRadius: 10, background: 'rgba(82,54,124,0.3)', border: '1px solid rgba(201,168,76,0.1)' }}>
      <AvatarMini name={fl?.full_name} src={fl?.avatar_url} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3', margin: 0 }}>{fl?.full_name || '—'}</p>
        {fl?.avg_rating && fl.avg_rating > 0 && (
          <p style={{ fontSize: 11, color: '#c9a84c', margin: 0 }}>⭐ {fl.avg_rating.toFixed(1)}</p>
        )}
      </div>
      <button onClick={onReject} disabled={busy}
        style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
        Refuser
      </button>
      <button onClick={onConfirm} disabled={busy}
        style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none',
          color: '#fff', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
        {busy ? '…' : '✓ Confirmer'}
      </button>
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
    const skills = profile.skills || [];

    const { data: sos } = await supabase.from('sos_sessions')
      .select('*')
      .eq('status', 'active')
      .in('service_type', skills.length ? skills : ['__none__'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
      toast.success('Réponse envoyée ! En attente de confirmation...');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Erreur');
    } finally { setResponding(false); }
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🚨</div>
          <h1 className="font-display text-2xl font-bold" style={{ color: '#f0e6d3' }}>S.O.S Brigade</h1>
          <p className="mt-2 text-sm" style={{ color: '#b8a898' }}>Alerte urgente en cours dans votre zone</p>
        </div>

        {loading ? (
          <div className="text-center py-12" style={{ color: '#b8a898' }}>Chargement...</div>
        ) : !activeSos ? (
          <div className="card-glass p-8 text-center">
            <p style={{ fontSize: 36, marginBottom: 12 }}>😴</p>
            <p style={{ color: '#b8a898' }}>Aucune alerte S.O.S active dans votre zone.</p>
            <p className="text-sm mt-2" style={{ color: '#5a4a6a' }}>Vous serez alerté dès qu'une urgence correspond à vos compétences.</p>
          </div>
        ) : !myResponse ? (
          /* ── Pas encore répondu ── */
          <div className="card-glass overflow-hidden">
            <div style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', padding: '20px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 28, margin: '0 0 6px' }}>🚨</p>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>URGENCE — Répondez maintenant</h2>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {[
                  { icon: '🎯', label: 'Prestation', val: activeSos.service_type },
                  { icon: '📍', label: 'Lieu',       val: activeSos.location },
                  { icon: '👥', label: 'Postes',     val: `${activeSos.slots_needed} poste(s) disponible(s)` },
                  { icon: '⏰', label: 'Expire dans', val: `${Math.max(0, Math.round((new Date(activeSos.expires_at).getTime() - Date.now()) / 60000))} min` },
                ].map(({ icon, label, val }) => (
                  <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '10px 14px', borderRadius: 10, background: 'rgba(82,54,124,0.3)' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
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
                {responding ? 'Envoi...' : '🚀 Je suis disponible — Je réponds !'}
              </button>
            </div>
          </div>
        ) : myResponse.status === 'pending' ? (
          /* ── En attente de confirmation ── */
          <div className="card-glass p-8 text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0e6d3', margin: '0 0 10px' }}>
              Réponse envoyée !
            </h2>
            <p style={{ fontSize: 14, color: '#b8a898', lineHeight: 1.7, marginBottom: 20 }}>
              Votre candidature pour <strong style={{ color: '#c9a84c' }}>{activeSos.service_type}</strong>
              <br />à <strong style={{ color: '#c9a84c' }}>{activeSos.location}</strong>
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
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#10b981', margin: '0 0 10px' }}>
              Vous êtes confirmé !
            </h2>
            <p style={{ fontSize: 14, color: '#b8a898', lineHeight: 1.7 }}>
              L'organisateur vous a sélectionné pour le poste<br />
              <strong style={{ color: '#c9a84c' }}>{activeSos.service_type}</strong><br />
              Rendez-vous à : <strong style={{ color: '#f0e6d3' }}>{activeSos.location}</strong>
            </p>
          </div>
        ) : (
          /* ── Refusé ── */
          <div className="card-glass p-8 text-center">
            <div style={{ fontSize: 48, marginBottom: 16 }}>😔</div>
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

function AvatarMini({ name, src }: { name?: string | null; src?: string | null }) {
  const initials = (name || 'U').split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || 'U';
  return src
    ? <img src={src} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
        color: '#261642', background: 'linear-gradient(135deg,#c9a84c,#e8c97a)' }}>
        {initials}
      </div>;
}
