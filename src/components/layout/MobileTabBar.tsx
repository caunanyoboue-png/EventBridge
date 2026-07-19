import { type ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { rolePal } from '../../lib/roleTheme';
import {
  IcoFeed, IcoMissions, IcoDoc, IcoMessages, IcoPerson, IcoDashboard, IcoUsers,
  IcoStar, IcoGear, IcoClipboard, IcoDashAdmin, IcoShield, IcoWallet, IcoPlus, IcoGrid,
  type IconProps,
} from '../icons/DoodleIcons';

type IconCmp = (p: IconProps) => ReactNode;
interface Item { Icon: IconCmp; label: string; path: string; }
interface RoleNav { left: Item[]; center: Item; right: Item[]; more: Item[]; }

// Composition de la barre par rôle : 2 onglets + bouton central + 1 onglet + « Plus ».
const NAV: Record<string, RoleNav> = {
  freelance: {
    left:   [{ Icon: IcoFeed, label: 'Fil', path: '/feed' }, { Icon: IcoDoc, label: 'Candidatures', path: '/my-applications' }],
    center:  { Icon: IcoMissions, label: 'Missions', path: '/missions' },
    right:  [{ Icon: IcoMessages, label: 'Messages', path: '/messages' }],
    more:   [
      { Icon: IcoDashboard, label: 'Tableau de bord', path: '/freelance-dashboard' },
      { Icon: IcoUsers, label: 'Freelances', path: '/freelances' },
      { Icon: IcoPerson, label: 'Mon profil', path: '/profile' },
      { Icon: IcoStar, label: 'Certification', path: '/certification' },
      { Icon: IcoGear, label: 'Paramètres', path: '/settings' },
    ],
  },
  organisateur: {
    left:   [{ Icon: IcoFeed, label: 'Fil', path: '/feed' }, { Icon: IcoMissions, label: 'Missions', path: '/missions' }],
    center:  { Icon: IcoPlus, label: 'Publier', path: '/create-mission' },
    right:  [{ Icon: IcoMessages, label: 'Messages', path: '/messages' }],
    more:   [
      { Icon: IcoDashboard, label: 'Tableau de bord', path: '/organisateur-dashboard' },
      { Icon: IcoUsers, label: 'Freelances', path: '/freelances' },
      { Icon: IcoClipboard, label: 'Mes missions', path: '/my-missions' },
      { Icon: IcoPerson, label: 'Mon profil', path: '/profile' },
      { Icon: IcoGear, label: 'Paramètres', path: '/settings' },
    ],
  },
  admin: {
    left:   [{ Icon: IcoDashAdmin, label: 'Supervision', path: '/admin/AdminDashboard' }, { Icon: IcoUsers, label: 'Profils', path: '/admin/AdminProfiles' }],
    center:  { Icon: IcoMissions, label: 'Missions', path: '/admin/AdminMissions' },
    right:  [{ Icon: IcoShield, label: 'Litiges', path: '/admin/AdminDisputes' }],
    more:   [
      { Icon: IcoStar, label: 'Avis', path: '/admin/AdminReviews' },
      { Icon: IcoWallet, label: 'Versements', path: '/admin/AdminPayouts' },
      { Icon: IcoGear, label: 'Paramètres', path: '/admin/AdminSettings' },
    ],
  },
};

// Dégradé + couleur d'icône du bouton central selon le côté.
const CENTER: Record<string, { grad: string; on: string }> = {
  freelance:    { grad: 'linear-gradient(135deg,#d4af37,#e8c97a)', on: '#261642' },
  organisateur: { grad: 'linear-gradient(135deg,#3b82f6,#60a5fa)', on: '#ffffff' },
  admin:        { grad: 'linear-gradient(135deg,#16a34a,#4ade80)', on: '#06281a' },
};

const MUTED = '#7d6f90';

export default function MobileTabBar() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [sheet, setSheet] = useState(false);

  if (!profile) return null;
  const role = profile.role === 'admin' ? 'admin' : profile.role === 'organisateur' ? 'organisateur' : 'freelance';
  const pal = rolePal(role);
  const cfg = NAV[role];
  const cs = CENTER[role];
  const isActive = (p: string) => loc.pathname === p;

  const Tab = ({ item }: { item: Item }) => {
    const on = isActive(item.path);
    const col = on ? pal.active : MUTED;
    return (
      <button onClick={() => nav(item.path)} className="eb-tab" style={{ color: col }}>
        <item.Icon size={22} color={col} />
        <span style={{ fontSize: 11, fontWeight: on ? 600 : 400 }}>{item.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className="eb-tabbar" aria-label="Navigation">
        {cfg.left.map(it => <Tab key={it.path} item={it} />)}

        {/* Bouton central surélevé (action clé du rôle) */}
        <button onClick={() => nav(cfg.center.path)} className="eb-tab-center" aria-label={cfg.center.label}>
          <span className="eb-cbtn" style={{ background: cs.grad }}>
            <cfg.center.Icon size={24} color={cs.on} />
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: pal.active }}>{cfg.center.label}</span>
        </button>

        {cfg.right.map(it => <Tab key={it.path} item={it} />)}

        <button onClick={() => setSheet(true)} className="eb-tab" style={{ color: sheet ? pal.active : MUTED }}>
          <IcoGrid size={22} color={sheet ? pal.active : MUTED} />
          <span style={{ fontSize: 11, fontWeight: sheet ? 600 : 400 }}>Plus</span>
        </button>
      </nav>

      {sheet && (
        <div className="eb-sheet-ov" onClick={() => setSheet(false)}>
          <div className="eb-sheet" onClick={e => e.stopPropagation()}>
            <div className="eb-sheet-handle" />
            {cfg.more.map(it => {
              const on = isActive(it.path);
              return (
                <button key={it.path} className="eb-sheet-row"
                  onClick={() => { setSheet(false); nav(it.path); }}
                  style={{ color: on ? pal.active : '#f0e6d3' }}>
                  <it.Icon size={20} color={on ? pal.active : '#b8a898'} />
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
