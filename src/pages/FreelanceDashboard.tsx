import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Target, Users, MessageSquare, User, Settings,
  LogOut, ChevronRight, Star, FileText, Check, AlertCircle,
  Briefcase, Calendar,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Application, type Mission } from '../types';
import { formatCFA, formatDateShort } from '../lib/utils';
import toast from 'react-hot-toast';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:     '#0f0a1e',
  side:   '#13102a',
  card:   '#1a1232',
  gold:   '#c9a84c',
  goldLt: '#e8c97a',
  text:   '#f0e6d3',
  muted:  'rgba(240,230,211,0.4)',
  bdr:    'rgba(201,168,76,0.10)',
  sideB:  'rgba(201,168,76,0.12)',
} as const;

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  color: 'rgba(201,168,76,0.5)',
  margin: 0,
};

// ─── Logo pont SVG ────────────────────────────────────────────────────────────
function BridgeLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M2 18h4V9M16 18h4V9" stroke={C.gold} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M6 18V13M16 18V13" stroke={C.gold} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M2 9h18"            stroke={C.gold} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M6 9C6 6.2 8.2 4 11 4s5 2.2 5 5" stroke={C.gold} strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiProps {
  icon: React.ElementType;
  accent: string;
  label: string;
  value: React.ReactNode;
  sub: string;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
}
function KpiCard({ icon: Icon, accent, label, value, sub, hovered, onEnter, onLeave }: KpiProps) {
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        background: C.card,
        border: `1px solid ${hovered ? 'rgba(201,168,76,0.22)' : C.bdr}`,
        borderTop: `2px solid ${hovered ? accent : 'transparent'}`,
        borderRadius: 14,
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.2s',
        cursor: 'default',
      }}>
      {/* icône + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}18`, color: accent,
        }}>
          <Icon size={17} />
        </div>
        <p style={sectionLabel}>{label}</p>
      </div>
      {/* valeur */}
      <p style={{ fontSize: 26, fontWeight: 500, color: C.text, lineHeight: 1, margin: 0 }}>
        {value}
      </p>
      {/* sous-texte */}
      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: 0 }}>{sub}</p>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function FreelanceDashboard() {
  const { profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<Application[]>([]);
  const [unread, setUnread]             = useState(0);
  const [dispo, setDispo]               = useState(profile?.is_available ?? true);
  const [toggling, setToggling]         = useState(false);
  const [loading, setLoading]           = useState(true);
  const [hovKpi, setHovKpi]             = useState<number | null>(null);
  const [hovBtn, setHovBtn]             = useState<number | null>(null);

  // ── Complétion profil ──────────────────────────────────────────────────────
  const completionFields = [
    { label: 'Photo de profil', done: !!profile?.avatar_url },
    { label: 'Téléphone',       done: !!profile?.phone },
    { label: 'Bio',             done: !!(profile?.bio && profile.bio.length > 20) },
    { label: 'Compétences',     done: !!(profile?.skills?.length) },
    { label: 'Quartier',        done: !!profile?.quartier },
    { label: 'Tarif horaire',   done: !!(profile?.hourly_rate && profile.hourly_rate > 0) },
  ];
  const donePct = Math.round(
    completionFields.filter(f => f.done).length / completionFields.length * 100
  );

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [appRes, convRes] = await Promise.all([
      supabase
        .from('applications')
        .select('*, mission:missions(*)')
        .eq('freelance_id', profile.id)
        .order('applied_at', { ascending: false })
        .limit(8),
      supabase
        .from('conversations')
        .select('participant_1,participant_2,unread_count_1,unread_count_2')
        .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`),
    ]);
    setApplications(appRes.data || []);
    const u = ((convRes.data || []) as {
      participant_1: string; participant_2: string;
      unread_count_1: number; unread_count_2: number;
    }[]).reduce((acc, c) => {
      if (c.participant_1 === profile.id) return acc + (c.unread_count_1 || 0);
      return acc + (c.unread_count_2 || 0);
    }, 0);
    setUnread(u);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setDispo(profile?.is_available ?? true); }, [profile]);

  async function toggleDispo() {
    setToggling(true);
    try {
      await updateProfile({ is_available: !dispo });
      setDispo(p => !p);
      toast.success(!dispo ? 'Vous êtes disponible' : 'Vous êtes indisponible');
    } catch { toast.error('Erreur'); }
    finally { setToggling(false); }
  }

  // ── Stats dérivées ─────────────────────────────────────────────────────────
  const total     = applications.length;
  const accepted  = applications.filter(a => a.status === 'accepted').length;
  const pending   = applications.filter(a => a.status === 'pending').length;
  const rejected  = applications.filter(a => a.status === 'rejected').length;
  const acceptPct = total > 0 ? Math.round(accepted / total * 100) : 0;

  const kpis = [
    {
      icon: FileText, accent: '#3b82f6', label: 'Candidatures',
      value: total,
      sub: `${pending} en attente · ${total > 0 ? acceptPct + '% acceptées' : 'Taux non calculé'}`,
    },
    {
      icon: Check, accent: '#10b981', label: 'Acceptées',
      value: accepted,
      sub: `${rejected} refusée${rejected !== 1 ? 's' : ''} · ${pending} en attente`,
    },
    {
      icon: Star, accent: C.gold, label: 'Note moyenne',
      value: (profile?.avg_rating ?? 0) > 0 ? (profile!.avg_rating!).toFixed(1) : '—',
      sub: (profile?.total_reviews ?? 0) > 0
        ? `${profile!.total_reviews} évaluation${profile!.total_reviews! > 1 ? 's' : ''} reçue${profile!.total_reviews! > 1 ? 's' : ''}`
        : 'Aucune évaluation reçue',
    },
    {
      icon: Briefcase, accent: '#8b5cf6', label: 'Missions réalisées',
      value: profile?.total_missions ?? 0,
      sub: `${profile?.experience_years ?? 0} an${(profile?.experience_years ?? 0) > 1 ? 's' : ''} d'expérience`
        + (profile?.hourly_rate ? ` · ${formatCFA(profile.hourly_rate)}/h` : ''),
    },
  ];

  const STATUS: Record<string, { label: string; color: string }> = {
    pending:   { label: 'En attente', color: '#f59e0b' },
    accepted:  { label: 'Acceptée',   color: '#10b981' },
    rejected:  { label: 'Refusée',    color: '#ef4444' },
    withdrawn: { label: 'Retirée',    color: C.muted   },
  };

  const quickBtns = [
    {
      label: 'Voir les missions', sub: 'Matching intelligent disponible',
      color: C.gold,    bg: `${C.gold}18`,           bgH: `${C.gold}28`,           to: '/missions',
    },
    {
      label: 'Mon profil', sub: `${donePct}% complété`,
      color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', bgH: 'rgba(167,139,250,0.22)', to: '/profile',
    },
    {
      label: 'Messages', sub: `${unread} non lu${unread !== 1 ? 's' : ''}`,
      color: '#34d399', bg: 'rgba(52,211,153,0.12)',  bgH: 'rgba(52,211,153,0.22)',  to: '/messages',
    },
  ];

  const navItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', to: '/freelance-dashboard', badge: undefined      },
    { icon: Target,          label: 'Missions',        to: '/missions',            badge: undefined      },
    { icon: Users,           label: 'Freelances',      to: '/freelances',          badge: undefined      },
    { icon: MessageSquare,   label: 'Messages',        to: '/messages',            badge: unread || undefined },
    { icon: User,            label: 'Mon profil',      to: '/profile',             badge: undefined      },
    { icon: Settings,        label: 'Paramètres',      to: '/profile',             badge: undefined      },
  ];

  const initials = (profile?.full_name || 'U')
    .split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || 'U';
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const today     = new Date().toLocaleDateString('fr-CI', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: C.bg,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif', color: C.text,
    }}>

      {/* ════════════════════ SIDEBAR ════════════════════ */}
      <aside style={{
        width: 220, flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
        background: C.side, borderRight: `1px solid ${C.sideB}`,
        display: 'flex', flexDirection: 'column', padding: '20px 14px', overflowY: 'auto',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 28, paddingLeft: 2 }}>
          <BridgeLogo />
          <span style={{ fontSize: 15, fontWeight: 500, color: C.text, letterSpacing: '0.2px' }}>
            EventBridge
          </span>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {navItems.map((item, i) => (
            <NavLink key={i} to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 9,
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
                transition: 'all 0.15s',
                borderLeft: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
                background: isActive ? `${C.gold}0d` : 'transparent',
                color: isActive ? C.gold : C.muted,
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = 'rgba(201,168,76,0.07)';
                el.style.color = 'rgba(240,230,211,0.75)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = 'transparent';
                el.style.color = C.muted;
              }}>
              <item.icon size={16} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 500, padding: '2px 6px',
                  borderRadius: 99, background: '#3b82f6', color: '#fff', lineHeight: 1.4,
                }}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{
          borderTop: `1px solid ${C.sideB}`, paddingTop: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Avatar + nom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 500, color: '#1a0a2e',
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})`,
            }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{
                fontSize: 13, fontWeight: 500, color: C.text, margin: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {profile?.full_name ?? '—'}
              </p>
              <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>Freelance</p>
            </div>
          </div>

          {/* Déconnexion */}
          <button onClick={signOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: 'transparent', border: '1px solid rgba(239,68,68,0.2)',
              color: 'rgba(239,68,68,0.55)', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLElement;
              b.style.background = 'rgba(239,68,68,0.08)';
              b.style.color = '#ef4444';
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLElement;
              b.style.background = 'transparent';
              b.style.color = 'rgba(239,68,68,0.55)';
            }}>
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ════════════════════ MAIN ════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: '100vh' }}>

        {/* ── HERO BAND ── */}
        <div style={{ position: 'relative', height: 180, flexShrink: 0, overflow: 'hidden' }}>
          <img
            src="/images/page d'accueil eventbridge.png"
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }}
          />
          {/* gradient sombre vers le bas */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(15,10,30,0.2) 0%, rgba(15,10,30,0.75) 60%, #0f0a1e 100%)',
          }} />

          {/* Contenu hero */}
          <div style={{
            position: 'absolute', bottom: 20, left: 32, right: 24,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 500, color: C.text, margin: 0, lineHeight: 1.2 }}>
                {greeting}, {firstName}
              </h1>
              <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0' }}>{today}</p>
            </div>

            {/* Badge disponibilité */}
            <button onClick={toggleDispo} disabled={toggling}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: 'rgba(15,10,30,0.7)', backdropFilter: 'blur(12px)',
                border: `1px solid ${dispo ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.3)'}`,
                color: dispo ? '#34d399' : '#ef4444', transition: 'all 0.2s',
              }}>
              <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                {dispo && (
                  <span className="animate-ping" style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: '#34d399', opacity: 0.5,
                  }} />
                )}
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', position: 'relative',
                  background: dispo ? '#34d399' : '#ef4444',
                }} />
              </span>
              {toggling ? '…' : dispo ? 'Disponible pour missions' : 'Indisponible'}
            </button>
          </div>
        </div>

        {/* ── CONTENU ── */}
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>

          {/* Bannière profil incomplet */}
          {donePct < 100 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
              borderRadius: 10, background: 'rgba(52,211,153,0.07)',
              border: '1px solid rgba(52,211,153,0.18)',
            }}>
              <AlertCircle size={15} color="#34d399" />
              <p style={{ fontSize: 13, fontWeight: 500, color: '#34d399', flex: 1, margin: 0 }}>
                Profil complété à {donePct}%. Complétez-le pour augmenter votre visibilité.
              </p>
              <button onClick={() => navigate('/profile')}
                style={{
                  fontSize: 12, fontWeight: 500, color: '#34d399',
                  padding: '5px 12px', background: 'rgba(52,211,153,0.1)',
                  border: '1px solid rgba(52,211,153,0.25)', borderRadius: 7, cursor: 'pointer',
                }}>
                Compléter →
              </button>
            </div>
          )}

          {/* 4 KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {kpis.map((k, i) => (
              <KpiCard key={i}
                icon={k.icon} accent={k.accent} label={k.label} value={k.value} sub={k.sub}
                hovered={hovKpi === i}
                onEnter={() => setHovKpi(i)}
                onLeave={() => setHovKpi(null)}
              />
            ))}
          </div>

          {/* 2 colonnes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, flex: 1, minHeight: 0 }}>

            {/* ── Candidatures récentes ── */}
            <div style={{
              background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14,
              padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={sectionLabel}>Mes candidatures récentes</p>
                {applications.length > 0 && (
                  <button onClick={() => navigate('/my-applications')}
                    style={{ fontSize: 12, fontWeight: 500, color: C.gold, background: 'none', border: 'none', cursor: 'pointer' }}>
                    Voir tout →
                  </button>
                )}
              </div>

              {loading ? (
                <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '32px 0', margin: 0 }}>
                  Chargement…
                </p>
              ) : applications.length === 0 ? (
                /* État vide */
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 14, padding: '32px 20px',
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${C.gold}0a`, border: `1px solid ${C.bdr}`,
                  }}>
                    <FileText size={22} color={`${C.gold}60`} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: '0 0 6px' }}>
                      Aucune candidature
                    </p>
                    <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: 0 }}>
                      Postulez à des missions pour<br />voir vos candidatures ici.
                    </p>
                  </div>
                  <button onClick={() => navigate('/missions')}
                    style={{
                      padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 500,
                      color: '#1a0a2e',
                      background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})`,
                      border: 'none', cursor: 'pointer',
                    }}>
                    Voir les missions
                  </button>
                </div>
              ) : (
                /* Liste candidatures */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {applications.map(a => {
                    const m  = a.mission as Mission;
                    const st = STATUS[a.status] ?? STATUS.pending;
                    return (
                      <div key={a.id}
                        onClick={() => m?.id && navigate(`/MissionDetail?id=${m.id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = `${C.gold}06`}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: `${C.gold}0a`,
                        }}>
                          <Calendar size={15} color={`${C.gold}70`} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 13, fontWeight: 500, color: C.text, margin: 0,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {m?.title ?? '—'}
                          </p>
                          <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>
                            {m?.event_date ? formatDateShort(m.event_date) : '—'}
                            {m?.location ? ` · ${m.location}` : ''}
                          </p>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 500, padding: '3px 9px',
                          borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                          background: `${st.color}18`, color: st.color,
                        }}>
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Colonne droite ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Accès rapide */}
              <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14, padding: '18px 16px' }}>
                <p style={{ ...sectionLabel, marginBottom: 14 }}>Accès rapide</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {quickBtns.map((b, i) => (
                    <button key={i} onClick={() => navigate(b.to)}
                      onMouseEnter={() => setHovBtn(i)}
                      onMouseLeave={() => setHovBtn(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                        background: hovBtn === i ? b.bgH : b.bg,
                        border: `1px solid ${b.color}20`,
                        transform: hovBtn === i ? 'translateX(2px)' : 'translateX(0)',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: b.color, margin: 0 }}>{b.label}</p>
                        <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{b.sub}</p>
                      </div>
                      <ChevronRight size={14} color={b.color} style={{ opacity: 0.6, flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Complétion du profil */}
              <div style={{
                background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14,
                padding: '18px 16px', flex: 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={sectionLabel}>Complétion du profil</p>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.gold }}>{donePct}%</span>
                </div>

                {/* Barre de progression */}
                <div style={{ height: 5, background: `${C.gold}12`, borderRadius: 99, marginBottom: 16 }}>
                  <div style={{
                    height: '100%', borderRadius: 99, width: `${donePct}%`,
                    background: `linear-gradient(to right, ${C.gold}, ${C.goldLt})`,
                    transition: 'width 0.8s ease',
                  }} />
                </div>

                {/* Checklist */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {completionFields.map(f => (
                    <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: f.done ? 'rgba(52,211,153,0.12)' : `${C.gold}06`,
                        border: `1px solid ${f.done ? 'rgba(52,211,153,0.28)' : C.bdr}`,
                      }}>
                        {f.done
                          ? <Check size={10} color="#34d399" />
                          : <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.muted, display: 'block' }} />
                        }
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        color: f.done ? C.muted : 'rgba(240,230,211,0.5)',
                      }}>
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
