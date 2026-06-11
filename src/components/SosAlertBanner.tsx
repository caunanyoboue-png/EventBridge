import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type SosData = {
  id: string;
  service_type: string;
  location: string;
  slots_needed: number;
  message?: string | null;
};

export default function SosAlertBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [sos, setSos] = useState<SosData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!profile || profile.role !== 'freelance' || !profile.is_available) return;

    const skills = profile.skills || [];
    if (!skills.length) return;

    // Vérifier si un SOS actif existe déjà au chargement
    checkExistingSos(skills);

    // Écouter les nouveaux SOS en temps réel
    const channel = supabase
      .channel('sos-banner-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sos_sessions',
      }, (payload) => {
        const data = payload.new as SosData & { status: string; expires_at: string };
        if (data.status !== 'active') return;
        if (!skills.includes(data.service_type)) return;
        if (new Date(data.expires_at) < new Date()) return;
        setSos(data);
        setVisible(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  async function checkExistingSos(skills: string[]) {
    const { data } = await supabase
      .from('sos_sessions')
      .select('id, service_type, location, slots_needed, message')
      .eq('status', 'active')
      .in('service_type', skills)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSos(data);
      setVisible(true);
    }
  }

  function handleRespond() {
    setVisible(false);
    navigate('/sos-brigade');
  }

  if (!visible || !sos) return null;

  return (
    <>
      <style>{`
        @keyframes sosSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes sosPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); }
          50%       { box-shadow: 0 0 0 12px rgba(220,38,38,0); }
        }
      `}</style>

      {/* Overlay semi-transparent */}
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 8000, backdropFilter: 'blur(3px)',
      }} onClick={() => setVisible(false)} />

      {/* Carte centrale */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 8001,
        width: '90%', maxWidth: 420,
        background: 'linear-gradient(135deg, #1a0a0a 0%, #2d0808 100%)',
        border: '2px solid rgba(220,38,38,0.6)',
        borderRadius: 20,
        padding: '32px 28px',
        textAlign: 'center',
        animation: 'sosSlideDown 0.35s ease',
        boxShadow: '0 0 60px rgba(220,38,38,0.4), 0 20px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Icône pulsante */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px',
          background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, animation: 'sosPulse 1.5s infinite',
        }}>
          🚨
        </div>

        {/* Ondes animées */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              position: 'absolute',
              width: 72 + i * 40,
              height: 72 + i * 40,
              top: -(72 + i * 40) / 2 - 18,
              borderRadius: '50%',
              border: '1.5px solid rgba(220,38,38,0.3)',
              animation: `sosPulse ${1 + i * 0.3}s ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
          🚨 S.O.S Brigade
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,200,200,0.85)', margin: '0 0 18px', fontWeight: 600 }}>
          Urgence dans votre zone !
        </p>

        {/* Infos */}
        <div style={{
          background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 20, textAlign: 'left',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,200,200,0.6)', minWidth: 70 }}>Besoin</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{sos.service_type}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,200,200,0.6)', minWidth: 70 }}>Lieu</span>
            <span style={{ fontSize: 13, color: '#f0e6d3' }}>{sos.location}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,200,200,0.6)', minWidth: 70 }}>Postes</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5' }}>{sos.slots_needed} poste(s) disponible(s)</span>
          </div>
          {sos.message && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(220,38,38,0.2)' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,200,200,0.7)', fontStyle: 'italic' }}>
                "{sos.message}"
              </span>
            </div>
          )}
        </div>

        {/* Boutons */}
        <button onClick={handleRespond} style={{
          width: '100%', padding: '14px',
          background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
          border: 'none', borderRadius: 12,
          color: '#fff', fontSize: 15, fontWeight: 800,
          cursor: 'pointer', marginBottom: 10,
          boxShadow: '0 4px 16px rgba(220,38,38,0.4)',
          transition: 'opacity 0.15s',
        }}>
          🚀 Répondre à l'alerte →
        </button>

        <button onClick={() => setVisible(false)} style={{
          width: '100%', padding: '10px',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12, color: 'rgba(255,255,255,0.45)',
          fontSize: 13, cursor: 'pointer',
        }}>
          Ignorer
        </button>
      </div>
    </>
  );
}
