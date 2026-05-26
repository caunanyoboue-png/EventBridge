import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import { formatRelative, getInitials } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Review {
  id: string;
  mission_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment: string;
  created_at: string;
  mission?: { title: string };
  reviewer?: { full_name: string };
  reviewed?: { full_name: string };
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRating, setFilterRating] = useState(0);

  useEffect(() => { fetchReviews(); }, []);

  async function fetchReviews() {
    const { data } = await supabase.from('reviews')
      .select(`*, mission:missions(title), reviewer:profiles!reviewer_id(full_name), reviewed:profiles!reviewed_id(full_name)`)
      .order('created_at', { ascending: false });
    setReviews((data || []) as Review[]);
    setLoading(false);
  }

  async function deleteReview(id: string) {
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) toast.error('Erreur');
    else { toast.success('Avis supprimé'); fetchReviews(); }
  }

  const filtered = reviews.filter(r => {
    if (filterRating && r.rating !== filterRating) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.reviewer?.full_name.toLowerCase().includes(q) ||
        r.reviewed?.full_name.toLowerCase().includes(q) ||
        r.comment?.toLowerCase().includes(q));
    }
    return true;
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '–';

  function Stars({ rating }: { rating: number }) {
    return (
      <span>
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} style={{ color: i <= rating ? '#c9a84c' : '#52367c' }}>★</span>
        ))}
      </span>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6" style={{ color: '#f0e6d3' }}>⭐ Gestion des avis</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card-glass p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#c9a84c' }}>{reviews.length}</div>
          <div className="text-xs mt-1" style={{ color: '#b8a898' }}>Total avis</div>
        </div>
        <div className="card-glass p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#10b981' }}>{avgRating}</div>
          <div className="text-xs mt-1" style={{ color: '#b8a898' }}>Note moyenne</div>
        </div>
        <div className="card-glass p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#ef4444' }}>
            {reviews.filter(r => r.rating <= 2).length}
          </div>
          <div className="text-xs mt-1" style={{ color: '#b8a898' }}>Avis négatifs</div>
        </div>
      </div>

      <div className="card-glass p-4 mb-6 flex flex-wrap gap-3">
        <input className="px-3 py-2 rounded-lg text-sm outline-none flex-1 min-w-40"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          placeholder="🔍 Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          value={filterRating} onChange={e => setFilterRating(Number(e.target.value))}>
          <option value={0}>Toutes les notes</option>
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
        </select>
        <span className="text-sm my-auto" style={{ color: '#b8a898' }}>{filtered.length} avis</span>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Aucun avis</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="card-glass p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#261642' }}>
                    {getInitials(r.reviewer?.full_name || '?')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className="font-medium text-sm" style={{ color: '#f0e6d3' }}>{r.reviewer?.full_name || '–'}</span>
                      <span className="text-xs" style={{ color: '#7a6a7a' }}>→ {r.reviewed?.full_name || '–'}</span>
                      <Stars rating={r.rating} />
                    </div>
                    <p className="text-xs mb-1" style={{ color: '#7a6a7a' }}>
                      {r.mission?.title} · {formatRelative(r.created_at)}
                    </p>
                    {r.comment && (
                      <p className="text-sm" style={{ color: '#b8a898' }}>"{r.comment}"</p>
                    )}
                  </div>
                </div>
                {r.rating <= 2 && (
                  <button onClick={() => deleteReview(r.id)}
                    className="px-3 py-1.5 rounded-lg text-xs shrink-0"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
