import { useState, useEffect, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { type PortfolioItem } from '../types';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'Service en salle', 'Bar / Barman', 'Cuisine gastronomique', 'Hôtesse accueil',
  'Animation', 'MC / Présentateur', 'Son & Lumière', 'Photographie',
  'Vidéographie', 'Sécurité', 'Chauffeur', 'Décoration', 'Manutention',
  "Photo d'événement", 'Gala & Soirée VIP', 'Conférence & Séminaire',
  'Team Building', 'Mariage & Célébration', 'Lancement de produit',
];

const C = {
  card: 'var(--color-bg-card)', gold: 'var(--color-gold-primary)', goldLt: 'var(--color-gold-light)',
  text: 'var(--color-text-primary)', sec: 'var(--color-text-muted)', bdr: 'rgba(201,168,76,0.12)',
} as const;

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
  background: 'var(--color-input-bg)', border: '1px solid rgba(201,168,76,0.18)',
  color: C.text,
};

interface Props {
  freelanceId: string;
  editable?: boolean;
  currentUserId?: string;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24"
      fill={filled ? '#ef4444' : 'none'}
      stroke={filled ? '#ef4444' : 'currentColor'} strokeWidth="1.8">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        strokeLinejoin="round"/>
    </svg>
  );
}

export default function PortfolioSection({ freelanceId, editable = false, currentUserId }: Props) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);
  const [liked, setLiked] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [modal, setModal] = useState<{ file: File; preview: string } | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mCategory, setMCategory] = useState('');

  const canEdit = editable && currentUserId === freelanceId;

  useEffect(() => { fetchItems(); }, [freelanceId]);

  async function fetchItems() {
    const { data } = await supabase.from('portfolio_items')
      .select('*').eq('freelance_id', freelanceId)
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Image trop lourde (max 8 MB)'); return; }
    setModal({ file, preview: URL.createObjectURL(file) });
    setMTitle(''); setMDesc(''); setMCategory('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function closeModal() {
    if (modal) URL.revokeObjectURL(modal.preview);
    setModal(null);
  }

  async function handleUpload() {
    if (!modal || !currentUserId) return;
    setUploading(true);
    try {
      const ext = modal.file.name.split('.').pop() || 'jpg';
      const path = `${currentUserId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('portfolio').upload(path, modal.file, { upsert: false });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path);

      const { data: item, error: insErr } = await supabase.from('portfolio_items')
        .insert({
          freelance_id: currentUserId,
          image_url: publicUrl,
          title: mTitle.trim(),
          description: mDesc.trim() || null,
          category: mCategory,
        })
        .select('*').single();
      if (insErr) throw insErr;

      // Publier automatiquement dans le fil d'actualité
      const feedContent = [
        mTitle.trim(),
        mCategory ? `Catégorie : ${mCategory}` : '',
        mDesc.trim(),
      ].filter(Boolean).join('\n');
      await supabase.from('posts').insert({
        author_id: currentUserId,
        content: feedContent || 'Nouvelle publication portfolio',
        image_url: publicUrl,
      });

      setItems(prev => [item, ...prev]);
      closeModal();
      toast.success('Publication ajoutée et partagée dans le fil !');
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erreur lors de l'upload");
    } finally { setUploading(false); }
  }

  async function handleDelete(item: PortfolioItem) {
    try {
      const match = item.image_url.match(/\/portfolio\/(.+)$/);
      if (match) await supabase.storage.from('portfolio').remove([match[1]]);
      await supabase.from('portfolio_items').delete().eq('id', item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Publication supprimée');
    } catch { toast.error('Erreur lors de la suppression'); }
  }

  function toggleLike(id: string) {
    setLiked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  if (loading) return null;
  if (!canEdit && items.length === 0) return null;

  return (
    <>
      {/* ── BOUTON NOUVELLE PUBLICATION ── */}
      {canEdit && items.length < 12 && (
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px',
            borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
            border: '1.5px dashed rgba(201,168,76,0.28)',
            background: 'rgba(201,168,76,0.03)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
          <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(201,168,76,0.1)',
            border: '1px solid rgba(201,168,76,0.2)', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="var(--color-gold-primary)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.8"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(201,168,76,0.8)', margin: 0 }}>
              Nouvelle publication
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0, marginTop: 1 }}>
              Ajouter une photo · {items.length}/12
            </p>
          </div>
        </label>
      )}

      {/* ── GRILLE DE PUBLICATIONS ── */}
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {items.map(item => {
            const isLiked = liked.includes(item.id);
            const isExpanded = expanded.includes(item.id);
            const date = item.created_at
              ? new Date(item.created_at).toLocaleDateString('fr-CI', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
              : '';
            const hasLongDesc = (item.description?.length ?? 0) > 100;

            return (
              <div key={item.id}
                style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 14,
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  transition: 'border-color 0.2s' }}
                onMouseEnter={e => { setHoveredId(item.id); (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.25)'; }}
                onMouseLeave={e => { setHoveredId(null); (e.currentTarget as HTMLDivElement).style.borderColor = C.bdr; }}>

                {/* ── IMAGE ── */}
                <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={item.image_url} alt={item.title || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                      transition: 'transform 0.35s ease',
                      transform: hoveredId === item.id ? 'scale(1.05)' : 'scale(1)' }} />

                  {/* Badge catégorie */}
                  {item.category && (
                    <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 10,
                      fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                      letterSpacing: '0.04em', background: `${C.gold}e0`,
                      color: '#261642', backdropFilter: 'blur(4px)' }}>
                      {item.category}
                    </span>
                  )}

                  {/* Hover overlay */}
                  {hoveredId === item.id && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <button onClick={() => setLightbox(item)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                          borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none',
                          backdropFilter: 'blur(6px)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                        Agrandir
                      </button>
                      {canEdit && (
                        <button onClick={e => { e.stopPropagation(); handleDelete(item); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                            borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            background: 'rgba(239,68,68,0.88)', color: '#fff', border: 'none',
                            backdropFilter: 'blur(6px)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                          </svg>
                          Supprimer
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── CONTENU POST ── */}
                <div style={{ padding: '12px 14px 10px', flex: 1,
                  display: 'flex', flexDirection: 'column', gap: 4 }}>

                  {item.title && (
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.4 }}>
                      {item.title}
                    </p>
                  )}

                  {/* Description */}
                  {item.description && (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0,
                        lineHeight: 1.6, fontStyle: 'italic',
                        overflow: isExpanded ? 'visible' : 'hidden',
                        display: isExpanded ? 'block' : '-webkit-box',
                        WebkitLineClamp: isExpanded ? undefined : 3,
                        WebkitBoxOrient: 'vertical' as const }}>
                        {item.description}
                      </p>
                      {hasLongDesc && (
                        <button onClick={() => toggleExpand(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 11, color: C.gold, padding: 0, marginTop: 2 }}>
                          {isExpanded ? 'Voir moins' : 'Voir plus'}
                        </button>
                      )}
                    </div>
                  )}

                  {date && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                      {date}
                    </p>
                  )}

                  {/* Barre d'actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6,
                    paddingTop: 8, borderTop: '1px solid rgba(201,168,76,0.07)' }}>

                    <button onClick={() => toggleLike(item.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: isLiked ? '#ef4444' : 'var(--color-text-muted)',
                        fontSize: 12, fontWeight: 500, transition: 'color 0.15s' }}>
                      <HeartIcon filled={isLiked} />
                      J'aime
                    </button>

                    <button onClick={() => setLightbox(item)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 500,
                        transition: 'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      Voir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && canEdit && (
        <div style={{ textAlign: 'center', padding: '28px 24px', background: C.card,
          border: `1px solid ${C.bdr}`, borderRadius: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>
            Aucune publication pour l'instant.<br/>
            Ajoutez une photo pour la mettre en avant.
          </p>
        </div>
      )}

      {/* ── MODAL NOUVELLE PUBLICATION ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 400, padding: 20, overflowY: 'auto' }}
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={{ background: '#16102e', border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: 16, padding: 24, width: '100%', maxWidth: 440,
            margin: 'auto' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>
                Nouvelle publication
              </h3>
              <button onClick={closeModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: C.sec, fontSize: 20, lineHeight: 1, padding: 4 }}>
                ×
              </button>
            </div>

            {/* Aperçu image */}
            <img src={modal.preview} alt=""
              style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover',
                borderRadius: 10, marginBottom: 16, display: 'block' }} />

            {/* Titre */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)',
                display: 'block', marginBottom: 6 }}>
                Titre <span style={{ opacity: 0.5 }}>(optionnel)</span>
              </label>
              <input value={mTitle} onChange={e => setMTitle(e.target.value)}
                placeholder="Ex: Service VIP – Gala de fin d'année" style={inp} />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)',
                display: 'block', marginBottom: 6 }}>
                Description <span style={{ opacity: 0.5 }}>(optionnel)</span>
              </label>
              <textarea
                value={mDesc}
                onChange={e => setMDesc(e.target.value)}
                rows={3}
                placeholder="Décrivez cette photo — type de service, ambiance, contexte…"
                style={{ ...inp, resize: 'none', lineHeight: 1.55 }} />
              <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '4px 0 0',
                textAlign: 'right' }}>
                {mDesc.length}/400
              </p>
            </div>

            {/* Catégorie */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)',
                display: 'block', marginBottom: 6 }}>
                Catégorie <span style={{ opacity: 0.5 }}>(optionnel)</span>
              </label>
              <select value={mCategory} onChange={e => setMCategory(e.target.value)} style={inp}>
                <option value="">Sélectionner...</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c} style={{ background: 'var(--color-bg-primary)' }}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeModal} disabled={uploading}
                style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13,
                  cursor: 'pointer', background: 'transparent',
                  border: '1px solid rgba(201,168,76,0.2)', color: C.sec }}>
                Annuler
              </button>
              <button onClick={handleUpload} disabled={uploading}
                style={{ flex: 2, padding: '11px', borderRadius: 10, fontSize: 13,
                  fontWeight: 700, cursor: uploading ? 'wait' : 'pointer', color: '#261642',
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})`,
                  border: 'none', opacity: uploading ? 0.75 : 1, transition: 'opacity 0.15s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {uploading
                  ? <><Loader2 size={15} className="animate-spin" /> Publication…</>
                  : <><Check size={15} /> Publier</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 400, padding: 20 }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth: 760, width: '100%', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)}
              style={{ position: 'absolute', top: -44, right: 0, background: 'none',
                border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)',
                fontSize: 30, lineHeight: 1 }}>
              ×
            </button>
            <img src={lightbox.image_url} alt={lightbox.title || ''}
              style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain',
                borderRadius: 12, display: 'block' }} />
            {(lightbox.title || lightbox.category || lightbox.description) && (
              <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.05)',
                borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: lightbox.description ? 8 : 0 }}>
                  {lightbox.category && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px',
                      borderRadius: 999, background: `${C.gold}20`, color: C.gold,
                      border: `1px solid ${C.gold}40`, flexShrink: 0 }}>
                      {lightbox.category}
                    </span>
                  )}
                  {lightbox.title && (
                    <span style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>
                      {lightbox.title}
                    </span>
                  )}
                </div>
                {lightbox.description && (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0,
                    lineHeight: 1.7, fontStyle: 'italic' }}>
                    {lightbox.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
