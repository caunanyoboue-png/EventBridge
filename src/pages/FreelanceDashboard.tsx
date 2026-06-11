import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, MessageSquare,
  User, Settings, LogOut, ChevronRight,
  Send, CheckCircle, Star, Award, FileText,
  Menu, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        '#0f0a1e',
  sidebar:   '#13102a',
  card:      '#1a1232',
  gold:      '#c9a84c',
  goldLt:    '#e8c97a',
  text:      '#f0e6d3',
  textDim:   'rgba(240,230,211,0.4)',
  border:    'rgba(201,168,76,0.12)',
  cardBd:    'rgba(201,168,76,0.10)',
} as const;

const LOGO = '/logo.png.jpeg';

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { Icon: LayoutDashboard, label: "Fil d'actualité", path: '/feed' },
  { Icon: LayoutDashboard, label: 'Tableau de bord', path: '/freelance-dashboard' },
  { Icon: Briefcase,       label: 'Missions',        path: '/missions' },
  { Icon: Users,           label: 'Freelances',      path: '/freelances' },
  { Icon: MessageSquare,   label: 'Messages',        path: '/messages', badge: true },
  { Icon: User,            label: 'Mon profil',      path: '/profile' },
  { Icon: Settings,        label: 'Paramètres',      path: '/settings' },
];

// ─── NavItem ──────────────────────────────────────────────────────────────────
function NavItem({
  Icon, label, isActive, badge,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  isActive: boolean;
  badge?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 10, marginBottom: 2,
        cursor: 'pointer', transition: 'all 0.15s',
        background: isActive ? 'rgba(201,168,76,0.10)' : hov ? 'rgba(201,168,76,0.07)' : 'transparent',
        borderLeft: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
      }}
    >
      <Icon
        size={16}
        color={isActive ? C.gold : hov ? 'rgba(240,230,211,0.7)' : C.textDim}
      />
      <span style={{
        fontSize: 13, flex: 1,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? C.gold : hov ? 'rgba(240,230,211,0.7)' : 'rgba(240,230,211,0.45)',
      }}>
        {label}
      </span>
      {!!badge && (
        <span style={{
          background: C.gold, color: '#261642',
          borderRadius: 10, fontSize: 10, fontWeight: 600,
          padding: '1px 6px',
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon, iconBg, iconColor, value, label, sublabel, accent,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
  sublabel: string;
  accent: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: C.card,
        border: `1px solid ${hov ? 'rgba(201,168,76,0.25)' : C.cardBd}`,
        borderTop: `2px solid ${hov ? accent : 'transparent'}`,
        borderRadius: 16, padding: '20px 22px',
        transition: 'all 0.2s', cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: iconBg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: iconColor, display: 'flex' }}>{icon}</span>
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 500, color: C.text, lineHeight: 1 }}>{value}</div>
          <div style={{
            fontSize: 11, fontWeight: 500, marginTop: 6,
            color: 'rgba(201,168,76,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.8px',
          }}>
            {label}
          </div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{sublabel}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Quick-access button ──────────────────────────────────────────────────────
