import { useState, useEffect } from 'react';
import {
  Check, Pencil, ImagePlus, MapPin, Building2, Target, FileText,
  Phone, CheckCircle2, Star, GraduationCap, Banknote, Trophy, type LucideIcon,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import KycCard from '../components/KycCard';
import CertifiedBadge from '../components/CertifiedBadge';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { COMPETENCES, VILLES, formatCFA } from '../lib/utils';
import { getBrowserPosition, reverseGeocode } from '../lib/geo';
import { type Review, type Mission } from '../types';
import PortfolioSection from '../components/PortfolioSection';
import MapView from '../components/MapView';
import toast from 'react-hot-toast';

const sT: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#f0e6d3',
  textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 13 13"
          fill={i < Math.round(rating) ? '#d4af37' : 'none'} stroke="#d4af37" strokeWidth="0.9">
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
  const [recentMissions, setRecentMissions] = useState<Mission[]>([]);
  const [uploading, setUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
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
    if (profile.role !== 'freelance') {
      supabase.from('missions')
        .select('id,title,status,event_date,service_type,slots_total,slots_filled,location')
        .eq('organisateur_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(4)
        .then(({ data }) => setRecentMissions((data || []) as Mission[]));
    }
  }, [profile]);

  function toggleSkill(s: string) {
    setForm(p => ({ ...p, skills: p.skills.includes(s) ? p.skills.filter(x => x !== s) : [...p.skills, s] }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateProfile({ ...form, ...(geoLat && geoLng ? { latitude: geoLat, longitude: geoLng } : {}) });
      toast.success('Profil mis à jour !');
      setEditing(false);
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  }

  async function detectLocation() {
    setLocating(true);
    try {
      const coords = await getBrowserPosition();
      setGeoLat(coords.latitude); setGeoLng(coords.longitude);
      const addr = await reverseGeocode(coords.latitude, coords.longitude);
      setGeoAddr(addr);
      toast.success('Position détectée !');
    } catch { toast.error("Impossible d'accéder à la géolocalisation"); }
    finally { setLocating(false); }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${profile.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust so browser forces a reload of the new image
      await updateProfile({ avatar_url: `${data.publicUrl}?t=${Date.now()}` });
      toast.success('Photo de profil mise à jour !');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'upload";
      toast.error(msg);
    }
    finally { setUploading(false); }
  }

  async function uploadBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setBannerUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `banners/${profile.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile({ banner_url: `${data.publicUrl}?t=${Date.now()}` });
      toast.success('Bannière mise à jour !');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'upload de la bannière";
      toast.error(msg);
    }
    finally { setBannerUploading(false); }
  }

  if (!profile) return (
    <DashboardLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: '#5a4a6a', fontSize: 14 }}>Chargement du profil...</p>
      </div>
    </DashboardLayout>
  );

  const isFreelance = profile.role === 'freelance';
  const initials = (profile.full_name || 'U').split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || 'U';
  const bannerGradient = isFreelance
    ? 'linear-gradient(135deg,#261642 0%,#52367c 50%,#7c3aed 100%)'
    : 'linear-gradient(135deg,#261642 0%,#1e3a5f 50%,#2563eb 100%)';

  const completionChecks = isFreelance
    ? [!!profile.avatar_url, !!profile.phone, !!(profile.bio && profile.bio.length > 20),
       !!(profile.skills?.length), !!profile.quartier, !!profile.hourly_rate]
    : [!!profile.avatar_url, !!profile.phone, !!(profile.bio && profile.bio.length > 20),
       !!profile.company_name, !!profile.company_sector, !!profile.quartier];
  const completionPct = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  const mSt: Record<string, { label: string; color: string }> = {
    draft: { label: 'Brouillon', color: '#6a5a7a' },
    open: { label: 'Ouverte', color: '#10b981' },
    in_progress: { label: 'En cours', color: '#3b82f6' },
    completed: { label: 'Terminée', color: '#d4af37' },
    cancelled: { label: 'Annulée', color: '#ef4444' },
    disputed: { label: 'Litige', color: '#f59e0b' },
  };

  const fld = (label: string, key: keyof typeof form, type: 'text' | 'number' | 'textarea' | 'select' = 'text') => (
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
          {VILLES.map(v => <option key={v} value={v} style={{ background: '#1e0f3c', color: '#f0e6d3' }}>{v}</option>)}
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
      <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 48 }}>

        {/* ── BANNER + AVATAR ──────────────────────────────── */}
        <div className="profile-banner-wrap" style={{ position: 'relative', marginBottom: 72 }}>

          {/* Banner */}
          <div className="profile-banner-inner" style={{ height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative',
            background: profile.banner_url ? undefined : bannerGradient }}>
            {profile.banner_url && (
              <img src={profile.banner_url} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            <div style={{ position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 75% 20%,rgba(201,168,76,0.1) 0%,transparent 60%)' }} />

            {/* Edit / Save buttons */}
            <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
              {editing && (
                <button onClick={() => setEditing(false)}
                  style={{ padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                    background: 'rgba(0,0,0,0.45)', color: '#f0e6d3', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}>
                  Annuler
                </button>
              )}
              <button onClick={() => editing ? save() : setEditing(true)} disabled={saving}
                className="btn-gold inline-flex items-center justify-center gap-2"
                style={{ padding: '8px 18px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                  color: '#261642', opacity: saving ? 0.7 : 1 }}>
                {editing ? (saving ? 'Enregistrement…' : <><Check size={14} /> Sauvegarder</>) : <><Pencil size={13} /> Modifier le profil</>}
              </button>
            </div>

            {/* Banner upload (edit mode) */}
            {editing && (
              <label style={{ position: 'absolute', bottom: 12, right: 14, display: 'flex',
                alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
                fontSize: 11, fontWeight: 600, cursor: bannerUploading ? 'wait' : 'pointer',
                background: 'rgba(0,0,0,0.45)', color: '#f0e6d3', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.15)' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadBanner} />
                {bannerUploading ? 'Upload…' : <><ImagePlus size={13} /> Changer la bannière</>}
              </label>
            )}
          </div>

          {/* Avatar overlapping banner */}
          <div style={{ position: 'absolute', bottom: -56, left: 28 }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt=""
                    style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover',
                      display: 'block', border: '3px solid #261642',
                      outline: '2px solid rgba(201,168,76,0.4)' }} />
                : <div style={{ width: 100, height: 100, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800,
                    color: '#261642', background: 'linear-gradient(135deg,#d4af37,#e8c97a)',
                    border: '3px solid #261642', outline: '2px solid rgba(201,168,76,0.3)' }}>
                    {initials}
                  </div>
              }
              <label title="Changer la photo"
                style={{ position: 'absolute', bottom: 2, right: 2, width: 28, height: 28,
                  borderRadius: '50%', background: '#d4af37', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #261642' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
                {uploading
                  ? <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #261642',
                      borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  : <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v8M3.5 3.5L6 1l2.5 2.5M1 10.5h10" stroke="#261642" strokeWidth="1.4"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                }
              </label>
            </div>
          </div>
        </div>

        {/* ── PROFILE HEADER ───────────────────────────────── */}
        <div className="profile-header" style={{ paddingLeft: 152, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f0e6d3', margin: 0 }}>
              {profile.full_name || 'Mon profil'}
            </h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              letterSpacing: '0.08em',
              background: isFreelance ? 'rgba(201,168,76,0.12)' : 'rgba(96,165,250,0.12)',
              color: isFreelance ? '#d4af37' : '#60a5fa',
              border: `1px solid ${isFreelance ? 'rgba(201,168,76,0.3)' : 'rgba(96,165,250,0.3)'}` }}>
              {isFreelance ? 'FREELANCE' : 'ORGANISATEUR'}
            </span>
            <CertifiedBadge level={profile.certification_level} size="md" />
            {isFreelance && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
                fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                background: profile.is_available ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: profile.is_available ? '#10b981' : '#ef4444',
                border: `1px solid ${profile.is_available ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%',
                  background: profile.is_available ? '#10b981' : '#ef4444' }} />
                {profile.is_available ? 'Disponible' : 'Indisponible'}
              </span>
            )}
          </div>
          {(profile.avg_rating ?? 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Stars rating={profile.avg_rating || 0} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#d4af37' }}>
                {(profile.avg_rating || 0).toFixed(1)}
              </span>
              <span style={{ fontSize: 12, color: '#5a4a6a' }}>· {profile.total_reviews || 0} avis</span>
            </div>
          )}
          <p style={{ fontSize: 13, color: '#8a7a9a', margin: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <MapPin size={13} /> {[profile.ville, profile.quartier].filter(Boolean).join(', ') || 'Localisation non renseignée'}
            {!isFreelance && profile.company_name && (
              <span style={{ color: '#d4af37', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}> · <Building2 size={13} /> {profile.company_name}</span>
            )}
          </p>
        </div>

        {/* Certification (KYC) — freelance */}
        {isFreelance && <KycCard alwaysShow />}

        {/* ── TWO-COLUMN LAYOUT ────────────────────────────── */}
        <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'flex-start' }}>

          {/* MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {editing ? (
              /* ── EDIT FORM ──────────────────────────── */
              <div className="card-glass" style={{ padding: 28 }}>
                <h3 style={sT}>Informations générales</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 18, marginBottom: 18 }}>
                  {fld('Nom complet', 'full_name')}
                  {fld('Téléphone', 'phone')}
                  {fld('Ville', 'ville', 'select')}
                  {fld('Quartier', 'quartier')}
                </div>
                {fld('Bio / Présentation', 'bio', 'textarea')}

                {isFreelance && (
                  <>
                    <div style={{ height: 1, background: 'rgba(201,168,76,0.08)', margin: '24px 0' }} />
                    <h3 style={sT}>Informations professionnelles</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                      {fld('Tarif horaire (FCFA)', 'hourly_rate', 'number')}
                      {fld("Années d'expérience", 'experience_years', 'number')}
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
                            border: `1px solid ${form.skills.includes(c) ? '#d4af37' : 'rgba(201,168,76,0.18)'}`,
                            color: form.skills.includes(c) ? '#d4af37' : '#6a5a7a' }}>
                          {c}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <button onClick={() => setForm(p => ({ ...p, is_available: !p.is_available }))}
                        style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
                          background: form.is_available ? '#10b981' : 'rgba(82,54,124,0.8)',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%',
                          background: '#fff', transition: 'left 0.2s', left: form.is_available ? 22 : 2 }} />
                      </button>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3', margin: 0 }}>
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
                    <h3 style={sT}>Structure / Entreprise</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 18 }}>
                      {fld('Nom de la structure', 'company_name')}
                      {fld("Secteur d'activité", 'company_sector')}
                      {fld('RCCM (optionnel)', 'rccm')}
                    </div>
                  </>
                )}

                <div style={{ height: 1, background: 'rgba(201,168,76,0.08)', margin: '24px 0' }} />
                <h3 style={sT}>Ma localisation GPS</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                  <button type="button" onClick={detectLocation} disabled={locating}
                    style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      cursor: locating ? 'wait' : 'pointer',
                      background: 'linear-gradient(135deg,#d4af37,#e8c97a)',
                      color: '#261642', border: 'none', opacity: locating ? 0.7 : 1 }}>
                    {locating ? 'Localisation…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={15} /> Détecter ma position</span>}
                  </button>
                  {geoLat && geoLng && (
                    <span style={{ fontSize: 12, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Check size={13} /> Position enregistrée {geoAddr ? `— ${geoAddr}` : ''}
                    </span>
                  )}
                </div>
                {geoLat && geoLng && (
                  <MapView lat={geoLat} lng={geoLng} label={geoAddr || 'Ma position'} zoom={14} />
                )}
                <p style={{ fontSize: 11, color: '#4a3a5a', marginTop: 8 }}>
                  Utilisée pour le matching avec les missions à proximité.
                </p>
              </div>
            ) : (
              /* ── READ VIEW ──────────────────────────── */
              <>
                {profile.bio && (
                  <div className="card-glass" style={{ padding: 24 }}>
                    <h3 style={sT}>À propos</h3>
                    <p style={{ fontSize: 14, color: '#b8a898', lineHeight: 1.85, margin: 0 }}>{profile.bio}</p>
                  </div>
                )}

                {isFreelance && (profile.skills || []).length > 0 && (
                  <div className="card-glass" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h3 style={{ ...sT, margin: 0 }}>Compétences</h3>
                      {profile.hourly_rate && (
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#d4af37' }}>
                          {formatCFA(profile.hourly_rate)}/h
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(profile.skills || []).map(s => (
                        <span key={s} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13,
                          fontWeight: 600, background: 'rgba(201,168,76,0.1)', color: '#d4af37',
                          border: '1px solid rgba(201,168,76,0.22)' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {isFreelance && (
                  <div className="card-glass" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ position: 'relative', display: 'flex', width: 12, height: 12, flexShrink: 0 }}>
                      {profile.is_available && (
                        <span className="animate-ping"
                          style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                            background: '#10b981', opacity: 0.5 }} />
                      )}
                      <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                        position: 'relative', background: profile.is_available ? '#10b981' : '#ef4444' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0,
                        color: profile.is_available ? '#10b981' : '#ef4444' }}>
                        {profile.is_available ? 'Disponible pour des missions' : 'Indisponible en ce moment'}
                      </p>
                      <p style={{ fontSize: 11, color: '#4a3a5a', marginTop: 2 }}>
                        Modifiable via le formulaire d'édition
                      </p>
                    </div>
                  </div>
                )}

                {isFreelance && (
                  <PortfolioSection freelanceId={profile.id} editable={true} currentUserId={profile.id} />
                )}

                {!isFreelance && (profile.company_name || profile.company_sector || profile.rccm) && (
                  <div className="card-glass" style={{ padding: 24 }}>
                    <h3 style={sT}>Informations entreprise</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {profile.company_name && (
                        <div>
                          <p style={{ fontSize: 11, color: '#5a4a6a', margin: '0 0 4px', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.06em' }}>Structure</p>
                          <p style={{ fontSize: 14, color: '#b8a898', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}><Building2 size={14} color="#d4af37" /> {profile.company_name}</p>
                        </div>
                      )}
                      {profile.company_sector && (
                        <div>
                          <p style={{ fontSize: 11, color: '#5a4a6a', margin: '0 0 4px', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.06em' }}>Secteur</p>
                          <p style={{ fontSize: 14, color: '#b8a898', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}><Target size={14} color="#d4af37" /> {profile.company_sector}</p>
                        </div>
                      )}
                      {profile.rccm && (
                        <div>
                          <p style={{ fontSize: 11, color: '#5a4a6a', margin: '0 0 4px', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.06em' }}>RCCM</p>
                          <p style={{ fontSize: 14, color: '#b8a898', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}><FileText size={14} color="#d4af37" /> {profile.rccm}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isFreelance && (
                  <PortfolioSection freelanceId={profile.id} editable={true} currentUserId={profile.id} />
                )}

                {!isFreelance && recentMissions.length > 0 && (
                  <div className="card-glass" style={{ padding: 24 }}>
                    <h3 style={sT}>Missions publiées récentes</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {recentMissions.map(m => {
                        const st = mSt[m.status || 'draft'] || { label: 'Inconnu', color: '#6a5a7a' };
                        return (
                          <div key={m.id} style={{ padding: '14px 16px', borderRadius: 12,
                            background: 'rgba(82,54,124,0.3)', border: '1px solid rgba(201,168,76,0.07)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 600, color: '#f0e6d3', margin: '0 0 4px' }}>
                                {m.title}
                              </p>
                              <p style={{ fontSize: 12, color: '#6a5a7a', margin: 0 }}>
                                {m.service_type}{m.event_date ? ` · ${new Date(m.event_date).toLocaleDateString('fr-CI')}` : ''}
                              </p>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                              background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}30`,
                              letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                              {st.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Avis reçus */}
                <div className="card-glass" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ ...sT, margin: 0 }}>Avis reçus</h3>
                    {(profile.avg_rating ?? 0) > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Stars rating={profile.avg_rating || 0} />
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#d4af37' }}>
                          {(profile.avg_rating || 0).toFixed(1)}
                        </span>
                        <span style={{ fontSize: 12, color: '#4a3a5a' }}>({profile.total_reviews || 0})</span>
                      </div>
                    )}
                  </div>
                  {reviews.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 0' }}>
                      <svg width="40" height="40" viewBox="0 0 40 40" fill="none"
                        style={{ margin: '0 auto 14px', display: 'block' }}>
                        <path d="M20 4l4.9 10 11 1.6-8 7.7 1.9 10.8L20 29.5l-9.8 5.2 1.9-10.8-8-7.7L16.1 14 20 4Z"
                          stroke="#d4af37" strokeWidth="1.5" strokeLinejoin="round" strokeOpacity="0.4"/>
                      </svg>
                      <p style={{ fontSize: 13, color: '#4a3a5a' }}>
                        {isFreelance
                          ? 'Réalisez votre première mission pour obtenir des avis.'
                          : 'Recrutez votre première équipe !'}
                      </p>
                    </div>
                  ) : (
                    reviews.map((r, i) => {
                      const rev = r.reviewer as { full_name?: string; avatar_url?: string } | undefined;
                      return (
                        <div key={r.id} style={{ display: 'flex', gap: 14, padding: '18px 0',
                          borderBottom: i < reviews.length - 1 ? '1px solid rgba(201,168,76,0.07)' : 'none' }}>
                          {rev?.avatar_url
                            ? <img src={rev.avatar_url} alt=""
                                style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover',
                                  flexShrink: 0, border: '1.5px solid rgba(201,168,76,0.2)' }} />
                            : <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700,
                                background: 'rgba(201,168,76,0.1)', color: '#d4af37' }}>
                                {(rev?.full_name || '?').charAt(0)}
                              </div>
                          }
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#f0e6d3' }}>
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
              </>
            )}
          </div>

          {/* SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>

            {/* Statistiques */}
            <div className="card-glass" style={{ padding: 20 }}>
              <h3 style={sT}>Statistiques</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { Icon: CheckCircle2, label: 'Missions réalisées', value: String(profile.total_missions ?? 0) },
                  { Icon: Star, label: 'Note moyenne', value: (profile.avg_rating ?? 0) > 0 ? `${(profile.avg_rating || 0).toFixed(1)}/5` : '—' },
                  ...(isFreelance ? [
                    { Icon: GraduationCap, label: "Années d'expérience", value: `${profile.experience_years ?? 0} ans` },
                    { Icon: Banknote, label: 'Tarif horaire', value: profile.hourly_rate ? formatCFA(profile.hourly_rate) : '—' },
                  ] : []),
                ] as { Icon: LucideIcon; label: string; value: string }[]).map(stat => (
                  <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '10px 12px', background: 'rgba(82,54,124,0.3)',
                    borderRadius: 10, border: '1px solid rgba(201,168,76,0.06)' }}>
                    <span style={{ fontSize: 12, color: '#8a7a9a', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <stat.Icon size={14} color="#d4af37" /> {stat.label}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#d4af37' }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coordonnées */}
            {(profile.phone || profile.ville || profile.quartier ||
              (!isFreelance && (profile.company_name || profile.company_sector)) ||
              (isFreelance && profile.hourly_rate)) && (
              <div className="card-glass" style={{ padding: 20 }}>
                <h3 style={sT}>Coordonnées</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {profile.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Phone size={15} color="#d4af37" />
                      <span style={{ fontSize: 13, color: '#b8a898' }}>{profile.phone}</span>
                    </div>
                  )}
                  {(profile.ville || profile.quartier) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MapPin size={15} color="#d4af37" />
                      <span style={{ fontSize: 13, color: '#b8a898' }}>
                        {[profile.ville, profile.quartier].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {!isFreelance && profile.company_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Building2 size={15} color="#d4af37" />
                      <span style={{ fontSize: 13, color: '#b8a898' }}>{profile.company_name}</span>
                    </div>
                  )}
                  {!isFreelance && profile.company_sector && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Target size={15} color="#d4af37" />
                      <span style={{ fontSize: 13, color: '#b8a898' }}>{profile.company_sector}</span>
                    </div>
                  )}
                  {isFreelance && profile.hourly_rate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Banknote size={15} color="#d4af37" />
                      <span style={{ fontSize: 13, color: '#b8a898' }}>{formatCFA(profile.hourly_rate)}/h</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Complétude du profil */}
            <div className="card-glass" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ ...sT, margin: 0 }}>Complétude</h3>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#d4af37' }}>{completionPct}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(82,54,124,0.8)', borderRadius: 999, marginBottom: 10 }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${completionPct}%`,
                  background: 'linear-gradient(to right,#d4af37,#e8c97a)', transition: 'width 0.3s' }} />
              </div>
              <p style={{ fontSize: 11, color: '#7a6a8a', lineHeight: 1.5, margin: 0,
                display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {completionPct === 100 ? <><Trophy size={13} color="#d4af37" /> Profil complet !</> :
                 completionPct >= 80 ? 'Presque complet — encore un effort !' :
                 completionPct >= 50 ? "Bon début — ajoutez plus d'infos." :
                 'Complétez votre profil pour plus de visibilité.'}
              </p>
            </div>

            {/* Ma localisation (sidebar, lecture — freelance uniquement) */}
            {!editing && isFreelance && geoLat && geoLng && (
              <div className="card-glass" style={{ padding: 20 }}>
                <h3 style={sT}>Ma localisation</h3>
                <MapView lat={geoLat} lng={geoLng}
                  label={profile.quartier || profile.ville || 'Ma position'} zoom={13} />
              </div>
            )}

            {/* Badge certifié */}
            {profile.is_certified && (
              <div className="card-glass" style={{ padding: 20, textAlign: 'center',
                border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Trophy size={28} color="#10b981" /></div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#10b981', margin: '0 0 6px',
                  textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Profil certifié
                </p>
                <p style={{ fontSize: 11, color: '#4a3a5a', lineHeight: 1.5, margin: 0 }}>
                  Vérifié par l'équipe EventBridge
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

const inputSt: React.CSSProperties = {
  background: 'rgba(82,54,124,0.5)',
  border: '1px solid rgba(201,168,76,0.18)',
  color: '#f0e6d3',
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
