import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getOrCreateConversation } from '../lib/messaging';
import { type Profile, type Review, type Mission } from '../types';
import { formatCFA, getInitials } from '../lib/utils';
import PortfolioSection from '../components/PortfolioSection';
import toast from 'react-hot-toast';

const sT: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#f0e6d3',
  textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 13 13"
          fill={i < Math.round(rating) ? '#c9a84c' : 'none'} stroke="#c9a84c" strokeWidth="0.9">
          <path d="M6.5 1l1.6 3.3 3.7.5-2.7 2.6.6 3.7-3.2-1.7-3.2 1.7.6-3.7L1.8 4.8l3.7-.5L6.5 1z"
            strokeLinejoin="round"/>
        </svg>
      ))}
    </span>
  );
}

export default function PublicProfile() {
  const [params] = useSearchParams();
  const userId = params.get('id');
  const { profile: me } = useAuth();
  const navigate = useNavigate();

  const [viewed, setViewed] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [recentMissions, setRecentMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    if (!userId) { navigate(-1); return; }
    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('reviews')
        .select('*, reviewer:profiles!reviewer_id(full_name, avatar_url)')
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('missions')
        .select('id,title,status,event_date,service_type,slots_total,slots_filled,location')
        .eq('organisateur_id', userId)
        .order('created_at', { ascending: false })
        .limit(4),
    ]).then(([{ data: p }, { data: r }, { data: m }]) => {
      setViewed(p);
      setReviews(r || []);
      if (p?.role !== 'freelance') setRecentMissions((m || []) as Mission[]);
      setLoading(false);
    });
  }, [userId, navigate]);

  async function handleMessage() {
    if (!me || !viewed || me.id === viewed.id) return;
    setMessaging(true);
    try {
      const convId = await getOrCreateConversation(me.id, viewed.id);
      navigate(`/messages?conv=${convId}`);
    } catch {
      toast.error('Impossible de démarrer la conversation');
      setMessaging(false);
    }
  }

  if (loading) return (
    <DashboardLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #c9a84c',
          borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </DashboardLayout>
  );

  if (!viewed) return (
    <DashboardLayout>
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(240,230,211,0.45)' }}>
        Profil introuvable.
      </div>
    </DashboardLayout>
  );

  const isFreelance = viewed.role === 'freelance';
  const isSelf = me?.id === viewed.id;
  const initials = getInitials(viewed.full_name || 'U');
  const bannerGradient = isFreelance
    ? 'linear-gradient(135deg,#261642 0%,#52367c 50%,#7c3aed 100%)'
    : 'linear-gradient(135deg,#261642 0%,#1e3a5f 50%,#2563eb 100%)';

  const mSt: Record<string, { label: string; color: string }> = {
    draft: { label: 'Brouillon', color: '#6a5a7a' },
    open: { label: 'Ouverte', color: '#10b981' },
    in_progress: { label: 'En cours', color: '#3b82f6' },
    completed: { label: 'Terminée', color: '#c9a84c' },
    cancelled: { label: 'Annulée', color: '#ef4444' },
    disputed: { label: 'Litige', color: '#f59e0b' },
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 48 }}>

        {/* Back */}
        <button onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(240,230,211,0.45)', fontSize: 14 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        {/* ── BANNER + AVATAR ──────────────────────────────── */}
        <div style={{ position: 'relative', marginBottom: 72 }}>

          {/* Banner */}
          <div style={{ height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative',
            background: viewed.banner_url ? undefined : bannerGradient }}>
            {viewed.banner_url && (
              <img src={viewed.banner_url} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            <div style={{ position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 75% 20%,rgba(201,168,76,0.1) 0%,transparent 60%)' }} />

            {/* CTA buttons */}
            <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
              {!isSelf && me && (
                <button onClick={handleMessage} disabled={messaging}
                  className="btn-gold"
                  style={{ padding: '8px 18px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                    color: '#261642', opacity: messaging ? 0.75 : 1 }}>
                  {messaging ? 'Ouverture…' : '✉ Envoyer un message'}
                </button>
              )}
              {isSelf && (
                <button onClick={() => navigate('/profile')}
                  style={{ padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', color: '#c9a84c',
                    background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(201,168,76,0.3)' }}>
                  ✏ Modifier mon profil
                </button>
              )}
            </div>
          </div>

          {/* Avatar overlapping banner */}
          <div style={{ position: 'absolute', bottom: -56, left: 28 }}>
            {viewed.avatar_url
              ? <img src={viewed.avatar_url} alt=""
                  style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover',
                    display: 'block', border: '3px solid #261642',
                    outline: '2px solid rgba(201,168,76,0.4)' }} />
              : <div style={{ width: 100, height: 100, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800,
                  color: '#261642', background: 'linear-gradient(135deg,#c9a84c,#e8c97a)',
                  border: '3px solid #261642', outline: '2px solid rgba(201,168,76,0.3)' }}>
                  {initials}
                </div>
            }
          </div>
        </div>

        {/* ── PROFILE HEADER ───────────────────────────────── */}
        <div style={{ paddingLeft: 152, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f0e6d3', margin: 0 }}>{viewed.full_name}</h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              letterSpacing: '0.08em',
              background: isFreelance ? 'rgba(201,168,76,0.12)' : 'rgba(96,165,250,0.12)',
              color: isFreelance ? '#c9a84c' : '#60a5fa',
              border: `1px solid ${isFreelance ? 'rgba(201,168,76,0.3)' : 'rgba(96,165,250,0.3)'}` }}>
              {isFreelance ? 'FREELANCE' : 'ORGANISATEUR'}
            </span>
            {viewed.is_certified && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                background: 'rgba(16,185,129,0.1)', color: '#10b981',
                border: '1px solid rgba(16,185,129,0.25)', letterSpacing: '0.08em' }}>
                ✓ CERTIFIÉ
              </span>
            )}
            {isFreelance && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
                fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                background: viewed.is_available ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: viewed.is_available ? '#10b981' : '#ef4444',
                border: `1px solid ${viewed.is_available ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%',
                  background: viewed.is_available ? '#10b981' : '#ef4444' }} />
                {viewed.is_available ? 'Disponible' : 'Indisponible'}
              </span>
            )}
          </div>
          {(viewed.avg_rating ?? 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Stars rating={viewed.avg_rating || 0} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#c9a84c' }}>
                {(viewed.avg_rating || 0).toFixed(1)}
              </span>
              <span style={{ fontSize: 12, color: '#5a4a6a' }}>· {viewed.total_reviews || 0} avis</span>
            </div>
          )}
          <p style={{ fontSize: 13, color: '#6a5a7a', margin: 0 }}>
            📍 {[viewed.ville, viewed.quartier].filter(Boolean).join(', ') || 'Localisation non renseignée'}
            {!isFreelance && viewed.company_name && (
              <span style={{ color: '#c9a84c', fontWeight: 600 }}> · 🏢 {viewed.company_name}</span>
            )}
          </p>
        </div>

        {/* ── TWO-COLUMN LAYOUT ────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'flex-start' }}>

          {/* MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {viewed.bio && (
              <div className="card-glass" style={{ padding: 24 }}>
                <h3 style={sT}>À propos</h3>
                <p style={{ fontSize: 14, color: '#b8a898', lineHeight: 1.85, margin: 0 }}>{viewed.bio}</p>
              </div>
            )}

            {isFreelance && (viewed.skills || []).length > 0 && (
              <div className="card-glass" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ ...sT, margin: 0 }}>Compétences</h3>
                  {viewed.hourly_rate && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#c9a84c' }}>
                      {formatCFA(viewed.hourly_rate)}/h
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(viewed.skills || []).map(s => (
                    <span key={s} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13,
                      fontWeight: 600, background: 'rgba(201,168,76,0.1)', color: '#c9a84c',
                      border: '1px solid rgba(201,168,76,0.22)' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isFreelance && (
              <div className="card-glass" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ position: 'relative', display: 'flex', width: 10, height: 10, flexShrink: 0 }}>
                  {viewed.is_available && (
                    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                      background: '#10b981', opacity: 0.45,
                      animation: 'ppulse 1.5s ease-in-out infinite' }} />
                  )}
                  <span style={{ width: 10, height: 10, borderRadius: '50%', position: 'relative',
                    background: viewed.is_available ? '#10b981' : '#ef4444' }} />
                  <style>{`@keyframes ppulse{0%,100%{transform:scale(1);opacity:.45}50%{transform:scale(2);opacity:0}}`}</style>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600,
                  color: viewed.is_available ? '#10b981' : '#ef4444' }}>
                  {viewed.is_available ? 'Disponible pour des missions' : 'Indisponible en ce moment'}
                </span>
              </div>
            )}

            {isFreelance && (
              <PortfolioSection freelanceId={viewed.id} editable={false} currentUserId={me?.id} />
            )}

            {!isFreelance && (viewed.company_name || viewed.company_sector || viewed.rccm) && (
              <div className="card-glass" style={{ padding: 24 }}>
                <h3 style={sT}>Informations entreprise</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {viewed.company_name && (
                    <div>
                      <p style={{ fontSize: 11, color: '#5a4a6a', margin: '0 0 4px', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.06em' }}>Structure</p>
                      <p style={{ fontSize: 14, color: '#b8a898', margin: 0 }}>🏢 {viewed.company_name}</p>
                    </div>
                  )}
                  {viewed.company_sector && (
                    <div>
                      <p style={{ fontSize: 11, color: '#5a4a6a', margin: '0 0 4px', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.06em' }}>Secteur</p>
                      <p style={{ fontSize: 14, color: '#b8a898', margin: 0 }}>🎯 {viewed.company_sector}</p>
                    </div>
                  )}
                  {viewed.rccm && (
                    <div>
                      <p style={{ fontSize: 11, color: '#5a4a6a', margin: '0 0 4px', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.06em' }}>RCCM</p>
                      <p style={{ fontSize: 14, color: '#b8a898', margin: 0 }}>📋 {viewed.rccm}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isFreelance && (
              <PortfolioSection freelanceId={viewed.id} editable={false} currentUserId={me?.id} />
            )}

            {!isFreelance && recentMissions.length > 0 && (
              <div className="card-glass" style={{ padding: 24 }}>
                <h3 style={sT}>Missions publiées récentes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentMissions.map(m => {
                    const st = mSt[m.status || 'draft'] || { label: 'Inconnu', color: '#6a5a7a' };
                    return (
                      <div key={m.id} style={{ padding: '14px 16px', borderRadius: 12,
                        background: 'rgba(82,54,124,0.3)', border: '1px solid rgba(201,168,76,0.07)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#f0e6d3', margin: '0 0 4px' }}>
                            {m.title}
                          </p>
                          <p style={{ fontSize: 12, color: '#6a5a7a', margin: 0 }}>
                            {m.service_type}{m.event_date ? ` · ${new Date(m.event_date).toLocaleDateString('fr-CI')}` : ''}
                          </p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                          background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}30`,
                          letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Avis reçus */}
            <div className="card-glass" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ ...sT, margin: 0 }}>Avis reçus</h3>
                {(viewed.avg_rating ?? 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Stars rating={viewed.avg_rating || 0} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#c9a84c' }}>
                      {(viewed.avg_rating || 0).toFixed(1)}
                    </span>
                    <span style={{ fontSize: 12, color: '#5a4a6a' }}>({viewed.total_reviews || 0})</span>
                  </div>
                )}
              </div>
              {reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none"
                    style={{ margin: '0 auto 12px', display: 'block' }}>
                    <path d="M18 3.5l4.4 9 9.8 1.4-7.1 6.9 1.7 9.7L18 26.4 9.2 30.5l1.7-9.7-7.1-6.9 9.8-1.4L18 3.5Z"
                      stroke="#c9a84c" strokeWidth="1.4" strokeLinejoin="round" strokeOpacity="0.35"/>
                  </svg>
                  <p style={{ fontSize: 13, color: 'rgba(240,230,211,0.45)' }}>Aucun avis pour l'instant.</p>
                </div>
              ) : (
                reviews.map((r, i) => {
                  const rev = r.reviewer as { full_name?: string; avatar_url?: string } | undefined;
                  return (
                    <div key={r.id} style={{ display: 'flex', gap: 14, padding: '16px 0',
                      borderBottom: i < reviews.length - 1 ? '1px solid rgba(201,168,76,0.07)' : 'none' }}>
                      {rev?.avatar_url
                        ? <img src={rev.avatar_url} alt=""
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                              flexShrink: 0, border: '1.5px solid rgba(201,168,76,0.2)' }} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 600,
                            background: 'rgba(201,168,76,0.1)', color: '#c9a84c' }}>
                            {(rev?.full_name || '?').charAt(0)}
                          </div>
                      }
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3' }}>
                            {rev?.full_name || 'Anonyme'}
                          </span>
                          <Stars rating={r.rating} />
                        </div>
                        {r.comment && (
                          <p style={{ fontSize: 13, color: '#8a7a8a', lineHeight: 1.7, margin: 0 }}>
                            "{r.comment}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>

            {/* Statistiques */}
            <div className="card-glass" style={{ padding: 20 }}>
              <h3 style={sT}>Statistiques</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { icon: '✅', label: 'Missions réalisées', value: String(viewed.total_missions ?? 0) },
                  { icon: '⭐', label: 'Note moyenne', value: (viewed.avg_rating ?? 0) > 0 ? `${(viewed.avg_rating || 0).toFixed(1)}/5` : '—' },
                  ...(isFreelance ? [
                    { icon: '🎓', label: "Années d'expérience", value: `${viewed.experience_years ?? 0} ans` },
                    { icon: '💵', label: 'Tarif horaire', value: viewed.hourly_rate ? formatCFA(viewed.hourly_rate) : '—' },
                  ] : []),
                ] as { icon: string; label: string; value: string }[]).map(stat => (
                  <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '10px 12px', background: 'rgba(82,54,124,0.3)',
                    borderRadius: 10, border: '1px solid rgba(201,168,76,0.06)' }}>
                    <span style={{ fontSize: 12, color: '#6a5a7a' }}>{stat.icon} {stat.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#c9a84c' }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coordonnées */}
            {(viewed.phone || viewed.ville || viewed.quartier ||
              (!isFreelance && (viewed.company_name || viewed.company_sector)) ||
              (isFreelance && viewed.hourly_rate)) && (
              <div className="card-glass" style={{ padding: 20 }}>
                <h3 style={sT}>Coordonnées</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {viewed.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span>📞</span>
                      <span style={{ fontSize: 13, color: '#b8a898' }}>{viewed.phone}</span>
                    </div>
                  )}
                  {(viewed.ville || viewed.quartier) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span>📍</span>
                      <span style={{ fontSize: 13, color: '#b8a898' }}>
                        {[viewed.ville, viewed.quartier].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {!isFreelance && viewed.company_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span>🏢</span>
                      <span style={{ fontSize: 13, color: '#b8a898' }}>{viewed.company_name}</span>
                    </div>
                  )}
                  {!isFreelance && viewed.company_sector && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span>🎯</span>
                      <span style={{ fontSize: 13, color: '#b8a898' }}>{viewed.company_sector}</span>
                    </div>
                  )}
                  {isFreelance && viewed.hourly_rate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span>💵</span>
                      <span style={{ fontSize: 13, color: '#b8a898' }}>{formatCFA(viewed.hourly_rate)}/h</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Badge certifié */}
            {viewed.is_certified && (
              <div className="card-glass" style={{ padding: 20, textAlign: 'center',
                border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏆</div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#10b981', margin: '0 0 6px',
                  textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Profil certifié
                </p>
                <p style={{ fontSize: 11, color: '#4a3a5a', lineHeight: 1.5, margin: 0 }}>
                  Vérifié par l'équipe EventBridge
                </p>
              </div>
            )}

            {/* Message CTA repeated in sidebar for easy access */}
            {!isSelf && me && (
              <button onClick={handleMessage} disabled={messaging}
                className="btn-gold"
                style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 13,
                  fontWeight: 700, color: '#261642', opacity: messaging ? 0.75 : 1, cursor: 'pointer' }}>
                {messaging ? 'Ouverture…' : '✉ Envoyer un message'}
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
