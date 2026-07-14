import { useEffect, useState, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Heart, MessageCircle, Repeat2, Send, ImagePlus, X, Plus,
  Inbox, Calendar, MapPin, Users, Wallet, Newspaper, Loader2,
  PenLine, Briefcase, Siren, Zap, Navigation,
  type LucideIcon,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { useAuthGate } from '../contexts/AuthGateContext';
import { supabase } from '../lib/supabase';
import { type Mission, type SosSession } from '../types';
import { formatCFA, getInitials } from '../lib/utils';
import { ServiceIconBadge } from '../lib/serviceIcons';
import { distanceKm, formatDistance, getBrowserPosition } from '../lib/geo';
import toast from 'react-hot-toast';

/* ── Alerte S.O.S épinglée en haut du fil (freelance uniquement) ──────── */
function SosFeedAlert() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [sos, setSos] = useState<SosSession | null>(null);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!profile || profile.role !== 'freelance') return;
    let cancelled = false;
    (async () => {
      // 1) Position GPS actuelle → maj du profil (le matching 30 km s'en sert)
      try {
        const c = await getBrowserPosition();
        if (cancelled) return;
        setMyPos({ lat: c.latitude, lng: c.longitude });
        await supabase.from('profiles')
          .update({ latitude: c.latitude, longitude: c.longitude }).eq('id', profile.id);
      } catch {
        if (!cancelled) setLocDenied(true);
      }
      // 2) S.O.S actif pour lequel j'ai été notifié
      const { data: notifs } = await supabase.from('notifications')
        .select('data').eq('user_id', profile.id).eq('type', 'sos_alert')
        .order('created_at', { ascending: false }).limit(10);
      const ids = [...new Set((notifs || [])
        .map(n => (n.data as { sos_session_id?: string } | null)?.sos_session_id)
        .filter(Boolean) as string[])];
      if (ids.length === 0) return;
      const { data: sessions } = await supabase.from('sos_sessions')
        .select('*').in('id', ids).eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(1);
      const session = sessions?.[0] as SosSession | undefined;
      if (!session) return;
      // Déjà répondu → ne plus afficher l'alerte en haut du fil
      const { data: resp } = await supabase.from('sos_responses')
        .select('id').eq('sos_session_id', session.id).eq('freelance_id', profile.id).maybeSingle();
      if (!cancelled && !resp) setSos(session);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  async function handleAvailable() {
    if (!profile || !sos) return;
    setResponding(true);
    const { error } = await supabase.from('sos_responses')
      .insert({ sos_session_id: sos.id, freelance_id: profile.id, status: 'pending' });
    if (error && error.code !== '23505') { // 23505 = déjà répondu
      toast.error('Erreur lors de la réponse');
      setResponding(false);
      return;
    }
    if (!error) {
      const types = sos.service_types?.length ? sos.service_types.join(', ') : sos.service_type;
      await supabase.from('notifications').insert({
        user_id: sos.organisateur_id, type: 'sos_alert',
        title: 'S.O.S Brigade — Nouvelle réponse',
        body: `${profile.full_name || 'Un freelance'} se propose pour "${types}" à ${sos.location}.`,
        data: { sos_session_id: sos.id }, is_read: false,
      });
    }
    setSos(null); // l'alerte disparaît du haut du fil
    navigate('/sos-brigade');
  }

  useEffect(() => {
    if (!sos) return;
    const iv = setInterval(() => {
      const s = Math.max(0, Math.floor((new Date(sos.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(s);
      if (s === 0) { setSos(null); clearInterval(iv); }
    }, 1000);
    return () => clearInterval(iv);
  }, [sos]);

  if (!profile || profile.role !== 'freelance') return null;

  // Localisation refusée et pas d'alerte → inciter à l'activer
  if (locDenied && !sos) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 16,
        borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <Navigation size={18} color="#F59E0B" />
        <span style={{ fontSize: 13, color: '#f0e6d3' }}>
          Activez votre localisation pour voir les S.O.S Brigade près de vous.
        </span>
      </div>
    );
  }
  if (!sos) return null;

  const dist = myPos && sos.latitude != null && sos.longitude != null
    ? distanceKm(myPos.lat, myPos.lng, sos.latitude, sos.longitude) : null;
  const types = sos.service_types?.length ? sos.service_types.join(', ') : sos.service_type;
  const total = (sos.hourly_rate || 0) * (sos.estimated_hours || 0);
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/sos-brigade')}
      style={{ marginBottom: 18, borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        border: '2px solid rgba(220,38,38,0.6)', background: 'linear-gradient(135deg,#1a0505,#2d0808)' }}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div className="animate-sos" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#dc2626,#b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Siren size={22} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 8px',
                borderRadius: 999, background: '#ef4444', color: '#fff' }}>URGENT</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>S.O.S Brigade</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'rgba(255,200,200,0.8)', margin: '3px 0 0' }}>{types}</p>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: timeLeft < 300 ? '#ef4444' : '#fff',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{mins}:{secs}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>restant</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={13} /> {sos.location}
          </span>
          {dist != null && (
            <span style={{ fontSize: 12, color: '#fca5a5', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Navigation size={13} /> À {formatDistance(dist)} de vous
            </span>
          )}
          {total > 0 && (
            <span style={{ fontSize: 12, color: '#e8c97a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Wallet size={13} /> {formatCFA(total)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); handleAvailable(); }} disabled={responding}
            style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 800,
              background: '#fff', color: '#b91c1c', border: 'none', cursor: 'pointer',
              opacity: responding ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Zap size={17} fill="#b91c1c" /> {responding ? 'Envoi...' : 'Je suis disponible'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setSos(null); }}
            style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.25)',
              color: 'rgba(255,255,255,0.8)', cursor: 'pointer', flexShrink: 0 }}>
            Ignorer
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Types ─────────────────────────────────────────────────────────── */
type Author = {
  id: string; full_name: string | null; avatar_url: string | null;
  role: string; company_name: string | null;
};
type Post = {
  id: string; author_id: string; content: string; image_url: string | null;
  likes_count: number; reposts_count: number; comments_count: number;
  created_at: string; author: Author;
};
type Comment = {
  id: string; content: string; created_at: string;
  author: Pick<Author, 'full_name' | 'avatar_url'>;
};
type FeedMission = Mission & { organisateur: Author };
type FeedItem =
  | { kind: 'post';    ts: string; post: Post }
  | { kind: 'mission'; ts: string; mission: FeedMission };

/* ── Helper ─────────────────────────────────────────────────────────── */
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1)  return "À l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `il y a ${day}j`;
  return new Date(d).toLocaleDateString('fr-CI', { day: '2-digit', month: 'short' });
}

