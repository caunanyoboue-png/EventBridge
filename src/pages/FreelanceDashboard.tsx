import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Send, CheckCircle, Star, Award,
  MapPin, Wallet, ArrowRight, Sparkles, UserCheck,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import KycCard from '../components/KycCard';
import { ServiceIcon } from '../lib/serviceIcons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Mission } from '../types';
import { formatCFA } from '../lib/utils';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        '#0f0a1e',
  sidebar:   '#13102a',
  card:      '#1a1232',
  gold:      'var(--color-gold-primary)',
  goldLt:    'var(--color-gold-light)',
  text:      'var(--color-text-primary)',
  textDim:   'rgba(240,230,211,0.55)',
  border:    'rgba(201,168,76,0.12)',
  cardBd:    'rgba(201,168,76,0.10)',
} as const;

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
            fontSize: 12.5, fontWeight: 600, marginTop: 6,
            color: 'rgba(212,175,55,0.65)',
            textTransform: 'uppercase', letterSpacing: '0.6px',
          }}>
            {label}
          </div>
          <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 4 }}>{sublabel}</div>
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

// ─── Suggestion actionnable ─────────────────────────────────────────────────────
function SuggestRow({ Icon, color, title, sub, onClick }: {
  Icon: React.ElementType; color: string; title: string; sub: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="card-lift" style={{
      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%',
      padding: '11px 13px', borderRadius: 12, cursor: 'pointer',
      background: `${color}10`, border: `1px solid ${color}33`, borderLeft: `3px solid ${color}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1f`, color }}>
        <Icon size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: 'rgba(240,230,211,0.55)', margin: '2px 0 0', lineHeight: 1.45 }}>{sub}</p>
      </div>
      <ChevronRight size={16} color={color} style={{ flexShrink: 0 }} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FreelanceDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const [unread, setUnread] = useState(0);
  const [stats, setStats] = useState({ total: 0, accepted: 0, completed: 0 });
  const [recommended, setRecommended] = useState<Mission[]>([]);

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

      // Missions recommandées (ouvertes, priorité à la ville du freelance)
      let q = supabase.from('missions').select('*').eq('status', 'open')
        .order('created_at', { ascending: false }).limit(3);
      if (profile?.ville) q = q.eq('ville', profile.ville);
      let { data: recs } = await q;
      if (!recs || recs.length === 0) {
        const fb = await supabase.from('missions').select('*').eq('status', 'open')
          .order('created_at', { ascending: false }).limit(3);
        recs = fb.data || [];
      }
      setRecommended(recs || []);
    }
    load();
  }, [user, profile?.ville]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Utilisateur';

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

  return (
    <DashboardLayout>
      {/* Hero band — bannière de bienvenue arrondie */}
      <div className="eb-hero-band" style={{
        height: 180, position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 20,
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
      <div>

          {/* Vérification d'identité (KYC) */}
          <KycCard />

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
              iconBg="rgba(0,200,150,0.12)" iconColor="#00C896"
              value={stats.accepted} label="Acceptées"
              sublabel="missions décrochées" accent="#00C896"
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
                  fontSize: 12.5, fontWeight: 600, marginBottom: 18,
                  color: 'rgba(212,175,55,0.65)',
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Sparkles size={15} /> Suggestions pour vous
                </div>

                {/* Actions à faire */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                  {completionPct < 100 && (
                    <SuggestRow Icon={UserCheck} color="#F59E0B"
                      title="Complétez votre profil"
                      sub={`${completionPct}% — un profil complet décroche 3× plus de missions`}
                      onClick={() => navigate('/profile')} />
                  )}
                  {stats.total === 0 && (
                    <SuggestRow Icon={Send} color={C.gold}
                      title="Envoyez votre première candidature"
                      sub="Parcourez les missions et postulez en un clic"
                      onClick={() => navigate('/missions')} />
                  )}
                  {!profile?.is_available && (
                    <SuggestRow Icon={CheckCircle} color="#00C896"
                      title="Passez en disponible"
                      sub="Soyez visible des organisateurs qui recrutent"
                      onClick={() => navigate('/profile')} />
                  )}
                </div>

                {/* Missions recommandées */}
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 10,
                  textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {profile?.ville ? `Missions près de vous` : 'Missions à la une'}
                </div>
                {recommended.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 20px', fontSize: 13, color: C.textDim }}>
                    Aucune mission ouverte pour l'instant — revenez bientôt.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {recommended.map(m => (
                      <div key={m.id}
                        onClick={() => navigate(`/MissionDetail?id=${m.id}`)}
                        className="card-lift"
                        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                          padding: '12px 14px', borderRadius: 12, borderLeft: '3px solid #00C896',
                          background: 'var(--color-surface)', border: '1px solid rgba(201,168,76,0.1)' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(212,175,55,0.14)', border: '1px solid rgba(212,175,55,0.28)' }}>
                          <ServiceIcon type={m.service_type} size={20} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13.5, fontWeight: 600, color: C.text, margin: 0,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 4 }}>
                            {m.ville && <span style={{ fontSize: 11.5, color: C.textDim, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {m.ville}</span>}
                            <span style={{ fontSize: 11.5, color: C.gold, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Wallet size={12} /> {formatCFA(m.hourly_rate)}/h</span>
                          </div>
                        </div>
                        <ArrowRight size={17} color={C.gold} style={{ flexShrink: 0 }} />
                      </div>
                    ))}
                    <button onClick={() => navigate('/missions')}
                      className="cta-glow"
                      style={{ marginTop: 4, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: 'transparent', color: C.gold, border: '1px solid rgba(212,175,55,0.4)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      Voir toutes les missions <ArrowRight size={15} />
                    </button>
                  </div>
                )}
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
                  <QuickBtn label={unread > 0 ? `Messages · ${unread}` : 'Messages'} color="#4ade80" bg="rgba(74,222,128,0.08)" onClick={() => navigate('/messages')} />
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
    </DashboardLayout>
  );
}
