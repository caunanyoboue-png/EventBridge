import { NavLink, useNavigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials } from '../../lib/utils';
import Logo from '../Logo';

// ── SVG icons — aucun emoji ───────────────────────────────────────────────────
// Style « doodle » : trait dessiné à la main, contours arrondis (couleur via currentColor).
function Dood({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
}
const IcoDashboard = () => <Dood>
  <rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2"/>
  <rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2"/>
  <rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2"/>
  <rect x="13.3" y="13.3" width="7.2" height="7.2" rx="2.2"/>
</Dood>;
const IcoMissions = () => <Dood>
  <rect x="3" y="7.5" width="18" height="12.5" rx="3"/>
  <path d="M8.5 7.5V6.2c0-1 .8-1.9 1.9-1.9h3.2c1 0 1.9.8 1.9 1.9v1.3"/>
  <path d="M3 12.5c2.9 1.4 5.9 2.1 9 2.1s6.1-.7 9-2.1"/>
</Dood>;
const IcoUsers = () => <Dood>
  <circle cx="9" cy="8" r="3.2"/>
  <path d="M3.5 19c.4-3.1 2.8-5 5.5-5s5.1 1.9 5.5 5"/>
  <path d="M16 5.4a3 3 0 0 1 .3 5.7"/>
  <path d="M17.2 14.2c1.9.6 3.1 2.2 3.3 4.6"/>
</Dood>;
const IcoMessages = () => <Dood>
  <path d="M20.5 12c0 3.7-3.8 6.6-8.5 6.6-1.1 0-2.2-.2-3.2-.5L4 20l1.4-3.6C4.5 15.3 4 13.7 4 12c0-3.7 3.8-6.6 8.5-6.6S20.5 8.3 20.5 12Z"/>
  <circle cx="9" cy="12" r=".85" fill="currentColor" stroke="none"/>
  <circle cx="12.5" cy="12" r=".85" fill="currentColor" stroke="none"/>
  <circle cx="16" cy="12" r=".85" fill="currentColor" stroke="none"/>
</Dood>;
const IcoClipboard = () => <Dood>
  <rect x="4.5" y="4.2" width="15" height="16.8" rx="3"/>
  <path d="M9 3.2h6c.7 0 1.2.6 1.2 1.2v1.1c0 .7-.5 1.2-1.2 1.2H9c-.7 0-1.2-.5-1.2-1.2V4.4c0-.6.5-1.2 1.2-1.2Z"/>
  <path d="M8.6 13.2l2.4 2.4 4.4-4.9"/>
</Dood>;
const IcoDoc = () => <Dood>
  <path d="M6.2 3.5h6.9c.3 0 .6.1.8.4l3.7 3.9c.2.2.3.5.3.8V19.6c0 1-.8 1.9-1.9 1.9H6.2c-1 0-1.9-.8-1.9-1.9V5.4c0-1 .8-1.9 1.9-1.9Z"/>
  <path d="M13 3.7V7c0 .8.6 1.4 1.4 1.4h3.2"/>
  <path d="M8.7 12.6h6.6M8.7 15.9h6.6M8.7 9.3h3"/>
</Dood>;
const IcoPerson = () => <Dood>
  <circle cx="12" cy="8" r="3.6"/>
  <path d="M5.2 20c.4-3.8 3.3-6.2 6.8-6.2s6.4 2.4 6.8 6.2"/>
</Dood>;
const IcoDashAdmin = () => <Dood>
  <path d="M4 20.5h16"/>
  <rect x="5.8" y="12" width="3.4" height="8.5" rx="1.3"/>
  <rect x="10.3" y="8" width="3.4" height="12.5" rx="1.3"/>
  <rect x="14.8" y="4.5" width="3.4" height="16" rx="1.3"/>
</Dood>;
const IcoShield = () => <Dood>
  <path d="M12 3.2l7.2 2.6v5.4c0 4.6-3.1 8.5-7.2 9.6-4.1-1.1-7.2-5-7.2-9.6V5.8L12 3.2Z"/>
  <path d="M8.8 12.2l2.2 2.2 4.2-4.6"/>
</Dood>;
const IcoStar = () => <Dood>
  <path d="M12 3.4l2.5 5.1 5.6.8-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6L3.9 9.3l5.6-.8L12 3.4Z"/>
</Dood>;
const IcoGear = () => <Dood>
  <circle cx="12" cy="12" r="3.3"/>
  <path d="M12 2.6v3.1M12 18.3v3.1M21.4 12h-3.1M5.7 12H2.6M18.7 5.3l-2.2 2.2M7.5 16.5l-2.2 2.2M18.7 18.7l-2.2-2.2M7.5 7.5 5.3 5.3"/>
</Dood>;
const IcoWallet = () => <Dood>
  <path d="M4 8.3C4 6.9 5.1 6 6.4 6H16c1.1 0 2 .9 2 2v.3"/>
  <rect x="3.5" y="8" width="17" height="11.5" rx="3"/>
  <path d="M20.5 12.6H16.2c-1.1 0-2 .8-2 1.9s.9 1.9 2 1.9h4.3"/>
  <circle cx="16.4" cy="14.5" r=".75" fill="currentColor" stroke="none"/>
</Dood>;
const IcoLogout = () => <Dood>
  <path d="M14 5.5H7.2c-1 0-1.7.8-1.7 1.7v9.6c0 1 .8 1.7 1.7 1.7H14"/>
  <path d="M18.8 12H10"/>
  <path d="M15.6 8.4 19.2 12l-3.6 3.6"/>
</Dood>;
const IcoFeed = () => <Dood>
  <path d="M4 5.5C4 4.7 4.7 4 5.5 4h10c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H5.5C4.7 20 4 19.3 4 18.5V5.5Z"/>
  <path d="M17 7.5h1.5C19.3 7.5 20 8.2 20 9v8c0 .8-.7 1.5-1.5 1.5"/>
  <path d="M7 8h6M7 11.5h6M7 15h4"/>
</Dood>;
const IcoSOS = () => <Dood>
  <circle cx="12" cy="12" r="8.6"/>
  <path d="M12 7.3v5.2"/>
  <circle cx="12" cy="16" r=".85" fill="currentColor" stroke="none"/>
</Dood>;

// ── Items de nav ──────────────────────────────────────────────────────────────
const NAV_ITEMS_FREELANCE = [
  { Icon: IcoFeed,       label: 'Fil d\'actualité', path: '/feed'                 },
  { Icon: IcoDashboard,  label: 'Tableau de bord',  path: '/freelance-dashboard'  },
  { Icon: IcoMissions,   label: 'Missions',          path: '/missions'             },
  { Icon: IcoUsers,      label: 'Freelances',        path: '/freelances'           },
  { Icon: IcoMessages,   label: 'Messages',          path: '/messages'             },
  { Icon: IcoDoc,        label: 'Mes candidatures',  path: '/my-applications'      },
  { Icon: IcoPerson,     label: 'Mon profil',        path: '/profile'              },
  { Icon: IcoStar,       label: 'Certification',     path: '/certification'        },
  { Icon: IcoGear,       label: 'Paramètres',        path: '/settings'             },
];
const NAV_ITEMS_ORG = [
  { Icon: IcoFeed,       label: 'Fil d\'actualité', path: '/feed'                   },
  { Icon: IcoDashboard,  label: 'Tableau de bord',  path: '/organisateur-dashboard' },
  { Icon: IcoMissions,   label: 'Missions',          path: '/missions'               },
  { Icon: IcoUsers,      label: 'Freelances',        path: '/freelances'             },
  { Icon: IcoMessages,   label: 'Messages',          path: '/messages'               },
  { Icon: IcoClipboard,  label: 'Mes missions',      path: '/my-missions'            },
  { Icon: IcoPerson,     label: 'Mon profil',        path: '/profile'                },
  { Icon: IcoGear,       label: 'Paramètres',        path: '/settings'               },
];
const ADMIN_ITEMS = [
  { Icon: IcoDashAdmin, label: 'Dashboard',    path: '/admin/AdminDashboard' },
  { Icon: IcoUsers,     label: 'Profils',      path: '/admin/AdminProfiles' },
  { Icon: IcoMissions,  label: 'Missions',     path: '/admin/AdminMissions' },
  { Icon: IcoShield,    label: 'Litiges',      path: '/admin/AdminDisputes' },
  { Icon: IcoStar,      label: 'Avis',         path: '/admin/AdminReviews' },
  { Icon: IcoWallet,    label: 'Versements',   path: '/admin/AdminPayouts' },
  { Icon: IcoGear,      label: 'Paramètres',   path: '/admin/AdminSettings' },
];

interface SidebarProps {
  glassy?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ glassy, isOpen, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const navItems = profile?.role === 'admin'
    ? ADMIN_ITEMS
    : profile?.role === 'organisateur'
      ? NAV_ITEMS_ORG
      : NAV_ITEMS_FREELANCE;

  // Couleur des icônes/onglets selon le côté (rôle) — actif = pleine, inactif = atténuée.
  const ROLE_PAL: Record<string, { active: string; inactive: string; bg: string; glow: string }> = {
    freelance:    { active: '#e8c97a', inactive: 'rgba(232,201,122,0.5)', bg: 'rgba(212,175,55,0.16)', glow: 'rgba(212,175,55,0.14)' },
    organisateur: { active: '#7cb3ff', inactive: 'rgba(124,179,255,0.5)', bg: 'rgba(96,165,250,0.16)', glow: 'rgba(96,165,250,0.14)' },
    admin:        { active: '#4ade80', inactive: 'rgba(74,222,128,0.5)',  bg: 'rgba(52,211,153,0.16)', glow: 'rgba(52,211,153,0.14)' },
  };
  const pal = ROLE_PAL[profile?.role ?? 'freelance'] ?? ROLE_PAL.freelance;

  const bg   = glassy ? 'rgba(6,1,16,0.72)' : '#100420';
  const bdr  = glassy ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.1)';
  const blur = glassy ? 'blur(22px)' : undefined;

  return (
    <aside
      className={`eb-sidebar${isOpen ? ' open' : ''}`}
      style={{ width: 240, height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 40,
        display: 'flex', flexDirection: 'column', padding: '20px 16px',
        background: bg, backdropFilter: blur, borderRight: `1px solid ${bdr}` }}
    >
      {/* Bouton fermeture mobile */}
      {onClose && (
        <button className="eb-sidebar-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="#d4af37" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* Logo */}
      <NavLink to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 22, padding: '0 6px', textDecoration: 'none' }}>
        <Logo height={42} />
      </NavLink>

      {/* Avatar utilisateur */}
      {profile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 12, marginBottom: 20,
          background: glassy ? 'rgba(255,255,255,0.05)' : 'rgba(61,39,100,0.6)',
          border: '1px solid rgba(201,168,76,0.1)' }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#261642',
              background: 'linear-gradient(135deg,#d4af37,#e8c97a)' }}>
              {getInitials(profile.full_name || 'U')}
            </div>
          )}
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.full_name}
            </p>
            <p style={{ fontSize: 11, color: pal.active, marginTop: 2, fontWeight: 500 }}>
              {profile.role === 'freelance' ? 'Freelance' : profile.role === 'organisateur' ? 'Organisateur' : 'Admin'}
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path} className="eb-nav-link"
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '11px 13px', borderRadius: 10, fontSize: 13.5,
              fontWeight: isActive ? 700 : 500,
              textDecoration: 'none', transition: 'all 0.18s',
              background: isActive ? pal.bg : 'transparent',
              borderLeft: isActive ? `3px solid ${pal.active}` : '3px solid transparent',
              boxShadow: isActive ? `inset 0 0 18px ${pal.glow}` : 'none',
              color: isActive ? pal.active : pal.inactive,
            })}>
            <item.Icon />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* SOS Brigade (organisateur) */}
      {profile?.role === 'organisateur' && (
        <button onClick={() => navigate('/sos-brigade')} className="animate-sos"
          style={{ marginTop: 12, width: '100%', padding: '11px', borderRadius: 10,
            fontWeight: 700, fontSize: 13, color: '#fff', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <IcoSOS /> S.O.S Brigade
        </button>
      )}

      {/* Déconnexion */}
      <button onClick={signOut}
        style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 10,
          fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'transparent',
          border: '1px solid rgba(239,68,68,0.2)', color: '#6a5a7a',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
        <IcoLogout /> Déconnexion
      </button>
    </aside>
  );
}
