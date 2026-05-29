import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, MessageSquare, User,
  LogOut, ChevronRight, FileText, Check, AlertCircle,
  Target, Calendar, PlusCircle, Zap, Menu, X, Settings,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Mission, type Application, type Review } from '../types';
import { formatCFA, formatDateShort } from '../lib/utils';
import toast from 'react-hot-toast';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     '#0f0a1e',
  side:   '#13102a',
  card:   '#1a1232',
  gold:   '#c9a84c',
  goldLt: '#e8c97a',
  text:   '#f0e6d3',
  sec:    'rgba(240,230,211,0.4)',
  bdr:    'rgba(201,168,76,0.10)',
  sideB:  'rgba(201,168,76,0.12)',
} as const;

const sLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  color: 'rgba(201,168,76,0.5)',
};


// ── KPI Card ──────────────────────────────────────────────────────────────────
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
        gap: 14,
        transition: 'border-color 0.2s, border-top-color 0.2s',
        cursor: 'default',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}18`, color: accent,
        }}>
          <Icon size={17} />
        </div>
        <span style={sLabel}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 500, color: C.text, lineHeight: 1 }}>{value}</div>
      <p style={{ fontSize: 12, color: C.sec, lineHeight: 1.6, margin: 0 }}>{sub}</p>
    </div>
  );
}

// ── Étoiles ───────────────────────────────────────────────────────────────────
function Stars({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill={i < Math.round(n) ? C.gold : 'none'}>
          <path d="M6 1l1.5 3 3.4.5-2.4 2.4.5 3.4L6 8.7 3 10.3l.5-3.4L1.1 4.5 4.5 4 6 1Z"
            stroke={C.gold} strokeWidth="0.8" strokeLinejoin="round"/>
        </svg>
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function OrganisateurDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [pendingApps, setPendingApps] = useState<Application[]>([]);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hovKpi, setHovKpi] = useState<number | null>(null);
  const [hovBtn, setHovBtn] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Stats dérivées
  const totalMissions    = missions.length;
  const missionsOuvertes = missions.filter(m => m.status === 'open').length;
  const allApps          = [...pendingApps, ...recentApps];
  const candidaturesRecues = allApps.length + pendingApps.length;
  const budgetEngage     = allApps
    .filter(a => a.status === 'accepted')
    .reduce((sum, a) => {
      const m = a.mission as Mission;
      return sum + (m?.hourly_rate || 0) * (m?.duration_hours || 4);
    }, 0);

  // Complétion profil
  const completionFields = [
    { label: 'Logo / photo',        done: !!profile?.avatar_url },
    { label: 'Téléphone',           done: !!profile?.phone },
    { label: 'Bio / présentation',  done: !!(profile?.bio && profile.bio.length > 20) },
    { label: 'Nom de la structure', done: !!profile?.company_name },
    { label: "Secteur d'activité",  done: !!profile?.company_sector },
    { label: 'Quartier',            done: !!profile?.quartier },
  ];
  const donePct = Math.round(completionFields.filter(f => f.done).length / completionFields.length * 100);

  const fetchAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const [missionRes, reviewRes, convRes] = await Promise.all([
      supabase.from('missions')
        .select('*')
        .eq('organisateur_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('reviews')
        .select('*, reviewer:profiles!reviewer_id(full_name,avatar_url)')
        .eq('reviewed_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(4),
      supabase.from('conversations')
        .select('participant_1,participant_2,unread_count_1,unread_count_2')
        .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`),
    ]);

    const allMissions: Mission[] = missionRes.data || [];
    const ids = allMissions.map(m => m.id);

    let fetchedApps: Application[] = [];
    if (ids.length > 0) {
      const appRes = await supabase.from('applications')
        .select('*, mission:missions(*), freelance:profiles!freelance_id(id,full_name,avatar_url,avg_rating,skills,hourly_rate)')
        .in('mission_id', ids)
        .order('applied_at', { ascending: false })
        .limit(30);
      fetchedApps = appRes.data || [];
    }

    const u = ((convRes.data || []) as { participant_1: string; participant_2: string; unread_count_1: number; unread_count_2: number }[])
      .reduce((acc, c) => {
        if (c.participant_1 === profile.id) return acc + (c.unread_count_1 || 0);
        return acc + (c.unread_count_2 || 0);
      }, 0);

    setMissions(allMissions);
    setPendingApps(fetchedApps.filter(a => a.status === 'pending').slice(0, 5));
    setRecentApps(fetchedApps.filter(a => a.status !== 'pending').slice(0, 6));
    setReviews(reviewRes.data || []);
    setUnread(u);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleApplication(appId: string, action: 'accepted' | 'rejected') {
    setActionLoading(appId);
    const { error } = await supabase.from('applications')
      .update({ status: action, responded_at: new Date().toISOString() })
      .eq('id', appId);
    if (error) {
      console.error('[handleApplication]', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } else {
      toast.success(action === 'accepted' ? 'Candidature acceptée !' : 'Candidature refusée');
      const app = pendingApps.find(a => a.id === appId);
      if (app) {
        const fl = app.freelance as { id?: string; full_name?: string } | undefined;
        const m = app.mission as Mission | undefined;
        if (fl?.id && m) {
          try {
            await supabase.from('notifications').insert({
              user_id: fl.id,
              type: action === 'accepted' ? 'application_accepted' : 'application_rejected',
              title: action === 'accepted' ? '✅ Candidature acceptée !' : '❌ Candidature refusée',
              body: action === 'accepted'
                ? `Votre candidature pour "${m.title}" a été acceptée !`
                : `Votre candidature pour "${m.title}" a été refusée.`,
              data: { mission_id: m.id, application_id: appId },
              is_read: false,
            });
          } catch { /* notification failure must never block */ }
        }
      }
      fetchAll();
    }
    setActionLoading(null);
  }

  async function deleteMission(m: Mission) {
    setDeleteLoading(true);
    if (m.status === 'draft') {
      const { error } = await supabase.from('missions').delete().eq('id', m.id);
      if (error) toast.error(error.message || 'Erreur suppression');
      else { toast.success('Mission supprimée'); setMissions(prev => prev.filter(x => x.id !== m.id)); }
    } else {
      const { error } = await supabase.from('missions').update({ status: 'cancelled' }).eq('id', m.id);
      if (error) toast.error(error.message || 'Erreur annulation');
      else { toast.success('Mission annulée'); setMissions(prev => prev.map(x => x.id === m.id ? { ...x, status: 'cancelled' as Mission['status'] } : x)); }
    }
    setConfirmDeleteId(null);
    setDeleteLoading(false);
  }

  const MSTATUS: Record<string, { label: string; color: string }> = {
    open:        { label: 'Ouverte',    color: '#10b981' },
    in_progress: { label: 'En cours',  color: '#f59e0b' },
    completed:   { label: 'Terminée',  color: '#3b82f6' },
    cancelled:   { label: 'Annulée',   color: '#ef4444' },
    draft:       { label: 'Brouillon', color: C.sec     },
  };

  const ASTATUS: Record<string, { label: string; color: string }> = {
    pending:   { label: 'En attente', color: '#f59e0b' },
    accepted:  { label: 'Acceptée',   color: '#10b981' },
    rejected:  { label: 'Refusée',    color: '#ef4444' },
    withdrawn: { label: 'Retirée',    color: C.sec     },
  };

  const kpis = [
    { icon: FileText,  accent: '#3b82f6', label: 'Missions publiées',
      value: totalMissions,
      sub: `${missionsOuvertes} actuellement ouverte${missionsOuvertes !== 1 ? 's' : ''}` },
    { icon: Target,    accent: '#10b981', label: 'En recrutement',
      value: missionsOuvertes,
      sub: totalMissions > 0 ? `${Math.round(missionsOuvertes / totalMissions * 100)}% du total` : 'Aucune mission' },
    { icon: Users,     accent: C.gold,   label: 'Candidatures',
      value: candidaturesRecues,
      sub: `${pendingApps.length} en attente de réponse` },
    { icon: Briefcase, accent: '#8b5cf6', label: 'Budget engagé',
      value: budgetEngage > 0 ? formatCFA(budgetEngage) : '—',
      sub: `${allApps.filter(a => a.status === 'accepted').length} freelance${allApps.filter(a => a.status === 'accepted').length !== 1 ? 's' : ''} confirmé${allApps.filter(a => a.status === 'accepted').length !== 1 ? 's' : ''}` },
  ];

  const quickBtns = [
    { label: 'Publier une mission',   sub: 'Touchez des centaines de talents', color: C.gold,    bg: `${C.gold}18`,           bgH: `${C.gold}26`,            to: '/create-mission' },
    { label: 'Parcourir les talents', sub: 'Freelances disponibles',           color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', bgH: 'rgba(167,139,250,0.22)', to: '/freelances'     },
    { label: 'Messages',              sub: `${unread} non lu${unread !== 1 ? 's' : ''}`, color: '#34d399', bg: 'rgba(52,211,153,0.12)', bgH: 'rgba(52,211,153,0.22)', to: '/messages' },
  ];

  const navItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', to: '/organisateur-dashboard', badge: undefined },
    { icon: Briefcase,       label: 'Mes missions',    to: '/my-missions',            badge: undefined },
    { icon: PlusCircle,      label: 'Publier',         to: '/create-mission',         badge: undefined },
    { icon: Users,           label: 'Freelances',      to: '/freelances',             badge: undefined },
    { icon: MessageSquare,   label: 'Messages',        to: '/messages',               badge: unread > 0 ? unread : undefined },
    { icon: User,            label: 'Mon profil',      to: '/profile',                badge: undefined },
    { icon: Settings,        label: 'Paramètres',      to: '/settings',               badge: undefined },
  ];

  const initials = (profile?.company_name || profile?.full_name || 'O')
    .split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || 'O';
  const firstName = profile?.company_name || profile?.full_name?.split(' ')[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const today = new Date().toLocaleDateString('fr-CI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif', color: C.text, position: 'relative' }}>

      {/* Overlay mobile */}
      <div className={`eb-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className={`eb-sidebar${sidebarOpen ? ' open' : ''}`} style={{ width: 220, flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
        background: C.side, borderRight: `1px solid ${C.sideB}`,
        display: 'flex', flexDirection: 'column', padding: '20px 14px', overflowY: 'auto' }}>

        {/* Bouton fermeture mobile */}
        <button className="eb-sidebar-close" onClick={() => setSidebarOpen(false)}>
          <X size={16} />
        </button>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <img src="/logo.png.jpeg" alt="EventBridge" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {navItems.map((item, i) => (
            <NavLink key={i} to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 9,
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
                transition: 'all 0.15s', position: 'relative',
                borderLeft: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
                background: isActive ? `${C.gold}0d` : 'transparent',
                color: isActive ? C.gold : C.sec,
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = `rgba(201,168,76,0.07)`;
                el.style.color = 'rgba(240,230,211,0.75)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = 'transparent';
                el.style.color = C.sec;
              }}>
              <item.icon size={16} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px',
                  borderRadius: 99, background: '#3b82f6', color: '#fff', lineHeight: 1.4 }}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* S.O.S Brigade */}
        <button onClick={() => navigate('/sos-brigade')}
          style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 10,
            fontWeight: 500, fontSize: 13, color: '#fff', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Zap size={14} /> S.O.S Brigade
        </button>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${C.sideB}`, paddingTop: 14, marginTop: 10,
          display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} style={{ width: 34, height: 34, borderRadius: '50%',
                objectFit: 'cover', flexShrink: 0 }} alt="" />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 500, color: '#261642',
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})` }}>
                {initials}
              </div>
            )}
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.company_name || profile?.full_name || '—'}
              </p>
              <p style={{ fontSize: 11, color: C.sec, margin: '2px 0 0' }}>Organisateur</p>
            </div>
          </div>
          <button onClick={signOut}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: 'transparent', border: '1px solid rgba(239,68,68,0.2)',
              color: 'rgba(239,68,68,0.55)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLElement; b.style.background = 'rgba(239,68,68,0.08)'; b.style.color = '#ef4444'; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLElement; b.style.background = 'transparent'; b.style.color = 'rgba(239,68,68,0.55)'; }}>
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: '100vh' }}>

        {/* Top bar hamburger (mobile uniquement) */}
        <div className="eb-topbar">
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: C.gold, display: 'flex' }}>
            <Menu size={20} />
          </button>
          <img src="/logo.png.jpeg" alt="EventBridge" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          <div style={{ width: 36 }} />
        </div>

        {/* HERO BAND */}
        <div className="eb-hero-band" style={{ position: 'relative', height: 180, flexShrink: 0, overflow: 'hidden' }}>
          <img src="/images/Dashboard-organisateur.jpeg" alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} />
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(15,10,30,0.25) 0%, rgba(15,10,30,0.82) 65%, #0f0a1e 100%)' }} />
          <div className="eb-hero-content" style={{ position: 'absolute', bottom: 20, left: 32, right: 24,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 500, color: C.text, margin: 0, lineHeight: 1.2 }}>
                {greeting}, {firstName}
              </h1>
              <p style={{ fontSize: 12, color: C.sec, margin: '4px 0 0' }}>{today}</p>
            </div>
            <div className="eb-hero-btns" style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => navigate('/sos-brigade')}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                  borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: 'rgba(220,38,38,0.25)', backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(220,38,38,0.4)', color: '#ef4444', transition: 'all 0.2s' }}>
                <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                  <span className="animate-ping" style={{ position: 'absolute', inset: 0,
                    borderRadius: '50%', background: '#ef4444', opacity: 0.6 }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', position: 'relative', background: '#ef4444' }} />
                </span>
                S.O.S Brigade
              </button>
              <button onClick={() => navigate('/create-mission')}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                  borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})`,
                  border: 'none', color: '#261642', transition: 'all 0.2s' }}>
                <PlusCircle size={14} />
                Publier une mission
              </button>
            </div>
          </div>
        </div>

        {/* CONTENU */}
        <div className="eb-content-pad" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>

          {/* Bannière candidatures en attente */}
          {pendingApps.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
              borderRadius: 10, background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertCircle size={15} color="#f59e0b" />
              <p style={{ fontSize: 13, fontWeight: 500, color: '#f59e0b', flex: 1, margin: 0 }}>
                {pendingApps.length} candidature{pendingApps.length > 1 ? 's' : ''} en attente de votre réponse.
              </p>
            </div>
          )}

          {/* 4 KPI cards */}
          <div className="eb-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {kpis.map((k, i) => (
              <KpiCard key={i}
                icon={k.icon} accent={k.accent}
                label={k.label} value={k.value} sub={k.sub}
                hovered={hovKpi === i}
                onEnter={() => setHovKpi(i)}
                onLeave={() => setHovKpi(null)} />
            ))}
          </div>

          {/* 2 colonnes */}
          <div className="eb-kpi-grid eb-org-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, flex: 1, minHeight: 0 }}>

            {/* Colonne gauche */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Candidatures à traiter */}
              {pendingApps.length > 0 && (
                <div style={{ background: C.card, border: '1px solid rgba(245,158,11,0.15)',
                  borderRadius: 14, padding: '20px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={sLabel}>Candidatures à traiter</span>
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px',
                      borderRadius: 99, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      {pendingApps.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pendingApps.map(a => {
                      const fl = a.freelance as { id?: string; full_name?: string; avatar_url?: string; avg_rating?: number; skills?: string[] } | undefined;
                      const m = a.mission as Mission | undefined;
                      return (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 10,
                          background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
                          {fl?.avatar_url ? (
                            <img src={fl.avatar_url} style={{ width: 38, height: 38, borderRadius: '50%',
                              objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${C.gold}40` }} alt="" />
                          ) : (
                            <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 500, color: '#261642',
                              background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})` }}>
                              {fl?.full_name?.charAt(0) || '?'}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fl?.full_name || 'Freelance inconnu'}
                            </p>
                            <p style={{ fontSize: 11, color: C.sec, margin: '2px 0 0' }}>
                              {m?.title || '—'}{m?.event_date ? ` · ${formatDateShort(m.event_date)}` : ''}
                            </p>
                            {fl?.avg_rating && fl.avg_rating > 0 && (
                              <div style={{ marginTop: 4 }}>
                                <Stars n={fl.avg_rating} />
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {fl?.id && (
                              <button
                                onClick={() => navigate(`/public-profile?id=${fl.id}`)}
                                style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                                  background: 'transparent', color: C.gold,
                                  border: `1px solid ${C.gold}40`, cursor: 'pointer' }}>
                                Profil
                              </button>
                            )}
                            <button
                              onClick={() => handleApplication(a.id, 'rejected')}
                              disabled={actionLoading === a.id}
                              style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}>
                              Refuser
                            </button>
                            <button
                              onClick={() => handleApplication(a.id, 'accepted')}
                              disabled={actionLoading === a.id}
                              style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                                background: 'rgba(16,185,129,0.12)', color: '#10b981',
                                border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer' }}>
                              {actionLoading === a.id ? '…' : 'Accepter'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Missions récentes */}
              <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14,
                padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={sLabel}>Mes missions récentes</span>
                  {missions.length > 0 && (
                    <button onClick={() => navigate('/my-missions')}
                      style={{ fontSize: 12, fontWeight: 500, color: C.gold,
                        background: 'none', border: 'none', cursor: 'pointer' }}>
                      Voir tout →
                    </button>
                  )}
                </div>

                {loading ? (
                  <p style={{ fontSize: 13, color: C.sec, textAlign: 'center', padding: '24px 0', margin: 0 }}>
                    Chargement…
                  </p>
                ) : missions.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 14, padding: '32px 20px' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${C.gold}0a`, border: `1px solid ${C.bdr}` }}>
                      <Briefcase size={22} color={`${C.gold}60`} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: '0 0 6px' }}>
                        Aucune mission publiée
                      </p>
                      <p style={{ fontSize: 12, color: C.sec, lineHeight: 1.7, margin: 0 }}>
                        Créez votre première mission<br />pour recruter des freelances.
                      </p>
                    </div>
                    <button onClick={() => navigate('/create-mission')}
                      style={{ padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 500,
                        color: '#261642', background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})`,
                        border: 'none', cursor: 'pointer' }}>
                      Publier une mission
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {missions.map(m => {
                      const ms = MSTATUS[m.status || 'open'];
                      const filled = m.slots_filled || 0;
                      const total = m.slots_total || 1;
                      return (
                        <div key={m.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 10,
                            transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = `${C.gold}06`}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${C.gold}0a`, cursor: 'pointer' }}
                            onClick={() => navigate(`/MissionDetail?id=${m.id}`)}>
                            <Calendar size={15} color={`${C.gold}70`} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                            onClick={() => navigate(`/MissionDetail?id=${m.id}`)}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.title}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <div style={{ flex: 1, height: 3, background: `${C.gold}12`, borderRadius: 99 }}>
                                <div style={{ height: '100%', borderRadius: 99,
                                  width: `${Math.min(100, (filled / total) * 100)}%`,
                                  background: `linear-gradient(to right, ${C.gold}, ${C.goldLt})` }} />
                              </div>
                              <span style={{ fontSize: 10, color: C.sec, flexShrink: 0 }}>{filled}/{total}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px',
                            borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                            background: `${ms.color}18`, color: ms.color }}>
                            {ms.label}
                          </span>
                          {(m.status === 'open' || m.status === 'draft') && (
                            <button
                              onClick={e => { e.stopPropagation(); navigate(`/edit-mission?id=${m.id}`); }}
                              style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: '3px 10px',
                                borderRadius: 8, cursor: 'pointer', border: `1px solid ${C.gold}40`,
                                color: C.gold, background: 'transparent', transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = `${C.gold}10`}
                              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}>
                              Modifier
                            </button>
                          )}
                          {(m.status === 'open' || m.status === 'draft') && (
                            confirmDeleteId === m.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
                                onClick={e => e.stopPropagation()}>
                                <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.7)', whiteSpace: 'nowrap' }}>
                                  {m.status === 'draft' ? 'Supprimer ?' : 'Annuler ?'}
                                </span>
                                <button
                                  onClick={e => { e.stopPropagation(); deleteMission(m); }}
                                  disabled={deleteLoading}
                                  style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 9px',
                                    borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.5)',
                                    color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                                  {deleteLoading ? '…' : 'Oui'}
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                  style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: '3px 9px',
                                    borderRadius: 8, cursor: 'pointer', border: `1px solid ${C.gold}30`,
                                    color: C.sec, background: 'transparent' }}>
                                  Non
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmDeleteId(m.id); }}
                                style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: '3px 10px',
                                  borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.25)',
                                  color: 'rgba(239,68,68,0.65)', background: 'transparent', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.65)'; }}>
                                {m.status === 'draft' ? '🗑' : '✗'}
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Candidatures récentes (déjà traitées) */}
              {recentApps.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14, padding: '20px 18px' }}>
                  <span style={sLabel}>Candidatures traitées</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 14 }}>
                    {recentApps.map(a => {
                      const fl = a.freelance as { full_name?: string } | undefined;
                      const m = a.mission as Mission | undefined;
                      const as_ = ASTATUS[a.status] ?? ASTATUS.pending;
                      return (
                        <div key={a.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 8, transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = `${C.gold}06`}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 500, color: '#261642',
                            background: `linear-gradient(135deg, ${C.gold}80, ${C.goldLt}80)` }}>
                            {fl?.full_name?.charAt(0) || '?'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 500, color: C.text, margin: 0,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fl?.full_name || '—'}
                            </p>
                            <p style={{ fontSize: 11, color: C.sec, margin: '1px 0 0',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m?.title || '—'}
                            </p>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px',
                            borderRadius: 999, flexShrink: 0,
                            background: `${as_.color}18`, color: as_.color }}>
                            {as_.label}
                          </span>
                          {a.status === 'accepted' && m?.id && (
                            <button
                              onClick={() => navigate(`/MissionDetail?id=${m.id}`)}
                              style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: '3px 9px',
                                borderRadius: 7, cursor: 'pointer', border: `1px solid ${C.gold}40`,
                                color: C.gold, background: 'transparent', whiteSpace: 'nowrap' }}>
                              📄 Contrat
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Colonne droite */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Accès rapide */}
              <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14, padding: '18px 16px' }}>
                <p style={{ ...sLabel, marginBottom: 14 }}>Accès rapide</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {quickBtns.map((b, i) => (
                    <button key={i} onClick={() => navigate(b.to)}
                      onMouseEnter={() => setHovBtn(i)}
                      onMouseLeave={() => setHovBtn(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                        background: hovBtn === i ? b.bgH : b.bg,
                        border: `1px solid ${b.color}20`,
                        transform: hovBtn === i ? 'translateX(2px)' : 'translateX(0)',
                        transition: 'all 0.15s' }}>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: b.color, margin: 0 }}>{b.label}</p>
                        <p style={{ fontSize: 11, color: C.sec, margin: '2px 0 0' }}>{b.sub}</p>
                      </div>
                      <ChevronRight size={14} color={b.color} style={{ opacity: 0.6, flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Complétion du profil */}
              <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14, padding: '18px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={sLabel}>Complétion du profil</p>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.gold }}>{donePct}%</span>
                </div>
                <div style={{ height: 5, background: `${C.gold}12`, borderRadius: 99, marginBottom: 16 }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${donePct}%`,
                    background: `linear-gradient(to right, ${C.gold}, ${C.goldLt})`,
                    transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {completionFields.map(f => (
                    <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: f.done ? 'rgba(52,211,153,0.12)' : `${C.gold}06`,
                        border: `1px solid ${f.done ? 'rgba(52,211,153,0.28)' : C.bdr}` }}>
                        {f.done
                          ? <Check size={10} color="#34d399" />
                          : <span style={{ width: 4, height: 4, borderRadius: '50%',
                              background: C.sec, display: 'block' }} />
                        }
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500,
                        color: f.done ? C.sec : 'rgba(240,230,211,0.5)' }}>
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Avis des freelances */}
              {reviews.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14, padding: '18px 16px' }}>
                  <p style={{ ...sLabel, marginBottom: 14 }}>Avis des freelances</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {reviews.map(r => (
                      <div key={r.id} style={{ paddingBottom: 12, borderBottom: `1px solid ${C.bdr}` }}>
                        <Stars n={r.rating} />
                        <p style={{ fontSize: 12, color: C.sec, margin: '6px 0 4px',
                          lineHeight: 1.6, fontStyle: 'italic' }}>
                          "{r.comment || '—'}"
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(240,230,211,0.2)', margin: 0 }}>
                          — {(r.reviewer as { full_name?: string })?.full_name || 'Anonyme'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