function QuickBtn({ label, color, bg, onClick }: {
  label: string; color: string; bg: string; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '11px 14px', borderRadius: 10,
        background: hov ? bg.replace('0.08', '0.14') : bg,
        border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', transition: 'all 0.15s',
        transform: hov ? 'translateX(2px)' : 'none',
        fontSize: 13, color, fontWeight: 500,
        textAlign: 'left',
      }}
    >
      {label}
      <ChevronRight size={14} color={color} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FreelanceDashboard() {
  const navigate = useNavigate();
  const { profile, signOut, user } = useAuth();

  const [unread, setUnread] = useState(0);
  const [stats, setStats] = useState({ total: 0, accepted: 0, completed: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [{ count: total }, { count: accepted }, { count: completed }, { count: msgs }] =
        await Promise.all([
          supabase.from('applications').select('*', { count: 'exact', head: true }).eq('freelance_id', user!.id),
          supabase.from('applications').select('*', { count: 'exact', head: true }).eq('freelance_id', user!.id).eq('status', 'accepted'),
          supabase.from('applications').select('*', { count: 'exact', head: true }).eq('freelance_id', user!.id).eq('status', 'completed'),
          supabase.from('conversations').select('*', { count: 'exact', head: true })
            .or(`participant_1.eq.${user!.id},participant_2.eq.${user!.id}`)
            .gt('unread_count_1', 0),
        ]);
      setStats({ total: total ?? 0, accepted: accepted ?? 0, completed: completed ?? 0 });
      setUnread(msgs ?? 0);
    }
    load();
  }, [user]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Utilisateur';
  const initials  = (profile?.full_name ?? '?')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const completionItems = [
    { label: 'Photo de profil',        done: !!profile?.avatar_url },
    { label: 'Bio complétée',          done: !!profile?.bio },
    { label: 'Compétences ajoutées',   done: !!(profile?.skills?.length) },
    { label: 'Ville renseignée',       done: !!profile?.ville },
    { label: 'Tarif horaire défini',   done: !!profile?.hourly_rate },
  ];
  const completionPct     = Math.round(completionItems.filter(i => i.done).length / completionItems.length * 100);
  const profileIncomplete = completionPct < 100;

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflowX: 'hidden' }}>

      {/* Overlay mobile */}
      <div className={`eb-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Spacer desktop pour compenser la sidebar fixed */}
      <div style={{ width: 220, flexShrink: 0 }} className="eb-desktop-spacer" />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className={`eb-sidebar${sidebarOpen ? ' open' : ''}`} style={{
        width: 220,
        background: C.sidebar, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 40,
        overflow: 'hidden',
      }}>
        {/* Bouton fermeture mobile */}
        <button className="eb-sidebar-close" onClick={() => setSidebarOpen(false)}>
          <X size={16} />
        </button>

        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center' }}>
          <img src={LOGO} alt="EventBridge" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, minHeight: 0, padding: '16px 10px', overflowY: 'auto' }}>
          {NAV.map(({ Icon, label, path, badge }) => (
            <NavLink key={path} to={path} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <NavItem Icon={Icon} label={label} isActive={isActive} badge={badge ? unread : 0} />
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '16px 14px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg,${C.gold},${C.goldLt})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, color: '#261642',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 500, color: C.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {profile?.full_name ?? 'Utilisateur'}
              </div>
              <div style={{ fontSize: 11, color: C.textDim }}>Freelance</div>
            </div>
          </div>
          <LogoutBtn onClick={handleSignOut} />
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar hamburger (mobile uniquement) */}
        <div className="eb-topbar">
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: C.gold, display: 'flex' }}>
            <Menu size={20} />
          </button>
          <img src={LOGO} alt="EventBridge" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          <div style={{ width: 36 }} />
        </div>

        {/* Hero band */}
        <div className="eb-hero-band" style={{
          height: 180, position: 'relative', overflow: 'hidden', flexShrink: 0,
          backgroundImage: 'url(/images/imgdefonddashboardfreelance.png)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(15,10,30,0.3) 0%, rgba(15,10,30,0.88) 100%)',
          }} />
          <div style={{
            position: 'absolute', bottom: 20, left: 32, right: 32,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, color: C.text }}>Bonjour, {firstName}</div>
              <div style={{ fontSize: 13, color: 'rgba(240,230,211,0.55)', marginTop: 2, textTransform: 'capitalize' }}>
                {today}
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(15,10,30,0.65)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(201,168,76,0.2)', borderRadius: 20,
              padding: '6px 14px', fontSize: 12, color: C.text,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#4ade80',
                animation: 'pulseGreen 1.5s ease-in-out infinite',
              }} />
              Disponible pour missions
            </div>
          </div>
          <style>{`
            @keyframes pulseGreen {
              0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
              50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
            }
          `}</style>
        </div>

        {/* Content */}
        <div className="eb-content-pad" style={{ padding: '24px 32px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

          {/* Incomplete profile banner */}
          {profileIncomplete && (
            <div style={{
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.2)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, color: '#86efac',
            }}>
              <CheckCircle size={15} />
              Complétez votre profil pour maximiser vos chances — {completionPct}% complété
            </div>
          )}

          {/* KPI grid */}
          <div className="eb-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
            <KpiCard
              icon={<Send size={18} />}
              iconBg="rgba(201,168,76,0.12)" iconColor={C.gold}
              value={stats.total} label="Candidatures"
              sublabel="envoyées au total" accent={C.gold}
            />
            <KpiCard
              icon={<CheckCircle size={18} />}
              iconBg="rgba(74,222,128,0.12)" iconColor="#4ade80"
              value={stats.accepted} label="Acceptées"
              sublabel="missions décrochées" accent="#4ade80"
            />
            <KpiCard
              icon={<Star size={18} />}
              iconBg="rgba(251,191,36,0.12)" iconColor="#fbbf24"
              value={profile?.avg_rating ? profile.avg_rating.toFixed(1) : '—'} label="Note moyenne"
              sublabel="sur 5 étoiles" accent="#fbbf24"
            />
            <KpiCard
              icon={<Award size={18} />}
              iconBg="rgba(139,92,246,0.12)" iconColor="#a78bfa"
              value={stats.completed} label="Missions réalisées"
              sublabel="avec succès" accent="#a78bfa"
            />
          </div>

          {/* 2-col layout */}
          <div className="eb-two-col" style={{ display: 'flex', gap: 20 }}>

            {/* Left: recent applications */}
            <div style={{ flex: 1 }}>
              <div style={{
                background: C.card, border: `1px solid ${C.cardBd}`,
                borderRadius: 16, padding: '22px 24px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 500, marginBottom: 20,
                  color: 'rgba(201,168,76,0.5)',
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                }}>
                  Mes candidatures récentes
                </div>

                {/* Empty state */}
                <div style={{ textAlign: 'center', padding: '36px 20px' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: 'rgba(201,168,76,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <FileText size={24} color="rgba(201,168,76,0.4)" />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                    Aucune candidature pour l'instant
                  </div>
                  <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20 }}>
                    Parcourez les missions disponibles et postulez pour commencer
                  </div>
                  <button
                    onClick={() => navigate('/missions')}
                    style={{
                      padding: '10px 22px', borderRadius: 10,
                      fontSize: 13, fontWeight: 500,
                      background: `linear-gradient(135deg,${C.gold},${C.goldLt})`,
                      color: '#261642', border: 'none', cursor: 'pointer',
                    }}
                  >
                    Voir les missions disponibles
                  </button>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="eb-right-col" style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Quick access */}
              <div style={{
                background: C.card, border: `1px solid ${C.cardBd}`,
                borderRadius: 16, padding: '22px 24px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 500, marginBottom: 14,
                  color: 'rgba(201,168,76,0.5)',
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                }}>
                  Accès rapide
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <QuickBtn label="Voir les missions"  color={C.gold}    bg="rgba(201,168,76,0.08)"  onClick={() => navigate('/missions')} />
                  <QuickBtn label="Mon profil"         color="#a78bfa"   bg="rgba(139,92,246,0.08)"  onClick={() => navigate('/profile')} />
                  <QuickBtn label="Messages"           color="#4ade80"   bg="rgba(74,222,128,0.08)"  onClick={() => navigate('/messages')} />
                </div>
              </div>

              {/* Profile completion */}
              <div style={{
                background: C.card, border: `1px solid ${C.cardBd}`,
                borderRadius: 16, padding: '22px 24px',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 12,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    color: 'rgba(201,168,76,0.5)',
                    textTransform: 'uppercase', letterSpacing: '0.8px',
                  }}>
                    Complétion du profil
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.gold }}>{completionPct}%</span>
                </div>

                <div style={{
                  height: 6, borderRadius: 3,
                  background: 'rgba(255,255,255,0.06)',
                  marginBottom: 16, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${completionPct}%`,
                    background: `linear-gradient(90deg,${C.gold},${C.goldLt})`,
                    borderRadius: 3, transition: 'width 0.4s',
                  }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {completionItems.map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: item.done ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${item.done ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                        {item.done && <CheckCircle size={10} color="#4ade80" />}
                      </div>
                      <span style={{ color: item.done ? C.text : C.textDim }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Logout button (extracted to avoid inline event-handler re-renders) ────────
function LogoutBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: 10,
        background: hov ? 'rgba(201,168,76,0.07)' : 'transparent',
        border: '1px solid rgba(201,168,76,0.15)',
        color: hov ? '#f0e6d3' : 'rgba(240,230,211,0.4)',
        fontSize: 12, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'all 0.15s',
      }}
    >
      <LogOut size={14} />
      Déconnexion
    </button>
  );
}
