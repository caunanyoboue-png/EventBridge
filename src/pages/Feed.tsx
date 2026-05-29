import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Mission } from '../types';
import { formatCFA, SERVICE_ICONS, getInitials } from '../lib/utils';
import toast from 'react-hot-toast';

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
    ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 800,
        color: '#261642', background: 'linear-gradient(135deg,#c9a84c,#e8c97a)' }}>
        {getInitials(name || 'U')}
      </div>;
}

/* ── Action button ──────────────────────────────────────────────────── */
function ActionBtn({ onClick, active, icon, label, activeColor }: {
  onClick: () => void; active: boolean; icon: string; label: string; activeColor: string;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      padding: '9px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
      background: active ? `${activeColor}15` : 'transparent',
      color: active ? activeColor : '#6a5a7a',
      fontWeight: active ? 700 : 500, transition: 'all 0.15s',
    }}>
      <span>{icon}</span><span className="hidden sm:inline">{label}</span>
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
  const roleColor = isOrg ? '#60a5fa' : '#c9a84c';

  return (
    <div className="card-glass overflow-hidden">
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar src={a.avatar_url} name={a.full_name} size={42} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f0e6d3' }}>{a.full_name || 'Utilisateur'}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
              background: isOrg ? 'rgba(96,165,250,0.12)' : 'rgba(201,168,76,0.12)',
              color: roleColor, border: `1px solid ${roleColor}30` }}>
              {isOrg ? 'ORGANISATEUR' : 'FREELANCE'}
            </span>
          </div>
          <p style={{ fontSize: 11, color: '#5a4a6a', marginTop: 2 }}>{timeAgo(post.created_at)}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 16px 12px' }}>
        <p style={{ fontSize: 14, color: '#d0c0b0', lineHeight: 1.78, whiteSpace: 'pre-wrap', margin: 0 }}>
          {post.content}
        </p>
      </div>

      {/* Image */}
      {post.image_url && (
        <img src={post.image_url} alt="" style={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block' }} />
      )}

      {/* Counts bar */}
      {(post.likes_count > 0 || post.comments_count > 0 || post.reposts_count > 0) && (
        <div style={{ padding: '6px 16px', display: 'flex', gap: 14,
          borderTop: '1px solid rgba(201,168,76,0.06)' }}>
          {post.likes_count  > 0 && <span style={{ fontSize: 12, color: '#5a4a6a' }}>❤ {post.likes_count}</span>}
          {post.comments_count > 0 && <span style={{ fontSize: 12, color: '#5a4a6a' }}>💬 {post.comments_count}</span>}
          {post.reposts_count > 0 && <span style={{ fontSize: 12, color: '#5a4a6a' }}>🔁 {post.reposts_count}</span>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
        <ActionBtn onClick={onLike}          active={liked}    icon="❤"  label="J'aime"    activeColor="#ef4444" />
        <ActionBtn onClick={onToggleComment} active={commentsOpen} icon="💬" label="Commenter" activeColor="#c9a84c" />
        <ActionBtn onClick={onRepost}        active={reposted} icon="🔁" label="Reposter"  activeColor="#10b981" />
      </div>

      {/* Comments */}
      {commentsOpen && (
        <div style={{ borderTop: '1px solid rgba(201,168,76,0.08)', padding: '12px 14px' }}>
          {comments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 8 }}>
                  <Avatar src={c.author.avatar_url} name={c.author.full_name} size={28} />
                  <div style={{ background: 'rgba(82,54,124,0.4)', borderRadius: 10, padding: '6px 11px', flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c9a84c' }}>{c.author.full_name}</span>
                    <p style={{ fontSize: 13, color: '#d0c0b0', margin: '3px 0 0', lineHeight: 1.5 }}>{c.content}</p>
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
                borderRadius: 20, padding: '8px 14px', color: '#f0e6d3', fontSize: 13, outline: 'none' }}
            />
            <button onClick={onCommentSubmit} disabled={!commentText.trim() || commentLoading}
              style={{ padding: '8px 16px', background: '#c9a84c', border: 'none', borderRadius: 20,
                color: '#261642', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                opacity: (!commentText.trim() || commentLoading) ? 0.45 : 1 }}>
              →
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
  return (
    <div className="card-glass overflow-hidden">
      {m.venue_photo_url && (
        <div style={{ aspectRatio: '16/7', overflow: 'hidden', cursor: 'pointer' }} onClick={onView}>
          <img src={m.venue_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      <div style={{ padding: 16 }}>
        {/* Posted by */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Avatar src={org.avatar_url} name={org.full_name} size={26} />
          <span style={{ fontSize: 12, color: '#b8a898', flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#f0e6d3' }}>{org.full_name || org.company_name}</span>
            {' '}a publié une mission
          </span>
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, flexShrink: 0,
            background: 'rgba(16,185,129,0.1)', color: '#10b981',
            border: '1px solid rgba(16,185,129,0.25)', fontWeight: 700 }}>
            OUVERT
          </span>
        </div>

        {/* Mission info */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, cursor: 'pointer' }} onClick={onView}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{SERVICE_ICONS[m.service_type] || '🎯'}</span>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f0e6d3', margin: '0 0 5px' }}>{m.title}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: '#b8a898' }}>
              {m.event_date && <span>📅 {new Date(m.event_date).toLocaleDateString('fr-CI', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
              {m.ville && <span>📍 {m.ville}</span>}
              <span>👥 {m.slots_filled || 0}/{m.slots_total} poste(s)</span>
              <span style={{ color: '#c9a84c', fontWeight: 700 }}>💰 {formatCFA(m.hourly_rate)}/h</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onView}
            className="btn-outline-gold px-4 py-2 rounded-lg text-sm"
            style={{ flex: 1 }}>
            Voir les détails
          </button>
          {isFreelance && (
            <button onClick={onApply}
              className="btn-gold px-4 py-2 rounded-lg text-sm font-bold text-[#261642]"
              style={{ flex: 1 }}>
              Postuler →
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
  const navigate = useNavigate();
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

  useEffect(() => { if (profile) fetchFeed(); }, [profile]);

  async function fetchFeed() {
    setLoading(true);
    const [postsRes, missionsRes, likesRes] = await Promise.all([
      supabase.from('posts')
        .select('*, author:profiles!author_id(id,full_name,avatar_url,role,company_name)')
        .order('created_at', { ascending: false }).limit(60),
      supabase.from('missions')
        .select('*, organisateur:profiles!organisateur_id(id,full_name,avatar_url,role,company_name)')
        .eq('status', 'open').order('created_at', { ascending: false }).limit(30),
      supabase.from('post_likes').select('post_id').eq('user_id', profile!.id),
    ]);
    setPosts((postsRes.data || []) as Post[]);
    setMissions((missionsRes.data || []) as FeedMission[]);
    setMyLikes(new Set((likesRes.data || []).map((l: { post_id: string }) => l.post_id)));
    setLoading(false);
  }

  async function toggleLike(post: Post) {
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
      setComments(prev => ({ ...prev, [postId]: (data || []) as Comment[] }));
    }
  }

  async function submitComment(post: Post) {
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
    if (!profile) return;
    const { error } = await supabase.from('applications').insert({
      mission_id: missionId, freelance_id: profile.id, status: 'pending',
    });
    if (error) {
      if (error.code === '23505') toast.error('Vous avez déjà postulé');
      else toast.error('Erreur lors de la candidature');
    } else toast.success('Candidature envoyée ! 🎉');
  }

  const isFreelance = profile?.role === 'freelance';

  const feedItems: FeedItem[] = [];
  if (tab !== 'missions') posts.forEach(p => feedItems.push({ kind: 'post', ts: p.created_at, post: p }));
  if (tab !== 'posts')    missions.forEach(m => feedItems.push({ kind: 'mission', ts: m.created_at ?? new Date(0).toISOString(), mission: m }));
  feedItems.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 48 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 className="font-display text-2xl font-bold" style={{ color: '#f0e6d3' }}>🏠 Fil d'actualité</h1>
          <button onClick={() => { setCreating(c => !c); setPostContent(''); setPostImage(null); }}
            className="btn-gold px-4 py-2 rounded-xl text-sm font-bold text-[#261642]">
            {creating ? '✕ Annuler' : '+ Publier'}
          </button>
        </div>

        {/* Create post */}
        {creating && (
          <div className="card-glass p-4 mb-5">
            <div style={{ display: 'flex', gap: 12 }}>
              <Avatar src={profile?.avatar_url} name={profile?.full_name} size={38} />
              <div style={{ flex: 1 }}>
                <textarea rows={3} value={postContent} onChange={e => setPostContent(e.target.value)}
                  placeholder={isFreelance
                    ? 'Partagez votre expérience, une mission réussie...'
                    : 'Partagez votre after-event, retour d\'expérience...'}
                  style={{ width: '100%', background: 'rgba(82,54,124,0.4)',
                    border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10,
                    padding: '10px 14px', color: '#f0e6d3', fontSize: 14,
                    resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                />
                {postImage && (
                  <div style={{ position: 'relative', marginTop: 8, borderRadius: 10, overflow: 'hidden' }}>
                    <img src={postImage} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => setPostImage(null)}
                      style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)',
                        border: 'none', borderRadius: 999, color: '#fff', width: 26, height: 26,
                        cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ✕
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, gap: 10 }}>
                  <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={uploadPostImage} />
                  <button onClick={() => fileRef.current?.click()}
                    style={{ fontSize: 13, color: '#b8a898', background: 'transparent', border: 'none',
                      cursor: uploadingImg ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {uploadingImg ? '⏳' : '🖼'} Photo
                  </button>
                  <button onClick={createPost} disabled={!postContent.trim() || submitting}
                    className="btn-gold px-5 py-2 rounded-lg text-sm font-bold text-[#261642]"
                    style={{ marginLeft: 'auto', opacity: (!postContent.trim() || submitting) ? 0.5 : 1 }}>
                    {submitting ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {([['all', 'Tout'], ['posts', 'Posts'], ['missions', 'Missions']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: tab === key ? 'rgba(201,168,76,0.15)' : 'transparent',
                border: `1px solid ${tab === key ? '#c9a84c' : 'rgba(201,168,76,0.2)'}`,
                color: tab === key ? '#c9a84c' : '#b8a898' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#b8a898' }}>Chargement du fil...</div>
        ) : feedItems.length === 0 ? (
          <div className="card-glass" style={{ textAlign: 'center', padding: '56px 24px' }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>📭</p>
            <p style={{ color: '#b8a898' }}>Aucun contenu pour l'instant</p>
            <p style={{ fontSize: 12, color: '#5a4a6a', marginTop: 6 }}>Soyez le premier à publier !</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {feedItems.map(item =>
              item.kind === 'post'
                ? <PostCard key={item.post.id} post={item.post}
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
                : <MissionFeedCard key={item.mission.id} mission={item.mission}
                    isFreelance={isFreelance}
                    onApply={() => applyMission(item.mission.id)}
                    onView={() => navigate(`/MissionDetail?id=${item.mission.id}`)}
                  />
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
