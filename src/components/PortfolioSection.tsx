import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { type PortfolioItem } from '../types';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'Service en salle', 'Bar / Barman', 'Cuisine gastronomique', 'Hôtesse accueil',
  'Animation', 'MC / Présentateur', 'Son & Lumière', 'Photographie',
  'Vidéographie', 'Sécurité', 'Chauffeur', 'Décoration', 'Manutention',
];

const C = {
  card: '#1a1232', gold: '#c9a84c', goldLt: '#e8c97a',
  text: '#f0e6d3', sec: 'rgba(240,230,211,0.45)', bdr: 'rgba(201,168,76,0.12)',
} as const;

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
  background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.18)',
  color: C.text,
};

interface Props {
  freelanceId: string;
  editable?: boolean;
  currentUserId?: string;
}

export default function PortfolioSection({ freelanceId, editable = false, currentUserId }: Props) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Modal state
  const [modal, setModal] = useState<{ file: File; preview: string } | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mCategory, setMCategory] = useState('');

  const canEdit = editable && currentUserId === freelanceId;

  useEffect(() => {
    fetchItems();
  }, [freelanceId]);

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
    setMTitle(''); setMCategory('');
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
        .insert({ freelance_id: currentUserId, image_url: publicUrl, title: mTitle.trim(), category: mCategory })
        .select('*').single();
      if (insErr) throw insErr;

      setItems(prev => [item, ...prev]);
      closeModal();
      toast.success('Photo ajoutée au portfolio !');
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erreur lors de l'upload");
    } finally { setUploading(false); }
  }

  async function handleDelete(item: PortfolioItem) {
    try {
      // Extract storage path from URL
      const match = item.image_url.match(/\/portfolio\/(.+)$/);
      if (match) await supabase.storage.from('portfolio').remove([match[1]]);
      await supabase.from('portfolio_items').delete().eq('id', item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Photo supprimée');
    } catch { toast.error('Erreur lors de la suppression'); }
  }

  if (loading) return null;
  if (!canEdit && items.length === 0) return null;

  return (
    <>
      <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 16, padding: '22px 28px', marginBottom: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(201,168,76,0.5)', margin: 0 }}>
            Portfolio
          </p>
          <span style={{ fontSize: 11, color: 'rgba(240,230,211,0.3)' }}>
            {items.length} photo{items.length !== 1 ? 's' : ''}
            {canEdit && ' · max 12'}
          </span>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>

          {/* Upload card — editable uniquement */}
          {canEdit && items.length < 12 && (
            <label
              style={{ aspectRatio: '1', borderRadius: 10, cursor: 'pointer', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: '1.5px dashed rgba(201,168,76,0.25)', background: 'rgba(201,168,76,0.03)',
                transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.03)'}
            >
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#c9a84c" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.55"/>
              </svg>
              <span style={{ fontSize: 11, color: 'rgba(201,168,76,0.45)', textAlign: 'center', lineHeight: 1.5 }}>
                Ajouter<br/>une photo
              </span>
            </label>
          )}

          {/* Photos */}
          {items.map(item => (
            <div key={item.id}
              style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => !canEdit && setLightbox(item)}
            >
              <img src={item.image_url} alt={item.title || 'Portfolio'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s' }}
              />

              {/* Légende */}
              {(item.title || item.category) && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '20px 10px 8px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
                  pointerEvents: 'none' }}>
                  {item.category && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                      background: `${C.gold}cc`, color: '#261642', display: 'inline-block', marginBottom: 3 }}>
                      {item.category}
                    </span>
                  )}
                  {item.title && (
                    <p style={{ fontSize: 11, color: '#fff', margin: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </p>
                  )}
                </div>
              )}

              {/* Hover overlay */}
              {hoveredId === item.id && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {canEdit ? (
                    <button onClick={e => { e.stopPropagation(); handleDelete(item); }}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none' }}>
                      Supprimer
                    </button>
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => setLightbox(item)}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="#fff" strokeWidth="1.4"/>
                        <circle cx="8" cy="8" r="2" stroke="#fff" strokeWidth="1.4"/>
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {items.length === 0 && canEdit && (
          <p style={{ fontSize: 13, color: 'rgba(240,230,211,0.28)', textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
            Montrez votre vrai travail aux organisateurs.<br/>
            Ajoutez des photos de vos missions passées.
          </p>
        )}
      </div>

      {/* ── Modal upload ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 400, padding: 20 }}
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={{ background: '#16102e', border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>
                Ajouter au portfolio
              </h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sec, fontSize: 18 }}>×</button>
            </div>

            <img src={modal.preview} alt=""
              style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 16 }} />

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(240,230,211,0.4)', display: 'block', marginBottom: 6 }}>
                Titre <span style={{ opacity: 0.5 }}>(optionnel)</span>
              </label>
              <input value={mTitle} onChange={e => setMTitle(e.target.value)}
                placeholder="Ex: Service VIP – Gala de fin d'année" style={inp} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'rgba(240,230,211,0.4)', display: 'block', marginBottom: 6 }}>
                Catégorie <span style={{ opacity: 0.5 }}>(optionnel)</span>
              </label>
              <select value={mCategory} onChange={e => setMCategory(e.target.value)} style={inp}>
                <option value="">Sélectionner...</option>
                {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#261642' }}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeModal} disabled={uploading}
                style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', color: C.sec }}>
                Annuler
              </button>
              <button onClick={handleUpload} disabled={uploading}
                style={{ flex: 2, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: uploading ? 'wait' : 'pointer', color: '#261642',
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldLt})`,
                  border: 'none', opacity: uploading ? 0.75 : 1, transition: 'opacity 0.15s' }}>
                {uploading ? 'Upload en cours…' : 'Publier dans mon portfolio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox (lecture seule) ── */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 400, padding: 20 }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth: 720, width: '100%', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)}
              style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none',
                cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 28, lineHeight: 1 }}>
              ×
            </button>
            <img src={lightbox.image_url} alt={lightbox.title || ''}
              style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, display: 'block' }} />
            {(lightbox.title || lightbox.category) && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                {lightbox.category && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                    background: `${C.gold}20`, color: C.gold, border: `1px solid ${C.gold}40` }}>
                    {lightbox.category}
                  </span>
                )}
                {lightbox.title && (
                  <span style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{lightbox.title}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
