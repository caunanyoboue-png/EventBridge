import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials } from '../../lib/utils';
import Logo from '../Logo';
import { rolePal } from '../../lib/roleTheme';
import {
  IcoDashboard, IcoMissions, IcoUsers, IcoMessages, IcoClipboard, IcoDoc,
  IcoPerson, IcoDashAdmin, IcoShield, IcoStar, IcoGear, IcoWallet, IcoLogout, IcoFeed, IcoSOS,
} from '../icons/DoodleIcons';

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
  { Icon: IcoWallet,     label: 'Portefeuille',      path: '/wallet'               },
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
  { Icon: IcoWallet,     label: 'Portefeuille',      path: '/wallet'                 },
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
  const pal = rolePal(profile?.role);

  const bg   = glassy ? 'rgba(30,42,68,0.82)' : '#1e2a44';
  const bdr  = 'rgba(255,255,255,0.08)';
  const blur = glassy ? 'blur(22px)' : undefined;

  return (
    <aside
      className={`eb-sidebar eb-on-navy${isOpen ? ' open' : ''}`}
      style={{ width: 240, height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 40,
        display: 'flex', flexDirection: 'column', padding: '20px 16px',
        background: bg, backdropFilter: blur, borderRight: `1px solid ${bdr}` }}
    >
      {/* Bouton fermeture mobile */}
      {onClose && (
        <button className="eb-sidebar-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="var(--color-gold-primary)" strokeWidth="1.6" strokeLinecap="round"/>
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
          background: glassy ? 'rgba(255,255,255,0.05)' : 'var(--color-card-bg)',
          border: '1px solid rgba(201,168,76,0.1)' }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#261642',
              background: 'linear-gradient(135deg,var(--color-gold-primary),var(--color-gold-light))' }}>
              {getInitials(profile.full_name || 'U')}
            </div>
          )}
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
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
          border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
        <IcoLogout /> Déconnexion
      </button>
    </aside>
  );
}
