import { useState } from 'react';
import { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import NotificationBell from '../NotificationBell';
import SosAlertBanner from '../SosAlertBanner';

const LOGO = '/logo.png.jpeg';

interface Props {
  children: ReactNode;
  bgImage?: string;
}

export default function DashboardLayout({ children, bgImage }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
                <path d="M2 5h16M2 10h16M2 15h16" stroke="#c9a84c" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
            <img src={LOGO} alt="EventBridge" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
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
