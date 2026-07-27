import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { useAuthGate } from '../contexts/AuthGateContext';
import { supabase } from '../lib/supabase';
import { type Mission } from '../types';
import { formatDateShort } from '../lib/utils';
import { formatRateLabel } from '../lib/missionPricing';
import { ServiceIcon } from '../lib/serviceIcons';
import { IcoMissions } from '../components/icons/DoodleIcons';
import { roleColor } from '../lib/roleTheme';
import { distanceKm, formatDistance } from '../lib/geo';
import toast from 'react-hot-toast';

export default function Missions() {
  const { profile } = useAuth();
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const isGuest = !profile;
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchMissions(); }, []);

  async function fetchMissions() {
    // Invité : colonnes sûres (pas d'adresse exacte ni GPS)
    const cols = isGuest
      ? 'id,organisateur_id,title,service_type,skills_required,roles,nb_days,ville,event_date,start_time,end_time,hourly_rate,slots_total,slots_filled,is_urgent,status,venue_photo_url,created_at'
      : '*';
    const org = isGuest ? 'id,full_name,avatar_url,role,company_name' : '*';
    const { data } = await supabase.from('missions')
      .select(`${cols}, organisateur:profiles!organisateur_id(${org})`)
      .eq('status', 'open')
      .gte('event_date', new Date().toISOString().slice(0, 10)) // pas de mission dont la date est passée
      .order('created_at', { ascending: false });
    setMissions((data || []) as unknown as Mission[]);
    setLoading(false);
  }

  async function postuler(missionId: string) {
    if (!requireAuth('postuler à une mission')) return;
    if (!profile) return;
    const { error } = await supabase.from('applications').insert({
      mission_id: missionId, freelance_id: profile.id, status: 'pending',
    });
    if (error) {
      if (error.code === '23505') toast.error('Vous avez déjà postulé à cette mission');
      else toast.error('Erreur lors de la candidature');
    } else {
      toast.success('Candidature envoyée !');
      // Prévenir l'organisateur AVEC le titre de la mission concernée
      const m = missions.find(x => x.id === missionId);
      if (m) {
        try {
          await supabase.from('notifications').insert({
            user_id: m.organisateur_id,
            type: 'new_application',
            title: 'Nouvelle candidature',
            body: `${profile.full_name} a postulé à votre mission "${m.title}"`,
            data: { mission_id: m.id, freelance_id: profile.id },
            is_read: false,
          });
        } catch { /* la notification ne doit jamais bloquer la candidature */ }
      }
    }
  }

  const filtered = missions.filter(m => {
    if (filterUrgent && !m.is_urgent) return false;
    if (filterType && m.service_type !== filterType) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const types = [...new Set(missions.map(m => m.service_type))];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--color-text-primary)' }}><IcoMissions size={28} color={roleColor(profile?.role)} /> Missions disponibles</h1>
        {profile?.role === 'organisateur' && (
          <button onClick={() => navigate('/create-mission')} className="btn-gold px-5 py-2 rounded-xl text-sm font-bold text-[#261642]">
            + Nouvelle mission
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="card-glass p-4 mb-6 flex flex-wrap gap-3 items-center">
        <input
          className="px-3 py-2 rounded-lg text-sm outline-none flex-1 min-w-40"
          style={{ background: 'var(--color-input-bg)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--color-text-primary)' }}
          placeholder="🔍 Rechercher..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--color-input-bg)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--color-text-primary)' }}
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Tous les types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setFilterUrgent(!filterUrgent)}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all border"
          style={{
            background: filterUrgent ? 'rgba(239,68,68,0.2)' : 'transparent',
            borderColor: filterUrgent ? '#ef4444' : 'rgba(201,168,76,0.2)',
            color: filterUrgent ? '#ef4444' : 'var(--color-text-secondary)',
          }}>
          ⚡ Urgent
        </button>
        <span className="text-sm ml-auto" style={{ color: 'var(--color-text-secondary)' }}>{filtered.length} mission(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>Chargement des missions...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 card-glass">
          <p className="text-4xl mb-4">🔍</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>Aucune mission trouvée</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(m => (
            <MissionCard key={m.id} mission={m} onApply={() => postuler(m.id)}
              onView={() => navigate(`/MissionDetail?id=${m.id}`)}
              isFreelance={profile?.role === 'freelance' || isGuest}
              userLat={profile?.latitude}
              userLng={profile?.longitude}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

function MissionCard({ mission: m, onApply, onView, isFreelance, userLat, userLng }: {
  mission: Mission; onApply: () => void; onView: () => void; isFreelance: boolean;
  userLat?: number | null; userLng?: number | null;
}) {
  const slots_filled = m.slots_filled || 0;
  const pct = Math.round((slots_filled / m.slots_total) * 100);
  const dist = (userLat && userLng && m.latitude && m.longitude)
    ? distanceKm(userLat, userLng, m.latitude, m.longitude)
    : null;

  return (
    <div className="card-glass overflow-hidden hover:-translate-y-1 transition-all duration-300 hover:border-[rgba(201,168,76,0.4)] cursor-pointer flex flex-col"
      onClick={onView}>
      {m.venue_photo_url && (
        <div style={{ aspectRatio: '16/9', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={m.venue_photo_url}
            alt="Photo du lieu"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <ServiceIcon type={m.service_type} size={26} />
          <div>
            <h3 className="font-semibold text-sm line-clamp-1" style={{ color: 'var(--color-text-primary)' }}>{m.title}</h3>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{m.service_type}</p>
          </div>
        </div>
        {m.is_urgent && (
          <span className="badge-urgent px-2 py-0.5 rounded-full text-xs font-bold shrink-0">⚡ URGENT</span>
        )}
      </div>

      <div className="space-y-1.5 mb-4 flex-1">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span>📅</span><span>{formatDateShort(m.event_date)} · {m.start_time?.substring(0,5)} - {m.end_time?.substring(0,5)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span>📍</span>
          <span>{m.location}{m.ville ? `, ${m.ville}` : ''}</span>
          {dist !== null && (
            <span style={{ marginLeft: 4, color: 'var(--color-gold-primary)', fontWeight: 600 }}>
              · {formatDistance(dist)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span>👥</span><span>{slots_filled}/{m.slots_total} poste(s)</span>
          </div>
          <div className="text-sm font-bold" style={{ color: 'var(--color-gold-primary)' }}>{formatRateLabel(m.roles, m.hourly_rate)}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="w-full h-1 rounded-full" style={{ background: 'var(--color-surface-strong)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(to right,var(--color-gold-primary),var(--color-gold-light))' }} />
        </div>
      </div>

      {isFreelance && (
        <button className="btn-gold w-full py-2 rounded-lg text-sm font-bold text-[#261642]"
          onClick={e => { e.stopPropagation(); onApply(); }}>
          Postuler →
        </button>
      )}
      </div>
    </div>
  );
}
