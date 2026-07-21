// Écran « Freelances recommandés » — matching multicritères pondéré (RG10-12).
// Appelle la fonction SQL match_freelances(mission_id) et classe les profils par %.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Star, MapPin, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCFA, getInitials } from '../lib/utils';
import { formatDistance } from '../lib/geo';
import { type CertificationLevel } from '../types';
import CertifiedBadge from './CertifiedBadge';

interface Match {
  freelance_id: string;
  full_name: string | null;
  avatar_url: string | null;
  ville: string | null;
  avg_rating: number | null;
  is_certified: boolean | null;
  certification_level: string | null;
  hourly_rate: number | null;
  skills: string[] | null;
  matched_skills: string[] | null;
  distance_km: number | null;
  score_pct: number | null;
}

export default function MatchedFreelances({ missionId }: { missionId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('match_freelances', { p_mission_id: missionId, p_limit: 10 });
      if (cancelled) return;
      if (error) console.error('[match_freelances]', error.message);
      setRows(error ? [] : ((data || []) as Match[]));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [missionId]);

  return (
    <div className="card-glass p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Target size={17} color="var(--color-gold-primary)" />
        <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Freelances recommandés</h2>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Classés par compatibilité — compétences 40&nbsp;% · distance 25&nbsp;% · note 20&nbsp;% · disponibilité 15&nbsp;%
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Calcul des correspondances…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Aucun freelance disponible ne correspond pour l'instant.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(r => (
            <Row key={r.freelance_id} r={r} onView={() => navigate(`/public-profile?id=${r.freelance_id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ r, onView }: { r: Match; onView: () => void }) {
  const pct = Math.round(Number(r.score_pct ?? 0));
  const rating = r.avg_rating != null ? Number(r.avg_rating) : 0;
  const scoreColor = pct >= 75 ? '#00C896' : pct >= 50 ? 'var(--color-gold-primary)' : 'var(--color-text-secondary)';

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: 'var(--color-surface)', border: '1px solid rgba(201,168,76,0.12)' }}>
      {/* Score de compatibilité */}
      <div style={{ width: 54, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{pct}%</div>
        <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>match</div>
      </div>

      {/* Avatar */}
      {r.avatar_url ? (
        <img src={r.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(201,168,76,0.25)' }} />
      ) : (
        <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#261642', background: 'linear-gradient(135deg,var(--color-gold-primary),var(--color-gold-light))' }}>
          {getInitials(r.full_name || 'U')}
        </div>
      )}

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.full_name || 'Freelance'}
          </span>
          <CertifiedBadge level={(r.certification_level as CertificationLevel) || 'none'} certified={!!r.is_certified} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1" style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
          {rating > 0 && (
            <span className="inline-flex items-center gap-1"><Star size={12} fill="var(--color-gold-primary)" color="var(--color-gold-primary)" /> {rating.toFixed(1)}</span>
          )}
          {r.distance_km != null && (
            <span className="inline-flex items-center gap-1"><MapPin size={12} /> {formatDistance(Number(r.distance_km))}</span>
          )}
          {r.ville && <span>{r.ville}</span>}
          {r.hourly_rate != null && (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-gold-primary)', fontWeight: 600 }}>
              <Wallet size={12} /> {formatCFA(Number(r.hourly_rate))}/h
            </span>
          )}
        </div>
        {r.matched_skills && r.matched_skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {r.matched_skills.slice(0, 4).map(s => (
              <span key={s} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'rgba(0,200,150,0.14)', color: '#00C896', border: '1px solid rgba(0,200,150,0.3)' }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action */}
      <button onClick={onView} className="btn-outline-gold px-3 py-1.5 rounded-lg text-xs" style={{ flexShrink: 0 }}>
        Voir le profil
      </button>
    </div>
  );
}
