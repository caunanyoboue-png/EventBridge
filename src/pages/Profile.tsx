import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { COMPETENCES, VILLES, formatCFA } from '../lib/utils';
import { getBrowserPosition, reverseGeocode } from '../lib/geo';
import { type Review } from '../types';
import PortfolioSection from '../components/PortfolioSection';
import MapView from '../components/MapView';
import toast from 'react-hot-toast';

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

export default function Profile() {
  const { profile, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoAddr, setGeoAddr] = useState('');

  const [form, setForm] = useState({
    full_name: '', bio: '', ville: 'Abidjan - Cocody', quartier: '',
    phone: '', hourly_rate: 2500, experience_years: 0,
    skills: [] as string[], is_available: true,
    company_name: '', company_sector: '', rccm: '',
  });

  useEffect(() => {
    if (!profile) return;
    if (profile.latitude) setGeoLat(profile.latitude);
    if (profile.longitude) setGeoLng(profile.longitude);
    setForm({
      full_name: profile.full_name || '',
      bio: profile.bio || '',
      ville: profile.ville || 'Abidjan - Cocody',
      quartier: profile.quartier || '',
      phone: profile.phone || '',
      hourly_rate: profile.hourly_rate || 2500,
      experience_years: profile.experience_years || 0,
      skills: profile.skills || [],
      is_available: profile.is_available ?? true,
      company_name: profile.company_name || '',
      company_sector: profile.company_sector || '',
      rccm: profile.rccm || '',
    });
    supabase.from('reviews')
      .select('*, reviewer:profiles!reviewer_id(full_name,avatar_url)')
      .eq('reviewed_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setReviews(data || []));
  }, [profile]);

  function toggleSkill(s: string) {
    setForm(p => ({ ...p, skills: p.skills.includes(s) ? p.skills.filter(x => x !== s) : [...p.skills, s] }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateProfile({
        ...form,
        ...(geoLat && geoLng ? { latitude: geoLat, longitude: geoLng } : {}),
      });
      toast.success('Profil mis à jour !');
      setEditing(false);
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  }

  async function detectLocation() {
    setLocating(true);
    try {
      const coords = await getBrowserPosition();
      setGeoLat(coords.latitude);
      setGeoLng(coords.longitude);
      const addr = await reverseGeocode(coords.latitude, coords.longitude);
      setGeoAddr(addr);
      toast.success('Position détectée !');
    } catch {
      toast.error('Impossible d\'accéder à la géolocalisation');
    } finally {
      setLocating(false);
    }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${profile.id}.${ext}`;
      await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile({ avatar_url: data.publicUrl });
      toast.success('Photo mise à jour !');
    } catch { toast.error("Erreur lors de l'upload"); }
    finally { setUploading(false); }
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <p style={{ color: '#5a4a6a', fontSize: 14 }}>Chargement du profil...</p>
        </div>
      </DashboardLayout>
    );
  }

  const isFreelance = profile.role === 'freelance';
  const initials = (profile.full_name || 'U').split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || 'U';

  const completionChecks = isFreelance
    ? [!!profile.avatar_url, !!profile.phone, !!(profile.bio && profile.bio.length > 20),
       !!(profile.skills?.length), !!profile.quartier, !!profile.hourly_rate]
    : [!!profile.avatar_url, !!profile.phone, !!(profile.bio && profile.bio.length > 20),
       !!profile.company_name, !!profile.company_sector, !!profile.quartier];
  const completionPct = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  const field = (label: string, key: keyof typeof form, type: 'text' | 'number' | 'textarea' | 'select' = 'text') => (
    <div key={key}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: '#6a5a7a', marginBottom: 8 }}>{label}</label>
      {type === 'textarea' ? (
        <textarea rows={4} style={{ ...inputSt, resize: 'none' }}
          value={form[key] as string}
          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
      ) : type === 'select' ? (
        <select style={inputSt} value={form[key] as string}
          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}>
          {VILLES.map(v => <option key={v} value={v} style={{ background: '#1a0a2e' }}>{v}</option>)}
        </select>
      ) : (
        <input type={type} style={inputSt}
          value={form[key] as string | number}
          onChange={e => setForm(p => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} />
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f0e6d3', lineHeight: 1 }}>Mon profil</h1>
            <p style={{ fontSize: 13, color: '#5a4a6a', marginTop: 6 }}>
              Informations personnelles et professionnelles
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {editing && (
              <button onClick={() => setEditing(false)}
                style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'rgba(61,36,96,0.5)', color: '#9a8a9a',
                  border: '1px solid rgba(201,168,76,0.12)', cursor: 'pointer' }}>
                Annuler
              </button>
            )}
            <button onClick={() => editing ? save() : setEditing(true)} disabled={saving}
              className="btn-gold"
              style={{ padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                color: '#1a0a2e', opacity: saving ? 0.7 : 1 }}>
              {editing ? (saving ? 'Enregistrement…' : 'Sauvegarder') : 'Modifier'}
            </button>
          </div>
        </div>

        {/* Carte identité */}
        <div className="card-glass" style={{ padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

            {/* Avatar + upload */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt=""
                  style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
                    border: '2.5px solid rgba(201,168,76,0.4)' }} />
              ) : (
                <div style={{ width: 88, height: 88, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800,
                  color: '#1a0a2e', background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', flexShrink: 0 }}>
                  {initials}
                </div>
              )}
              <label title="Changer la photo"
                style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26,
                  borderRadius: '50%', background: '#c9a84c', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #1a0a2e' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
                {uploading
                  ? <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #1a0a2e',
                      borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  : <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M5.5 1v7M3 3l2.5-2.5L8 3M1.5 9.5h8" stroke="#1a0a2e" strokeWidth="1.4"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                }
              </label>
            </div>

            {/* Info principale */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f0e6d3', margin: 0 }}>
                  {profile.full_name || 'Mon profil'}
                </h2>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                  letterSpacing: '0.08em',
                  background: isFreelance ? 'rgba(201,168,76,0.12)' : 'rgba(96,165,250,0.12)',
                  color: isFreelance ? '#c9a84c' : '#60a5fa',
                  border: `1px solid ${isFreelance ? 'rgba(201,168,76,0.3)' : 'rgba(96,165,250,0.3)'}` }}>
                  {isFreelance ? 'FREELANCE' : 'ORGANISATEUR'}
                </span>
                {profile.is_certified && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                    background: 'rgba(16,185,129,0.1)', color: '#10b981',
                    border: '1px solid rgba(16,185,129,0.25)', letterSpacing: '0.08em' }}>
                    CERTIFIÉ
                  </span>
                )}
              </div>

              {(profile.avg_rating ?? 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Stars rating={profile.avg_rating || 0} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#c9a84c' }}>
                    {(profile.avg_rating || 0).toFixed(1)}
                  </span>
                  <span style={{ fontSize: 12, color: '#4a3a5a' }}>
                    · {profile.total_reviews || 0} avis
                  </span>
                </div>
              )}

              <p style={{ fontSize: 13, color: '#6a5a7a', marginBottom: 2 }}>
                {[profile.ville, profile.quartier].filter(Boolean).join(', ')}
              </p>
              {profile.phone && (
                <p style={{ fontSize: 13, color: '#6a5a7a', marginBottom: 2 }}>{profile.phone}</p>
              )}
              {!isFreelance && profile.company_name && (
                <p style={{ fontSize: 13, color: '#c9a84c', fontWeight: 600 }}>
                  {profile.company_name}{profile.company_sector ? ` · ${profile.company_sector}` : ''}
                </p>
              )}
            </div>

            {/* Complétion */}
            <div style={{ flexShrink: 0, minWidth: 150 }}>
              <div style={{ background: 'rgba(61,36,96,0.4)', borderRadius: 12, padding: '16px 18px',
                border: '1px solid rgba(201,168,76,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#6a5a7a', fontWeight: 600 }}>Profil</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#c9a84c' }}>{completionPct}%</span>
                </div>
                <div style={{ height: 5, background: 'rgba(61,36,96,0.9)', borderRadius: 99 }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${completionPct}%`,
                    background: 'linear-gradient(to right,#c9a84c,#e8c97a)' }} />
                </div>
                {completionPct < 100 && (
                  <p style={{ fontSize: 11, color: '#4a3a5a', marginTop: 8, lineHeight: 1.5 }}>
                    Complétez pour plus de visibilité
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 24,
            paddingTop: 20, borderTop: '1px solid rgba(201,168,76,0.08)' }}>
            {[
              { l: 'Missions', v: profile.total_missions ?? 0 },
              { l: "Expérience", v: isFreelance ? `${profile.experience_years ?? 0} ans` : '—' },
              { l: 'Tarif/heure', v: isFreelance && profile.hourly_rate ? formatCFA(profile.hourly_rate) : '—' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center', padding: '14px 8px',
                background: 'rgba(61,36,96,0.3)', borderRadius: 10,
                border: '1px solid rgba(201,168,76,0.06)' }}>
                <div className="text-gold-gradient" style={{ fontSize: 18, fontWeight: 800 }}>{s.v}</div>
                <div style={{ fontSize: 11, color: '#4a3a5a', marginTop: 5 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Formulaire édition */}
        {editing && (
          <div className="card-glass" style={{ padding: 28, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f0e6d3', marginBottom: 20,
              letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Informations générales
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18, marginBottom: 18 }}>
              {field('Nom complet', 'full_name')}
              {field('Téléphone', 'phone')}
              {field('Ville', 'ville', 'select')}
              {field('Quartier', 'quartier')}
            </div>
            {field('Bio / Présentation', 'bio', 'textarea')}

            {isFreelance && (
              <>
                <div style={{ height: 1, background: 'rgba(201,168,76,0.08)', margin: '24px 0' }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f0e6d3', marginBottom: 20,
                  letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Informations professionnelles
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                  {field('Tarif horaire (FCFA)', 'hourly_rate', 'number')}
                  {field("Années d'expérience", 'experience_years', 'number')}
                </div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: '#6a5a7a', marginBottom: 10 }}>
                  Compétences
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                  {COMPETENCES.map(c => (
                    <button key={c} onClick={() => toggleSkill(c)}
                      style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: form.skills.includes(c) ? 'rgba(201,168,76,0.15)' : 'transparent',
                        border: `1px solid ${form.skills.includes(c) ? '#c9a84c' : 'rgba(201,168,76,0.18)'}`,
                        color: form.skills.includes(c) ? '#c9a84c' : '#6a5a7a' }}>
                      {c}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button onClick={() => setForm(p => ({ ...p, is_available: !p.is_available }))}
                    style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
                      background: form.is_available ? '#10b981' : 'rgba(61,36,96,0.8)',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      left: form.is_available ? 22 : 2 }} />
                  </button>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3' }}>
                      {form.is_available ? 'Disponible aux missions' : 'Indisponible'}
                    </p>
                    <p style={{ fontSize: 11, color: '#4a3a5a', marginTop: 2 }}>
                      {form.is_available ? 'Visible dans les recherches' : 'Masqué des recherches'}
                    </p>
                  </div>
                </div>
              </>
            )}

            {!isFreelance && (
              <>
                <div style={{ height: 1, background: 'rgba(201,168,76,0.08)', margin: '24px 0' }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f0e6d3', marginBottom: 20,
                  letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Structure / Entreprise
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18 }}>
                  {field('Nom de la structure', 'company_name')}
                  {field("Secteur d'activité", 'company_sector')}
                  {field('RCCM (optionnel)', 'rccm')}
                </div>
              </>
            )}

            {/* Section géolocalisation */}
            <div style={{ height: 1, background: 'rgba(201,168,76,0.08)', margin: '24px 0' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f0e6d3', marginBottom: 12,
              letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Ma localisation
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={detectLocation}
                disabled={locating}
                style={{
                  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: locating ? 'wait' : 'pointer',
                  background: 'linear-gradient(135deg,#c9a84c,#e8c97a)',
                  color: '#1a0a2e', border: 'none',
                  opacity: locating ? 0.7 : 1, transition: 'opacity 0.15s',
                }}
              >
                {locating ? '…' : '📍 Détecter ma position GPS'}
              </button>
              {geoLat && geoLng && (
                <span style={{ fontSize: 12, color: '#10b981' }}>
                  ✓ Position enregistrée {geoAddr ? `— ${geoAddr}` : ''}
                </span>
              )}
            </div>
            {geoLat && geoLng && (
              <MapView lat={geoLat} lng={geoLng} label={geoAddr || 'Ma position'} zoom={14} />
            )}
            <p style={{ fontSize: 11, color: '#4a3a5a', marginTop: 8 }}>
              Utilisée pour calculer les distances avec les missions et améliorer votre matching.
            </p>
          </div>
        )}

        {/* Bio lecture */}
        {!editing && profile.bio && (
          <div className="card-glass" style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f0e6d3', marginBottom: 12,
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>À propos</h3>
            <p style={{ fontSize: 14, color: '#b8a898', lineHeight: 1.85 }}>{profile.bio}</p>
          </div>
        )}

        {/* Compétences lecture (freelance) */}
        {!editing && isFreelance && (profile.skills || []).length > 0 && (
          <div className="card-glass" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f0e6d3',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>Compétences</h3>
              {profile.hourly_rate && (
                <span style={{ fontSize: 14, fontWeight: 700, color: '#c9a84c' }}>
                  {formatCFA(profile.hourly_rate)}/h
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(profile.skills || []).map(s => (
                <span key={s} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                  background: 'rgba(201,168,76,0.1)', color: '#c9a84c',
                  border: '1px solid rgba(201,168,76,0.22)' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Disponibilité lecture */}
        {!editing && isFreelance && (
          <div className="card-glass" style={{ padding: 18, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', display: 'flex', width: 12, height: 12, flexShrink: 0 }}>
              {profile.is_available && (
                <span className="animate-ping"
                  style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#10b981', opacity: 0.5 }} />
              )}
              <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                background: profile.is_available ? '#10b981' : '#ef4444', position: 'relative' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600,
                color: profile.is_available ? '#10b981' : '#ef4444' }}>
                {profile.is_available ? 'Disponible pour des missions' : 'Indisponible en ce moment'}
              </p>
              <p style={{ fontSize: 11, color: '#4a3a5a', marginTop: 2 }}>
                Modifiable via le formulaire d'édition
              </p>
            </div>
          </div>
        )}

        {/* Carte position enregistrée (lecture) */}
        {!editing && geoLat && geoLng && (
          <div className="card-glass" style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f0e6d3', marginBottom: 12,
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ma localisation</h3>
            <MapView lat={geoLat} lng={geoLng} label={profile.quartier || profile.ville || 'Ma position'} zoom={14} />
          </div>
        )}

        {/* Portfolio (freelance uniquement) */}
        {isFreelance && (
          <PortfolioSection
            freelanceId={profile.id}
            editable={true}
            currentUserId={profile.id}
          />
        )}

        {/* Avis reçus */}
        <div className="card-glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f0e6d3',
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Avis reçus
            </h3>
            {(profile.avg_rating ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Stars rating={profile.avg_rating || 0} />
                <span style={{ fontSize: 15, fontWeight: 800, color: '#c9a84c' }}>
                  {(profile.avg_rating || 0).toFixed(1)}
                </span>
                <span style={{ fontSize: 12, color: '#4a3a5a' }}>({profile.total_reviews || 0})</span>
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: '0 auto 14px', display: 'block' }}>
                <path d="M20 4l4.9 10 11 1.6-8 7.7 1.9 10.8L20 29.5l-9.8 5.2 1.9-10.8-8-7.7L16.1 14 20 4Z"
                  stroke="#c9a84c" strokeWidth="1.5" strokeLinejoin="round" strokeOpacity="0.4"/>
              </svg>
              <p style={{ fontSize: 13, color: '#4a3a5a' }}>
                {isFreelance ? 'Réalisez votre première mission pour obtenir des avis.' : 'Recrutez votre première équipe !'}
              </p>
            </div>
          ) : (
            <div>
              {reviews.map((r, i) => {
                const rev = r.reviewer as { full_name?: string; avatar_url?: string } | undefined;
                return (
                  <div key={r.id} style={{ display: 'flex', gap: 14, padding: '18px 0',
                    borderBottom: i < reviews.length - 1 ? '1px solid rgba(201,168,76,0.07)' : 'none' }}>
                    {rev?.avatar_url ? (
                      <img src={rev.avatar_url} alt=""
                        style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover',
                          flexShrink: 0, border: '1.5px solid rgba(201,168,76,0.2)' }} />
                    ) : (
                      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, background: 'rgba(201,168,76,0.1)', color: '#c9a84c' }}>
                        {(rev?.full_name || '?').charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f0e6d3' }}>
                          {rev?.full_name || 'Anonyme'}
                        </span>
                        <Stars rating={r.rating} />
                      </div>
                      {r.comment && (
                        <p style={{ fontSize: 13, color: '#8a7a8a', lineHeight: 1.7 }}>"{r.comment}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}

const inputSt: React.CSSProperties = {
  background: 'rgba(61,36,96,0.5)',
  border: '1px solid rgba(201,168,76,0.18)',
  color: '#f0e6d3',
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
