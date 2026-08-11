import { useState } from 'react';
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileTabBar from './MobileTabBar';
import NotificationBell from '../NotificationBell';
import SosAlertBanner from '../SosAlertBanner';
import Logo from '../Logo';
import ThemeToggle from '../ThemeToggle';
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
      <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '12px 20px', background: 'var(--color-header-bg)',
          backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)' }}>
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Logo height={38} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ThemeToggle compact />
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
    <div className="eb-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg-primary)', position: 'relative' }}>
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
          {/* Gauche : logo (mobile only via CSS) — la nav passe en barre du bas */}
          <div className="eb-mobile-header" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
            <Logo height={36} />
          </div>

          {/* Espace vide sur desktop pour pousser la cloche à droite */}
          <div className="eb-desktop-spacer" style={{ flex: 1 }} />

          {/* Droite : S.O.S (organisateur, mobile) + cloche toujours visible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {profile.role === 'organisateur' && (
              <button className="eb-mobile-only animate-sos" onClick={() => navigate('/sos-brigade')}
                style={{ alignItems: 'center', gap: 6, background: '#dc2626', color: '#fff',
                  border: 'none', borderRadius: 999, padding: '8px 14px', fontWeight: 700, fontSize: 12,
                  boxShadow: '0 3px 10px rgba(220,38,38,0.35)', cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8.6"/><path d="M12 7.3v5.2"/><circle cx="12" cy="16" r=".9" fill="currentColor" stroke="none"/>
                </svg>
                S.O.S
              </button>
            )}
            <ThemeToggle compact />
            <NotificationBell />
          </div>
        </div>

        {children}
      </main>

      {/* Barre d'onglets — mobile uniquement (remplace le menu latéral) */}
      <MobileTabBar />
    </div>
  );
}
