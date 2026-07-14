import { useState } from 'react';
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from '../NotificationBell';
import SosAlertBanner from '../SosAlertBanner';
import Logo from '../Logo';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  children: ReactNode;
  bgImage?: string;
}

export default function DashboardLayout({ children, bgImage }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useAuth();
  const navigate = useNavigate();

  // ── Mode invité : en-tête public (pas de menu latéral ni notifications) ──
  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', background: '#261642' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(16,4,32,0.92)',
          backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Logo height={38} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/onboarding')}
              className="btn-outline-gold px-4 py-2 rounded-xl text-sm font-medium">
              Se connecter
            </button>
            <button onClick={() => navigate('/onboarding')}
              className="btn-gold px-4 py-2 rounded-xl text-sm font-bold text-[#261642]">
              S'inscrire
            </button>
          </div>
        </header>
        <main style={{ padding: '28px 20px 64px' }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#261642', position: 'relative' }}>
      {bgImage && (
        <>
          <img src={bgImage} alt="" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center', zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,1,16,0.74)', zIndex: 1, pointerEvents: 'none' }} />
        </>
      )}

      {/* Overlay mobile */}
      <div
        className={`eb-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        style={{ zIndex: 39 }}
      />

      <SosAlertBanner />
      <Sidebar glassy={!!bgImage} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main
        className="layout-main"
        style={{
          position: 'relative', zIndex: 2, flex: 1,
          marginLeft: 240, padding: '32px 28px',
          minHeight: '100vh', overflowY: 'auto',
        }}
      >
        {/* Top bar — cloche toujours visible, hamburger + logo sur mobile seulement */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 24, paddingBottom: 16,
            borderBottom: '1px solid rgba(201,168,76,0.07)',
          }}
        >
          {/* Gauche : hamburger + logo (mobile only via CSS) */}
          <div className="eb-mobile-header" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 5h16M2 10h16M2 15h16" stroke="#d4af37" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
            <Logo height={36} />
          </div>

          {/* Espace vide sur desktop pour pousser la cloche à droite */}
          <div className="eb-desktop-spacer" style={{ flex: 1 }} />

          {/* Droite : cloche toujours visible */}
          <NotificationBell />
        </div>

        {children}
      </main>
    </div>
  );
}
