import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getOrCreateConversation } from '../lib/messaging';
import { type Profile, type Review } from '../types';
import { formatCFA, getInitials } from '../lib/utils';
import PortfolioSection from '../components/PortfolioSection';
import toast from 'react-hot-toast';

const C = {
  card: '#1a1232', gold: '#c9a84c', goldLt: '#e8c97a',
  text: '#f0e6d3', sec: 'rgba(240,230,211,0.45)', bdr: 'rgba(201,168,76,0.12)',
} as const;

const sLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: 'rgba(201,168,76,0.5)', margin: 0,
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
    ]).then(([{ data: p }, { data: r }]) => {
      setViewed(p);
      setReviews(r || []);
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
      <div style={{ textAlign: 'center', padding: '80px 0', color: C.sec }}>Profil introuvable.</div>
    </DashboardLayout>
  );

  const isFreelance = viewed.role === 'freelance';
  const isSelf = me?.id === viewed.id;
  const initials = getInitials(viewed.full_name || 'U');

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Back */}
        <button onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24,
            background: 'none', border: 'none', cursor: 'pointer', color: C.sec, fontSize: 14 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        {/* Identity card */}
        <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 16,
          padding: '28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

            {viewed.avatar_url ? (
              <img src={viewed.avatar_url} alt=""
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
                  border: '2.5px solid rgba(201,168,76,0.35)', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 700, color: '#1a0a2e',
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})` }}>
                {initials}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>{viewed.full_name}</h1>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                  letterSpacing: '0.08em',
                  background: isFreelance ? 'rgba(201,168,76,0.12)' : 'rgba(96,165,250,0.12)',
                  color: isFreelance ? C.gold : '#60a5fa',
                  border: `1px solid ${isFreelance ? 'rgba(201,168,76,0.3)' : 'rgba(96,165,250,0.3)'}` }}>
                  {isFreelance ? 'FREELANCE' : 'ORGANISATEUR'}
                </span>
                {viewed.is_certified && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                    background: 'rgba(16,185,129,0.1)', color: '#10b981',
                    border: '1px solid rgba(16,185,129,0.25)', letterSpacing: '0.08em' }}>
                    CERTIFIÉ
                  </span>
                )}
              </div>

              {(viewed.avg_rating ?? 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Stars rating={viewed.avg_rating || 0} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>
                    {(viewed.avg_rating || 0).toFixed(1)}
                  </span>
                  <span style={{ fontSize: 12, color: C.sec }}>· {viewed.total_reviews || 0} avis</span>
                </div>
              )}

              {[viewed.ville, viewed.quartier].filter(Boolean).length > 0 && (
                <p style={{ fontSize: 13, color: C.sec, margin: '0 0 4px' }}>
                  📍 {[viewed.ville, viewed.quartier].filter(Boolean).join(', ')}
                </p>
              )}

              {!isFreelance && viewed.company_name && (
                <p style={{ fontSize: 13, color: C.gold, fontWeight: 500, margin: '4px 0 0' }}>
                  🏢 {viewed.company_name}{viewed.company_sector ? ` · ${viewed.company_sector}` : ''}
                </p>
              )}
            </div>

            {/* CTA */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!isSelf && me && (
                <button onClick={handleMessage} disabled={messaging}
                  style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                    cursor: messaging ? 'wait' : 'pointer', color: '#1a0a2e', whiteSpace: 'nowrap',
                    background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})`,
                    border: 'none', opacity: messaging ? 0.75 : 1, transition: 'opacity 0.15s' }}>
                  {messaging ? 'Ouverture…' : '✉ Envoyer un message'}
                </button>
              )}
              {isSelf && (
                <button onClick={() => navigate('/profile')}
                  style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', color: C.gold, background: 'transparent', whiteSpace: 'nowrap',
                    border: `1px solid rgba(201,168,76,0.3)` }}>
                  ✏ Modifier mon profil
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
            marginTop: 24, paddingTop: 20, borderTop: `1px solid rgba(201,168,76,0.08)` }}>
            {[
              { l: 'Missions', v: viewed.total_missions ?? 0 },
              { l: 'Expérience', v: isFreelance ? `${viewed.experience_years ?? 0} ans` : '—' },
              { l: 'Tarif/heure', v: isFreelance && viewed.hourly_rate ? formatCFA(viewed.hourly_rate) : '—' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center', padding: '14px 8px',
                background: 'rgba(61,36,96,0.3)', borderRadius: 10,
                border: '1px solid rgba(201,168,76,0.06)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>{s.v}</div>
                <div style={{ fontSize: 11, color: C.sec, marginTop: 5 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bio */}
        {viewed.bio && (
          <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 16,
            padding: '22px 28px', marginBottom: 16 }}>
            <p style={{ ...sLabel, marginBottom: 12 }}>À propos</p>
            <p style={{ fontSize: 14, color: '#b8a898', lineHeight: 1.85, margin: 0 }}>{viewed.bio}</p>
          </div>
        )}

        {/* Skills — freelance only */}
        {isFreelance && (viewed.skills || []).length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 16,
            padding: '22px 28px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={sLabel}>Compétences</p>
              {viewed.hourly_rate && (
                <span style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>{formatCFA(viewed.hourly_rate)}/h</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(viewed.skills || []).map(s => (
                <span key={s} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                  background: 'rgba(201,168,76,0.1)', color: C.gold,
                  border: '1px solid rgba(201,168,76,0.22)' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Availability — freelance only */}
        {isFreelance && (
          <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14,
            padding: '16px 22px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', display: 'flex', width: 10, height: 10, flexShrink: 0 }}>
              {viewed.is_available && (
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                  background: '#10b981', opacity: 0.45, animation: 'ppulse 1.5s ease-in-out infinite' }} />
              )}
              <span style={{ width: 10, height: 10, borderRadius: '50%', position: 'relative',
                background: viewed.is_available ? '#10b981' : '#ef4444' }} />
              <style>{`@keyframes ppulse{0%,100%{transform:scale(1);opacity:.45}50%{transform:scale(2);opacity:0}}`}</style>
            </div>
            <span style={{ fontSize: 13, fontWeight: 500,
              color: viewed.is_available ? '#10b981' : '#ef4444' }}>
              {viewed.is_available ? 'Disponible pour des missions' : 'Indisponible en ce moment'}
            </span>
          </div>
        )}

        {/* Portfolio (freelance uniquement, lecture seule avec lightbox) */}
        {isFreelance && (
          <PortfolioSection
            freelanceId={viewed.id}
            editable={false}
            currentUserId={me?.id}
          />
        )}

        {/* Reviews */}
        <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 16, padding: '22px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <p style={sLabel}>Avis reçus</p>
            {(viewed.avg_rating ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Stars rating={viewed.avg_rating || 0} />
                <span style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>
                  {(viewed.avg_rating || 0).toFixed(1)}
                </span>
                <span style={{ fontSize: 12, color: C.sec }}>({viewed.total_reviews || 0})</span>
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
              <p style={{ fontSize: 13, color: C.sec }}>Aucun avis pour l'instant.</p>
            </div>
          ) : (
            reviews.map((r, i) => {
              const rev = r.reviewer as { full_name?: string; avatar_url?: string } | undefined;
              return (
                <div key={r.id} style={{ display: 'flex', gap: 14, padding: '16px 0',
                  borderBottom: i < reviews.length - 1 ? '1px solid rgba(201,168,76,0.07)' : 'none' }}>
                  {rev?.avatar_url ? (
                    <img src={rev.avatar_url} alt=""
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                        flexShrink: 0, border: '1.5px solid rgba(201,168,76,0.2)' }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600, background: 'rgba(201,168,76,0.1)', color: C.gold }}>
                      {(rev?.full_name || '?').charAt(0)}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
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
    </DashboardLayout>
  );
}
