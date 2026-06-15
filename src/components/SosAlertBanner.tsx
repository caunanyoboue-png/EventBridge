import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { distanceKm } from '../lib/geo';

const SOS_RADIUS_KM = 30;

type SosData = {
  id: string;
  service_type: string;
  location: string;
  slots_needed: number;
  message?: string | null;
  expires_at: string;
  latitude?: number | null;
  longitude?: number | null;
};

/* ── localStorage helpers ─────────────────────────────────────────── */
const LS_KEY = 'eb_sos_dismissed'; // Set<sosSessionId>

function isDismissed(sosId: string): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const ids: string[] = JSON.parse(raw);
    return ids.includes(sosId);
  } catch { return false; }
}

function dismiss(sosId: string) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(sosId)) ids.push(sosId);
    // Garder uniquement les 20 derniers pour ne pas remplir le localStorage
    localStorage.setItem(LS_KEY, JSON.stringify(ids.slice(-20)));
  } catch {}
}

/* ── Composant ────────────────────────────────────────────────────── */
export default function SosAlertBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [sos, setSos] = useState<SosData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!profile || profile.role !== 'freelance' || !profile.is_available) return;
    // Sans position GPS activée → pas d'alerte (le freelance n'est pas localisable).
    if (profile.latitude == null || profile.longitude == null) return;
    const myLat = profile.latitude, myLng = profile.longitude;

    const skills = profile.skills || [];
    if (!skills.length) return;

    checkExistingSos(skills);

    // Écouter les nouveaux SOS en temps réel
    const channel = supabase
      .channel('sos-banner-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sos_sessions',
      }, (payload) => {
        const data = payload.new as SosData & { status: string };
        if (data.status !== 'active') return;
        if (!skills.includes(data.service_type)) return;
        if (new Date(data.expires_at) < new Date()) return;
        if (isDismissed(data.id)) return; // Déjà ignoré
        // À moins de 30 km uniquement
        if (data.latitude == null || data.longitude == null) return;
        if (distanceKm(myLat, myLng, data.latitude, data.longitude) > SOS_RADIUS_KM) return;
        setSos(data);
        setVisible(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function checkExistingSos(skills: string[]) {
    if (!profile || profile.latitude == null || profile.longitude == null) return;
    const myLat = profile.latitude, myLng = profile.longitude;

    const { data: list } = await supabase
      .from('sos_sessions')
      .select('id, service_type, location, slots_needed, message, expires_at, latitude, longitude')
      .eq('status', 'active')
      .in('service_type', skills)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(8);

    // Première alerte à ≤ 30 km de ma position.
    const data = (list || []).find(s => {
      const g = s as SosData;
      if (g.latitude == null || g.longitude == null) return false;
      return distanceKm(myLat, myLng, g.latitude, g.longitude) <= SOS_RADIUS_KM;
    }) as SosData | undefined;

    if (!data) return;

    // Ne pas montrer si déjà ignoré
    if (isDismissed(data.id)) return;

    // Ne pas montrer si le freelance a déjà répondu (pending ou confirmed)
    const { data: existing } = await supabase
      .from('sos_responses')
      .select('id, status')
      .eq('sos_session_id', data.id)
      .eq('freelance_id', profile.id)
      .maybeSingle();

    if (existing) return; // Déjà répondu → ne pas réafficher

    setSos(data);
    setVisible(true);
  }

  function handleDismiss() {
    if (sos) dismiss(sos.id);
    setVisible(false);
  }

  function handleRespond() {
    if (sos) dismiss(sos.id); // Marquer comme traité
    setVisible(false);
    navigate('/sos-brigade');
  }

  if (!visible || !sos) return null;

  return (
    <>
      <style>{`
        @keyframes sosSlideDown {
          from { transform: translate(-50%,-60%); opacity: 0; }
          to   { transform: translate(-50%,-50%); opacity: 1; }
        }
        @keyframes sosPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); }
          50%       { box-shadow: 0 0 0 12px rgba(220,38,38,0); }
        }
      `}</style>

      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 8000, backdropFilter: 'blur(3px)',
      }} onClick={handleDismiss} />

      {/* Carte */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 8001, width: '90%', maxWidth: 420,
        background: 'linear-gradient(135deg, #1a0a0a 0%, #2d0808 100%)',
        border: '2px solid rgba(220,38,38,0.6)',
        borderRadius: 20, padding: '32px 28px', textAlign: 'center',
        animation: 'sosSlideDown 0.35s ease',
        boxShadow: '0 0 60px rgba(220,38,38,0.4), 0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px',
          background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'sosPulse 1.5s infinite',
        }}><Siren size={34} color="#fff" strokeWidth={2} /></div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Siren size={20} /> S.O.S Brigade
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,200,200,0.85)', margin: '0 0 18px', fontWeight: 600 }}>
          Urgence dans votre zone !
        </p>

        <div style={{
          background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 20, textAlign: 'left',
        }}>
          {[
            { label: 'Besoin', val: sos.service_type, bold: true },
            { label: 'Lieu',   val: sos.location,    bold: false },
            { label: 'Postes', val: `${sos.slots_needed} poste(s) disponible(s)`, bold: true },
          ].map(({ label, val, bold }) => (
            <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,200,200,0.6)', minWidth: 70 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400,
                color: bold ? '#fca5a5' : '#f0e6d3' }}>{val}</span>
            </div>
          ))}
          {sos.message && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(220,38,38,0.2)' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,200,200,0.7)', fontStyle: 'italic' }}>
                "{sos.message}"
              </span>
            </div>
          )}
        </div>

        <button onClick={handleRespond} style={{
          width: '100%', padding: '14px',
          background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
          border: 'none', borderRadius: 12, color: '#fff',
          fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 10,
          boxShadow: '0 4px 16px rgba(220,38,38,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Zap size={18} fill="#fff" /> Répondre à l'alerte
        </button>

        <button onClick={handleDismiss} style={{
          width: '100%', padding: '10px', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
          color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer',
        }}>
          Ignorer
        </button>
      </div>
    </>
  );
}