/* ── Avatar mini ────────────────────────────────────────────────────── */
function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string | null; size?: number }) {
  return src
    ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(201,168,76,0.25)' }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 700,
        color: '#261642', background: 'linear-gradient(135deg,#d4af37,#e8c97a)' }}>
        {getInitials(name || 'U')}
      </div>;
}

/* ── Action button ──────────────────────────────────────────────────── */
function ActionBtn({ onClick, active, Icon, label, activeColor, fill }: {
  onClick: () => void; active: boolean; Icon: LucideIcon; label: string; activeColor: string; fill?: boolean;
}) {
  return (
    <button onClick={onClick} className="feed-action" style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      padding: '11px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13,
      background: active ? `${activeColor}14` : 'transparent',
      color: active ? activeColor : '#9a8a9a',
      fontWeight: active ? 700 : 500, transition: 'all 0.18s',
    }}>
      <Icon size={17} strokeWidth={2} fill={active && fill ? activeColor : 'none'} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ── PostCard ───────────────────────────────────────────────────────── */
function PostCard({ post, liked, reposted, onLike, onRepost, onToggleComment,
  commentsOpen, comments, commentText, onCommentChange, onCommentSubmit, commentLoading,
}: {
  post: Post; liked: boolean; reposted: boolean;
  onLike: () => void; onRepost: () => void; onToggleComment: () => void;
  commentsOpen: boolean; comments: Comment[];
  commentText: string; onCommentChange: (v: string) => void;
  onCommentSubmit: () => void; commentLoading: boolean;
}) {
  const a = post.author;
  const isOrg = a.role === 'organisateur';
  const roleColor = isOrg ? '#60a5fa' : '#d4af37';
  const rolePill: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 700,
    letterSpacing: '0.04em', padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
    background: isOrg ? 'rgba(96,165,250,0.12)' : 'rgba(201,168,76,0.12)',
    color: roleColor, border: `1px solid ${roleColor}30`,
  };
  const pubPill: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 700,
    letterSpacing: '0.06em', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
    background: 'rgba(212,175,55,0.13)', color: '#e8c97a', border: '1px solid rgba(212,175,55,0.4)',
  };

  return (
    <div className="card-glass overflow-hidden">
      {/* Header — auteur · rôle · type de contenu (rangée alignée, sans chevauchement) */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar src={a.avatar_url} name={a.full_name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: '#f0e6d3', minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.full_name || 'Utilisateur'}
            </span>
            <span style={rolePill}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: roleColor, display: 'inline-block' }} />
              {isOrg ? 'ORGANISATEUR' : 'FREELANCE'}
            </span>
          </div>
          <p style={{ fontSize: 11.5, color: '#7a6a8a', marginTop: 2 }}>{timeAgo(post.created_at)}</p>
        </div>
        <span style={pubPill}>
          <PenLine size={11} /> PUBLICATION
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '0 17px 13px' }}>
        <p style={{ fontSize: 14.5, color: '#d8cabb', lineHeight: 1.75, whiteSpace: 'pre-wrap', margin: 0 }}>
          {post.content}
        </p>
      </div>

      {/* Image */}
      {post.image_url && (
        <img src={post.image_url} alt="" style={{ width: '100%', maxHeight: 440, objectFit: 'cover', display: 'block' }} />
      )}

      {/* Counts bar */}
      {(post.likes_count > 0 || post.comments_count > 0 || post.reposts_count > 0) && (
        <div style={{ padding: '9px 17px', display: 'flex', gap: 16, alignItems: 'center',
          borderTop: '1px solid rgba(201,168,76,0.06)' }}>
          {post.likes_count > 0 && (
            <span style={{ fontSize: 12, color: '#7a6a8a', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Heart size={13} fill="#ef4444" color="#ef4444" /> {post.likes_count}
            </span>
          )}
          {post.comments_count > 0 && (
            <span style={{ fontSize: 12, color: '#7a6a8a', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MessageCircle size={13} /> {post.comments_count}
            </span>
          )}
          {post.reposts_count > 0 && (
            <span style={{ fontSize: 12, color: '#7a6a8a', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Repeat2 size={14} /> {post.reposts_count}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', padding: '4px 8px', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
        <ActionBtn onClick={onLike}          active={liked}        Icon={Heart}         label="J'aime"    activeColor="#ef4444" fill />
        <ActionBtn onClick={onToggleComment} active={commentsOpen} Icon={MessageCircle} label="Commenter" activeColor="#d4af37" />
        <ActionBtn onClick={onRepost}        active={reposted}     Icon={Repeat2}       label="Reposter"  activeColor="#10b981" />
      </div>

      {/* Comments */}
      {commentsOpen && (
        <div style={{ borderTop: '1px solid rgba(201,168,76,0.08)', padding: '13px 15px' }}>
          {comments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 9 }}>
                  <Avatar src={c.author.avatar_url} name={c.author.full_name} size={30} />
                  <div style={{ background: 'rgba(82,54,124,0.4)', borderRadius: 12, padding: '7px 12px', flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#d4af37' }}>{c.author.full_name}</span>
                    <p style={{ fontSize: 13, color: '#d8cabb', margin: '3px 0 0', lineHeight: 1.5 }}>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={commentText} onChange={e => onCommentChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onCommentSubmit(); } }}
              placeholder="Écrire un commentaire..."
              style={{ flex: 1, background: 'rgba(82,54,124,0.4)', border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 22, padding: '9px 15px', color: '#f0e6d3', fontSize: 13, outline: 'none' }}
            />
            <button onClick={onCommentSubmit} disabled={!commentText.trim() || commentLoading}
              style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg,#d4af37,#e8c97a)', border: 'none', borderRadius: '50%',
                color: '#261642', cursor: 'pointer', flexShrink: 0,
                opacity: (!commentText.trim() || commentLoading) ? 0.45 : 1 }}>
              {commentLoading ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── MissionFeedCard ────────────────────────────────────────────────── */
function MissionFeedCard({ mission: m, isFreelance, onApply, onView }: {
  mission: FeedMission; isFreelance: boolean; onApply: () => void; onView: () => void;
}) {
  const org = m.organisateur;
  const pillBase: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700,
    letterSpacing: '0.05em', padding: '4px 10px', borderRadius: 999, lineHeight: 1, whiteSpace: 'nowrap',
  };
  return (
    <div className="card-glass card-lift overflow-hidden">
      {/* Photo du lieu (si présente) */}
      {m.venue_photo_url && (
        <div style={{ aspectRatio: '16/7', overflow: 'hidden', cursor: 'pointer' }} onClick={onView}>
          <img src={m.venue_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      <div style={{ padding: 17 }}>
        {/* Étiquettes — rangée homogène, identique avec ou sans photo */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 13 }}>
          <span style={{ ...pillBase, background: 'rgba(0,200,150,0.15)', color: '#00C896', border: '1px solid rgba(0,200,150,0.42)' }}>
            <Briefcase size={11} /> MISSION
          </span>
          {m.is_urgent && (
            <span style={{ ...pillBase, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.45)' }}>
              <Zap size={11} fill="#f87171" /> URGENT
            </span>
          )}
          <span style={{ ...pillBase, background: 'rgba(122,106,138,0.14)', color: '#c7b8c0', border: '1px solid rgba(184,168,152,0.24)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981',
              display: 'inline-block', boxShadow: '0 0 5px rgba(16,185,129,0.9)' }} /> OUVERT
          </span>
        </div>

        {/* Auteur + date de publication */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 15 }}>
          <Avatar src={org.avatar_url} name={org.full_name} size={28} />
          <span style={{ fontSize: 12, color: '#b8a898', flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 700, color: '#f0e6d3' }}>{org.full_name || org.company_name}</span>
            {' '}a publié une mission
          </span>
          {m.created_at && (
            <span style={{ fontSize: 11, color: '#7a6a8a', flexShrink: 0 }}>{timeAgo(m.created_at)}</span>
          )}
        </div>

        {/* Mission info */}
        <div style={{ display: 'flex', gap: 13, marginBottom: 15, cursor: 'pointer' }} onClick={onView}>
          <ServiceIconBadge type={m.service_type} size={48} />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, color: '#f0e6d3', margin: '0 0 7px' }}>{m.title}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 13px', fontSize: 12, color: '#b8a898' }}>
              {m.event_date && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={13} color="#8a7a9a" /> {new Date(m.event_date).toLocaleDateString('fr-CI', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
              {m.ville && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={13} color="#8a7a9a" /> {m.ville}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Users size={13} color="#8a7a9a" /> {m.slots_filled || 0}/{m.slots_total} poste(s)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#d4af37', fontWeight: 700 }}>
                <Wallet size={13} /> {formatCFA(m.hourly_rate)}/h
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 9 }}>
          <button onClick={onView}
            className="btn-outline-gold px-4 py-2 rounded-lg text-sm"
            style={{ flex: 1 }}>
            Voir les détails
          </button>
          {isFreelance && (
            <button onClick={onApply}
              className="btn-gold px-4 py-2 rounded-lg text-sm font-bold text-[#261642]"
              style={{ flex: 1 }}>
              Postuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Feed page ─────────────────────────────────────────────────── */
export default function Feed() {
  const { profile } = useAuth();
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const isGuest = !profile;
  const [posts, setPosts]         = useState<Post[]>([]);
  const [missions, setMissions]   = useState<FeedMission[]>([]);
  const [myLikes, setMyLikes]     = useState<Set<string>>(new Set());
  const [myReposts, setMyReposts] = useState<Set<string>>(new Set());
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments]   = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'all' | 'posts' | 'missions'>('all');
  const [creating, setCreating]   = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchFeed(); }, [profile]);

  async function fetchFeed() {
    setLoading(true);
    const [postsRes, missionsRes] = await Promise.all([
      supabase.from('posts')
        .select('*, author:profiles!author_id(id,full_name,avatar_url,role,company_name)')
        .order('created_at', { ascending: false }).limit(60),
      supabase.from('missions')
        // colonnes sûres uniquement (pas d'adresse exacte ni GPS) — valable invité comme connecté
        .select('id,organisateur_id,title,description,service_type,skills_required,ville,event_date,start_time,end_time,hourly_rate,slots_total,slots_filled,is_urgent,status,venue_photo_url,created_at, organisateur:profiles!organisateur_id(id,full_name,avatar_url,role,company_name)')
        .eq('status', 'open')
        .gte('event_date', new Date().toISOString().slice(0, 10)) // masquer les missions dont la date est passée
        .order('created_at', { ascending: false }).limit(30),
    ]);

    let postsData = (postsRes.data || []) as Post[];
    let missionsData = (missionsRes.data || []) as unknown as FeedMission[];

    // Invité : masquer les noms complets (prénom uniquement)
    if (isGuest) {
      const first = (n?: string | null) => (n || '').trim().split(' ')[0] || 'Utilisateur';
      postsData = postsData.map(p => p.author ? { ...p, author: { ...p.author, full_name: first(p.author.full_name) } } : p);
      missionsData = missionsData.map(m => m.organisateur ? { ...m, organisateur: { ...m.organisateur, full_name: first(m.organisateur.full_name) } } : m);
    }

    setPosts(postsData);
    setMissions(missionsData);

    // État des « j'aime » uniquement pour un utilisateur connecté
    if (profile) {
      const { data: likes } = await supabase.from('post_likes').select('post_id').eq('user_id', profile.id);
      setMyLikes(new Set((likes || []).map((l: { post_id: string }) => l.post_id)));
    } else {
      setMyLikes(new Set());
    }
    setLoading(false);
  }

  async function toggleLike(post: Post) {
    if (!requireAuth('aimer une publication')) return;
    if (!profile) return;
    const liked = myLikes.has(post.id);
    setMyLikes(prev => { const s = new Set(prev); liked ? s.delete(post.id) : s.add(post.id); return s; });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: p.likes_count + (liked ? -1 : 1) } : p));
    if (liked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', profile.id);
      await supabase.from('posts').update({ likes_count: Math.max(0, post.likes_count - 1) }).eq('id', post.id);
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: profile.id });
      await supabase.from('posts').update({ likes_count: post.likes_count + 1 }).eq('id', post.id);
    }
  }

  async function repost(post: Post) {
    if (!requireAuth('reposter une publication')) return;
    if (!profile || myReposts.has(post.id)) return;
    setMyReposts(prev => new Set([...prev, post.id]));
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, reposts_count: p.reposts_count + 1 } : p));
    await supabase.from('posts').update({ reposts_count: post.reposts_count + 1 }).eq('id', post.id);
    toast.success('Reposté !');
  }

  async function toggleComments(postId: string) {
    if (openComments === postId) { setOpenComments(null); return; }
    setOpenComments(postId);
    setCommentText('');
    if (!comments[postId]) {
      const { data } = await supabase.from('post_comments')
        .select('*, author:profiles!author_id(full_name,avatar_url)')
        .eq('post_id', postId).order('created_at', { ascending: true });
      let cData = (data || []) as Comment[];
      if (isGuest) cData = cData.map(c => ({ ...c, author: { ...c.author, full_name: (c.author?.full_name || '').trim().split(' ')[0] || 'Utilisateur' } }));
      setComments(prev => ({ ...prev, [postId]: cData }));
    }
  }

  async function submitComment(post: Post) {
    if (!requireAuth('commenter')) return;
    if (!commentText.trim() || !profile) return;
    setCommentLoading(true);
    const { data, error } = await supabase.from('post_comments')
      .insert({ post_id: post.id, author_id: profile.id, content: commentText.trim() })
      .select('*, author:profiles!author_id(full_name,avatar_url)').single();
    if (error) { toast.error('Erreur'); setCommentLoading(false); return; }
    setComments(prev => ({ ...prev, [post.id]: [...(prev[post.id] || []), data as Comment] }));
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, comments_count: p.comments_count + 1 } : p));
    await supabase.from('posts').update({ comments_count: post.comments_count + 1 }).eq('id', post.id);
    setCommentText('');
    setCommentLoading(false);
  }

  async function uploadPostImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingImg(true);
    const ext = file.name.split('.').pop();
    const path = `posts/${profile.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file);
    if (error) { toast.error(error.message); setUploadingImg(false); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setPostImage(data.publicUrl);
    setUploadingImg(false);
  }

  async function createPost() {
    if (!requireAuth('publier une publication')) return;
    if (!postContent.trim() || !profile) return;
    setSubmitting(true);
    const { error } = await supabase.from('posts').insert({
      author_id: profile.id, content: postContent.trim(), image_url: postImage || null,
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success('Publié !');
    setPostContent(''); setPostImage(null); setCreating(false);
    await fetchFeed();
    setSubmitting(false);
  }

  async function applyMission(missionId: string) {
    if (!requireAuth('postuler à une mission')) return;
    if (!profile) return;
    const { error } = await supabase.from('applications').insert({
      mission_id: missionId, freelance_id: profile.id, status: 'pending',
    });
    if (error) {
      if (error.code === '23505') toast.error('Vous avez déjà postulé');
      else toast.error('Erreur lors de la candidature');
    } else toast.success('Candidature envoyée !');
  }

  const isFreelance = profile?.role === 'freelance';

  const feedItems: FeedItem[] = [];
  if (tab !== 'missions') posts.forEach(p => feedItems.push({ kind: 'post', ts: p.created_at, post: p }));
  if (tab !== 'posts')    missions.forEach(m => feedItems.push({ kind: 'mission', ts: m.created_at ?? new Date(0).toISOString(), mission: m }));
  feedItems.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 48 }}>

        {/* Alerte S.O.S Brigade épinglée (freelance) */}
        <SosFeedAlert />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(201,168,76,0.16), rgba(201,168,76,0.05))',
              border: '1px solid rgba(201,168,76,0.28)' }}>
              <Newspaper size={21} color="#d4af37" strokeWidth={1.7} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold" style={{ color: '#f0e6d3', margin: 0 }}>Fil d'actualité</h1>
              <p style={{ fontSize: 12, color: '#7a6a8a', margin: 0 }}>La communauté EventBridge en direct</p>
            </div>
          </div>
          <button onClick={() => { if (!requireAuth('publier une publication')) return; setCreating(c => !c); setPostContent(''); setPostImage(null); }}
            className="btn-gold px-4 py-2.5 rounded-xl text-sm font-bold text-[#261642] flex items-center gap-1.5">
            {creating ? <><X size={15} /> Annuler</> : <><Plus size={16} /> Publier</>}
          </button>
        </div>

        {/* Create post */}
        {creating && (
          <motion.div className="card-glass p-4 mb-5"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Avatar src={profile?.avatar_url} name={profile?.full_name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <textarea rows={3} value={postContent} onChange={e => setPostContent(e.target.value)}
                  placeholder={isFreelance
                    ? 'Partagez votre expérience, une mission réussie...'
                    : 'Partagez votre after-event, retour d\'expérience...'}
                  style={{ width: '100%', background: 'rgba(82,54,124,0.4)',
                    border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12,
                    padding: '11px 15px', color: '#f0e6d3', fontSize: 14.5,
                    resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                />
                {postImage && (
                  <div style={{ position: 'relative', marginTop: 8, borderRadius: 12, overflow: 'hidden' }}>
                    <img src={postImage} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => setPostImage(null)}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.65)',
                        border: 'none', borderRadius: 999, color: '#fff', width: 28, height: 28,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={15} />
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 11, gap: 10 }}>
                  <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={uploadPostImage} />
                  <button onClick={() => fileRef.current?.click()}
                    style={{ fontSize: 13, color: '#b8a898', background: 'transparent', border: 'none',
                      cursor: uploadingImg ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {uploadingImg ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} color="#d4af37" />} Photo
                  </button>
                  <button onClick={createPost} disabled={!postContent.trim() || submitting}
                    className="btn-gold px-5 py-2 rounded-lg text-sm font-bold text-[#261642]"
                    style={{ marginLeft: 'auto', opacity: (!postContent.trim() || submitting) ? 0.5 : 1 }}>
                    {submitting ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div style={{ display: 'inline-flex', gap: 4, marginBottom: 22, padding: 4, borderRadius: 12,
          background: 'rgba(28,17,50,0.5)', border: '1px solid rgba(201,168,76,0.12)' }}>
          {([['all', 'Tout'], ['posts', 'Posts'], ['missions', 'Missions']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '7px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.18s', border: 'none',
                background: tab === key ? 'linear-gradient(135deg,#d4af37,#e8c97a)' : 'transparent',
                color: tab === key ? '#261642' : '#b8a898' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#b8a898',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 size={28} className="animate-spin" color="#d4af37" />
            Chargement du fil...
          </div>
        ) : feedItems.length === 0 ? (
          <div className="card-glass" style={{ textAlign: 'center', padding: '56px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <Inbox size={40} color="#7a6a8a" strokeWidth={1.5} />
            </div>
            <p style={{ color: '#f0e6d3', fontSize: 15, fontWeight: 600 }}>Aucun contenu pour l'instant</p>
            <p style={{ fontSize: 12.5, color: '#7a6a8a', marginTop: 6 }}>Soyez le premier à publier !</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {feedItems.map((item, i) => (
              <motion.div
                key={item.kind === 'post' ? item.post.id : item.mission.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
              >
                {item.kind === 'post'
                  ? <PostCard post={item.post}
                      liked={myLikes.has(item.post.id)}
                      reposted={myReposts.has(item.post.id)}
                      onLike={() => toggleLike(item.post)}
                      onRepost={() => repost(item.post)}
                      onToggleComment={() => toggleComments(item.post.id)}
                      commentsOpen={openComments === item.post.id}
                      comments={comments[item.post.id] || []}
                      commentText={openComments === item.post.id ? commentText : ''}
                      onCommentChange={setCommentText}
                      onCommentSubmit={() => submitComment(item.post)}
                      commentLoading={commentLoading}
                    />
                  : <MissionFeedCard mission={item.mission}
                      isFreelance={isFreelance || isGuest}
                      onApply={() => applyMission(item.mission.id)}
                      onView={() => navigate(`/MissionDetail?id=${item.mission.id}`)}
                    />}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
