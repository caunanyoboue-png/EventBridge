import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials } from '../../lib/utils';

const LOGO = '/logo.png.jpeg';

// ── SVG icons — aucun emoji ───────────────────────────────────────────────────
const IcoDashboard = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="1" y="1" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="9.5" y="1" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="1" y="9.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const IcoMissions = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <circle cx="8.5" cy="8.5" r="7" stroke="currentColor" strokeWidth="1.4"/>
    <circle cx="8.5" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
    <circle cx="8.5" cy="8.5" r="1" fill="currentColor"/>
  </svg>
);
const IcoUsers = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <circle cx="6.5" cy="5" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M1 15c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="13" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M13.5 10.5c1.8.6 3 2 3 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IcoMessages = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M14.5 2.5H2.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1H6l2.5 3 2.5-3h3.5a1 1 0 0 0 1-1V3.5a1 1 0 0 0-1-1Z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
);
const IcoClipboard = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="2" y="3" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 8l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 2v2M11 2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IcoDoc = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="2.5" y="1.5" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 6h7M5 9h7M5 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IcoPerson = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <circle cx="8.5" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M2 15.5c0-3.5 2.9-6.5 6.5-6.5s6.5 3 6.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IcoDashAdmin = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M2 10h4v5H2zM6.5 6h4v9h-4zM11 2h4v13h-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
);
const IcoShield = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M8.5 1L2 4v4.5c0 4 2.8 7.7 6.5 8.5C12.2 16.2 15 12.5 15 8.5V4L8.5 1Z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M5.5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcoStar = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M8.5 1.5l2.1 4.3 4.9.7-3.5 3.4.8 4.8-4.3-2.2-4.3 2.2.8-4.8L1.5 6.5l4.9-.7 2.1-4.3Z"
      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
);
const IcoGear = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <circle cx="8.5" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M8.5 1v2M8.5 14v2M1 8.5h2M14 8.5h2M3.1 3.1l1.4 1.4M12.5 12.5l1.4 1.4M3.1 13.9l1.4-1.4M12.5 4.5l1.4-1.4"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IcoLogout = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M7 14H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M11 11l3-2.5L11 6M14 8.5H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcoSOS = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M8.5 2a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M8.5 5.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="8.5" cy="12" r="1" fill="currentColor"/>
  </svg>
);

// ── Items de nav ──────────────────────────────────────────────────────────────
const NAV_ITEMS_FREELANCE = [
  { Icon: IcoDashboard,  label: 'Tableau de bord',  path: '/freelance-dashboard'  },
  { Icon: IcoMissions,   label: 'Missions',          path: '/missions'             },
  { Icon: IcoUsers,      label: 'Freelances',        path: '/freelances'           },
  { Icon: IcoMessages,   label: 'Messages',          path: '/messages'             },
  { Icon: IcoDoc,        label: 'Mes candidatures',  path: '/my-applications'      },
  { Icon: IcoPerson,     label: 'Mon profil',        path: '/profile'              },
];
const NAV_ITEMS_ORG = [
  { Icon: IcoDashboard,  label: 'Tableau de bord',  path: '/organisateur-dashboard' },
  { Icon: IcoMissions,   label: 'Missions',          path: '/missions'               },
  { Icon: IcoUsers,      label: 'Freelances',        path: '/freelances'             },
  { Icon: IcoMessages,   label: 'Messages',          path: '/messages'               },
  { Icon: IcoClipboard,  label: 'Mes missions',      path: '/my-missions'            },
  { Icon: IcoPerson,     label: 'Mon profil',        path: '/profile'                },
];
const ADMIN_ITEMS = [
  { Icon: IcoDashAdmin, label: 'Dashboard',    path: '/admin/AdminDashboard' },
  { Icon: IcoUsers,     label: 'Profils',      path: '/admin/AdminProfiles' },
  { Icon: IcoMissions,  label: 'Missions',     path: '/admin/AdminMissions' },
  { Icon: IcoShield,    label: 'Litiges',      path: '/admin/AdminDisputes' },
  { Icon: IcoStar,      label: 'Avis',         path: '/admin/AdminReviews' },
  { Icon: IcoGear,      label: 'Paramètres',   path: '/admin/AdminSettings' },
];

interface SidebarProps { glassy?: boolean }

export default function Sidebar({ glassy }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const navItems = profile?.role === 'admin'
    ? ADMIN_ITEMS
    : profile?.role === 'organisateur'
      ? NAV_ITEMS_ORG
      : NAV_ITEMS_FREELANCE;

  const bg   = glassy ? 'rgba(6,1,16,0.72)' : '#100420';
  const bdr  = glassy ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.1)';
  const blur = glassy ? 'blur(22px)' : undefined;

  return (
    <aside style={{ width: 240, height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 40,
      display: 'flex', flexDirection: 'column', padding: '20px 16px',
      background: bg, backdropFilter: blur, borderRight: `1px solid ${bdr}` }}>

      {/* Logo */}
      <NavLink to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 22, padding: '0 6px', textDecoration: 'none' }}>
        <img src={LOGO} style={{ height: 32, width: 'auto' }} alt="EventBridge" />
        <span className="text-gold-gradient" style={{ fontWeight: 800, fontSize: 15 }}>EventBridge</span>
      </NavLink>

      {/* Avatar utilisateur */}
      {profile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 12, marginBottom: 20,
          background: glassy ? 'rgba(255,255,255,0.05)' : 'rgba(45,27,78,0.6)',
          border: '1px solid rgba(201,168,76,0.1)' }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#1a0a2e',
              background: 'linear-gradient(135deg,#c9a84c,#e8c97a)' }}>
              {getInitials(profile.full_name || 'U')}
            </div>
          )}
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.full_name}
            </p>
            <p style={{ fontSize: 11, color: '#c9a84c', marginTop: 2, fontWeight: 500 }}>
              {profile.role === 'freelance' ? 'Freelance' : profile.role === 'organisateur' ? 'Organisateur' : 'Admin'}
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              textDecoration: 'none', transition: 'all 0.15s',
              background: isActive
                ? (glassy ? 'rgba(201,168,76,0.14)' : 'rgba(201,168,76,0.1)')
                : 'transparent',
              borderLeft: isActive ? '2.5px solid #c9a84c' : '2.5px solid transparent',
              color: isActive ? '#c9a84c' : (glassy ? 'rgba(240,230,211,0.7)' : '#b8a898'),
            })}>
            <item.Icon />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* SOS Brigade (organisateur) */}
      {profile?.role === 'organisateur' && (
        <button onClick={() => navigate('/sos-brigade')}
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
