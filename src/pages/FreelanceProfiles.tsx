import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Star, MapPin } from 'lucide-react';
import { type Profile } from '../types';
import { formatCFA, getInitials, COMPETENCES } from '../lib/utils';
import { distanceKm, formatDistance } from '../lib/geo';
import CertifiedBadge from '../components/CertifiedBadge';
import { IcoUsers } from '../components/icons/DoodleIcons';
import { roleColor } from '../lib/roleTheme';

export default function FreelanceProfiles() {
  const { profile: me } = useAuth();
  const isGuest = !me;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterDispo, setFilterDispo] = useState(false);

  useEffect(() => { fetchProfiles(); }, []);

  async function fetchProfiles() {
    // Invité : colonnes d'affichage seulement (la RLS limite déjà aux profils actifs)
    const cols = 'id,full_name,avatar_url,role,ville,skills,hourly_rate,avg_rating,total_reviews,is_certified,certification_level,is_available';
    let q = supabase.from('profiles').select(isGuest ? cols : '*').eq('role', 'freelance');
    if (!isGuest) q = q.eq('status', 'active');
    const { data } = await q.order('avg_rating', { ascending: false });
    setProfiles((data || []) as unknown as Profile[]);
    setLoading(false);
  }

  const filtered = profiles.filter(p => {
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSkill && !(p.skills || []).includes(filterSkill)) return false;
    if (filterDispo && !p.is_available) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: '#f0e6d3' }}><IcoUsers size={26} color={roleColor(me?.role)} /> Freelances</h1>

      {/* Filtres */}
      <div className="card-glass p-4 mb-6 flex flex-wrap gap-3 items-center">
        <input
          className="px-3 py-2 rounded-lg text-sm outline-none flex-1 min-w-40"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          placeholder="Rechercher un freelance..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' }}
          value={filterSkill} onChange={e => setFilterSkill(e.target.value)}>
          <option value="">Toutes compétences</option>
          {COMPETENCES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setFilterDispo(!filterDispo)}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all border"
          style={{
            background: filterDispo ? 'rgba(16,185,129,0.15)' : 'transparent',
            borderColor: filterDispo ? '#10b981' : 'rgba(201,168,76,0.2)',
            color: filterDispo ? '#10b981' : '#b8a898',
          }}>
          <span className="inline-flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Disponibles
          </span>
        </button>
        <span className="text-sm ml-auto" style={{ color: '#b8a898' }}>{filtered.length} freelance(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#b8a898' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 card-glass">
          <div className="flex justify-center mb-4"><Users size={40} color="#7a6a8a" strokeWidth={1.5} /></div>
          <p style={{ color: '#b8a898' }}>Aucun freelance trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(p => (
            <FreelanceCard key={p.id} profile={p}
              userLat={me?.latitude}
              userLng={me?.longitude}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

function FreelanceCard({ profile: p, userLat, userLng }: {
  profile: Profile; userLat?: number | null; userLng?: number | null;
}) {
  const navigate = useNavigate();
  const dist = (userLat && userLng && p.latitude && p.longitude)
    ? distanceKm(userLat, userLng, p.latitude, p.longitude)
    : null;
  return (
    <div className="card-glass p-6 hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center gap-4 mb-4">
        {p.avatar_url ? (
          <img src={p.avatar_url} className="w-14 h-14 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg"
            style={{ background: 'linear-gradient(135deg,#d4af37,#e8c97a)', color: '#261642' }}>
            {getInitials(p.full_name)}
          </div>
        )}
        <div>
          <h3 className="font-semibold flex items-center gap-1.5" style={{ color: '#f0e6d3' }}>
            {p.full_name}
            <CertifiedBadge level={p.certification_level} certified={p.is_certified} />
          </h3>
          <div className="flex items-center gap-1 mt-0.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const on = i < Math.round(p.avg_rating || 0);
              return <Star key={i} size={13} color={on ? '#d4af37' : '#52367c'} fill={on ? '#d4af37' : 'none'} />;
            })}
            <span className="text-xs ml-1" style={{ color: '#b8a898' }}>{p.avg_rating?.toFixed(1) || '–'} ({p.total_reviews || 0})</span>
          </div>
        </div>
      </div>

      {/* Compétences */}
      {(p.skills || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(p.skills || []).slice(0, 3).map(s => (
            <span key={s} className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
              {s}
            </span>
          ))}
          {(p.skills || []).length > 3 && (
            <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(82,54,124,0.5)', color: '#7a6a7a' }}>
              +{(p.skills || []).length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm mb-4">
        {p.hourly_rate && <span className="font-bold" style={{ color: '#d4af37' }}>{formatCFA(p.hourly_rate)}/h</span>}
        {p.ville && <span style={{ color: '#b8a898' }} className="inline-flex items-center gap-1.5"><MapPin size={13} /> {p.ville}</span>}
      </div>

      <div className="flex items-center justify-between">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="text-xs px-2 py-1 rounded-full"
            style={{
              background: p.is_available ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: p.is_available ? '#10b981' : '#f59e0b',
            }}>
            <span className="inline-flex items-center gap-1.5">
              <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                background: p.is_available ? '#10b981' : '#f59e0b' }} />
              {p.is_available ? 'Disponible' : 'Sur demande'}
            </span>
          </span>
          {dist !== null && (
            <span style={{ fontSize: 11, color: '#d4af37', fontWeight: 600, paddingLeft: 8 }} className="inline-flex items-center gap-1">
              <MapPin size={11} /> à {formatDistance(dist)}
            </span>
          )}
        </div>
        <button onClick={() => navigate(`/public-profile?id=${p.id}`)}
          className="btn-outline-gold px-4 py-1.5 rounded-lg text-sm">Voir profil</button>
      </div>
    </div>
  );
}
