import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X, Camera, Search, Plus, Minus } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { COMPETENCES, VILLES, formatCFA } from '../lib/utils';
import MapPicker from '../components/MapPicker';
import { geocodeAddress } from '../lib/geo';
import {
  dayHours, totalHours, missionTotal, totalHeadcount, rateRange,
  type MissionRole, type MissionDay,
} from '../lib/missionPricing';
import toast from 'react-hot-toast';

const inputClass = 'w-full px-4 py-3 rounded-xl text-sm outline-none';
const inputStyle = { background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' };
const emptyDay = (start = '', end = ''): MissionDay => ({ date: '', start, end });

export default function EditMission() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const [params]    = useSearchParams();
  const missionId   = params.get('id');

  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', dress_code: '', is_urgent: false,
    location: '', ville: 'Abidjan - Cocody',
    latitude: null as number | null, longitude: null as number | null, venue_photo_url: '',
  });
  const [roles, setRoles] = useState<MissionRole[]>([]);
  const [days, setDays]   = useState<MissionDay[]>([emptyDay()]);

  const [venueFile, setVenueFile]     = useState<File | null>(null);
  const [venuePreview, setVenuePreview] = useState<string | null>(null);
  const [uploadingVenue, setUploadingVenue] = useState(false);
  const venueInputRef = useRef<HTMLInputElement>(null);
  const [geocoding, setGeocoding] = useState(false);
  const lastGeo = useRef(''); // dernière adresse déjà localisée → évite la boucle carte ↔ adresse

  const today = new Date().toISOString().slice(0, 10);

  // Adresse saisie → géocodage → déplace l'épingle sur la carte (synchro adresse → carte)
  async function searchAddress() {
    const addr = form.location.trim();
    if (!addr || addr === lastGeo.current) return;
    lastGeo.current = addr;
    setGeocoding(true);
    const r = await geocodeAddress(addr);
    if (r) setForm(p => ({ ...p, latitude: r.lat, longitude: r.lng }));
    else toast.error('Adresse introuvable — placez l’épingle directement sur la carte.');
    setGeocoding(false);
  }

  useEffect(() => {
    if (!missionId) { navigate('/my-missions'); return; }
    supabase.from('missions').select('*').eq('id', missionId).single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error('Mission introuvable'); navigate('/my-missions'); return; }
        if (data.organisateur_id !== profile?.id) { toast.error('Accès refusé'); navigate('/my-missions'); return; }
        setForm({
          title:           data.title            || '',
          description:     data.description       || '',
          dress_code:      data.dress_code        || '',
          is_urgent:       data.is_urgent         || false,
          location:        data.location          || '',
          ville:           data.ville             || 'Abidjan - Cocody',
          latitude:        data.latitude          ?? null,
          longitude:       data.longitude         ?? null,
          venue_photo_url: data.venue_photo_url   || '',
        });
        // Postes : format détaillé si présent, sinon reconstruit depuis les colonnes legacy
        const skills: string[] = (data.skills_required?.length ? data.skills_required : [data.service_type]).filter(Boolean);
        const legacyRoles: MissionRole[] = skills.map(s => ({
          skill: s,
          count: skills.length <= 1 ? (data.slots_total || 1) : 1,
          rate: Number(data.hourly_rate) || 3000,
        }));
        setRoles(Array.isArray(data.roles) && data.roles.length ? (data.roles as MissionRole[]) : legacyRoles);
        // Planning : format détaillé si présent, sinon un seul jour depuis les colonnes legacy
        const legacyDays: MissionDay[] = [{ date: data.event_date || '', start: data.start_time || '', end: data.end_time || '' }];
        setDays(Array.isArray(data.days) && data.days.length ? (data.days as MissionDay[]) : legacyDays);

        if (data.venue_photo_url) setVenuePreview(data.venue_photo_url);
        setLoading(false);
      });
  }, [missionId, profile, navigate]);

  function upd(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  // ── Postes ──────────────────────────────────────────────────────────────
  function toggleRole(skill: string) {
    setRoles(prev => prev.some(r => r.skill === skill)
      ? prev.filter(r => r.skill !== skill)
      : [...prev, { skill, count: 1, rate: 3000 }]);
  }
  function updRole(skill: string, patch: Partial<MissionRole>) {
    setRoles(prev => prev.map(r => r.skill === skill ? { ...r, ...patch } : r));
  }

  // ── Jours ───────────────────────────────────────────────────────────────
  function setDayCount(n: number) {
    setDays(prev => {
      const next = [...prev];
      while (next.length < n) { const last = next[next.length - 1]; next.push(emptyDay(last?.start, last?.end)); }
      return next.slice(0, n);
    });
  }
  function updDay(i: number, patch: Partial<MissionDay>) {
    setDays(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  }

  function handleVenueFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Photo trop lourde (max 10 Mo)'); return; }
    setVenueFile(file);
    setVenuePreview(URL.createObjectURL(file));
  }

  async function uploadVenuePhoto(): Promise<string> {
    if (!venueFile || !profile) return form.venue_photo_url;
    setUploadingVenue(true);
    try {
      const ext  = venueFile.name.split('.').pop();
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('venue-photos').upload(path, venueFile, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
      return data.publicUrl;
    } finally { setUploadingVenue(false); }
  }

  // ── Calculs ─────────────────────────────────────────────────────────────
  const totalHrs   = totalHours(days);
  const total      = missionTotal(roles, days);
  const commission = total * 0.10;
  const net        = total - commission;
  const { min: minRate } = rateRange(roles);

  const daysValid  = days.length > 0 && days.every(d => d.date && d.date >= today && d.start && d.end && dayHours(d) > 0);
  const rolesValid = roles.length > 0 && roles.every(r => r.count >= 1 && r.rate > 0);

  async function save(newStatus?: 'open' | 'draft') {
    if (!missionId) return;
    setSaving(true);
    try {
      let photoUrl = form.venue_photo_url;
      if (venueFile) photoUrl = await uploadVenuePhoto();

      const day1 = days[0];
      const skills = roles.map(r => r.skill);
      const { error } = await supabase.from('missions').update({
        title: form.title,
        description: form.description,
        dress_code: form.dress_code,
        is_urgent: form.is_urgent,
        location: form.location,
        ville: form.ville,
        latitude: form.latitude,
        longitude: form.longitude,
        venue_photo_url: photoUrl,
        roles,
        days,
        nb_days: days.length,
        service_type: skills[0] || '',
        skills_required: skills,
        slots_total: totalHeadcount(roles),
        hourly_rate: minRate,
        duration_hours: dayHours(day1),
        event_date: day1.date,
        start_time: day1.start,
        end_time: day1.end,
        total_amount: total,
        ...(newStatus ? { status: newStatus } : {}),
      }).eq('id', missionId);
      if (error) throw error;

      // Si on publie (passage à 'open'), déclencher le matching
      if (newStatus === 'open') {
        const { data: count } = await supabase.rpc('notify_matching_freelances', {
          p_mission_id:      missionId,
          p_mission_title:   form.title,
          p_hourly_rate:     minRate,
          p_ville:           form.ville,
          p_skills_required: skills.length > 0 ? skills : null,
        });
        toast.success(`Mission publiée ! ${count ?? 0} freelance(s) notifié(s)`);
      } else {
        toast.success('Mission mise à jour !');
      }
      navigate('/my-missions');
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  }

  const steps = ['Informations', 'Planning & Tarifs', 'Récapitulatif'];

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #d4af37',
            borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} style={{ color: '#b8a898' }}>← Retour</button>
          <h1 className="font-display text-2xl font-bold" style={{ color: '#f0e6d3' }}>Modifier la mission</h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={i <= step
                    ? { background: 'linear-gradient(135deg,#d4af37,#e8c97a)', color: '#261642' }
                    : { border: '1px solid rgba(201,168,76,0.3)', color: '#7a6a7a' }}>
                  {i < step ? <Check size={15} /> : i + 1}
                </div>
                <span className="text-xs hidden sm:block" style={{ color: i === step ? '#d4af37' : '#7a6a7a' }}>{s}</span>
              </div>
              {i < steps.length - 1 && <div className="w-8 h-px mx-2" style={{ background: i < step ? '#d4af37' : 'rgba(201,168,76,0.2)' }} />}
            </div>
          ))}
        </div>

        <div className="card-glass p-8 space-y-5">

          {/* Étape 1 */}
          {step === 0 && (
            <>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Titre *</label>
                <input className={inputClass} style={inputStyle}
                  value={form.title} onChange={e => upd('title', e.target.value)} />
              </div>
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>
                  Compétence(s) recherchée(s) * <span style={{ color: '#7a6a7a' }}>(chacune a son tarif)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPETENCES.map(c => {
                    const on = roles.some(r => r.skill === c);
                    return (
                      <button key={c} type="button" onClick={() => toggleRole(c)}
                        className="px-3 py-1 rounded-full text-xs transition-all border"
                        style={{
                          background: on ? 'rgba(201,168,76,0.2)' : 'transparent',
                          borderColor: on ? '#d4af37' : 'rgba(201,168,76,0.2)',
                          color: on ? '#d4af37' : '#b8a898',
                        }}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Description *</label>
                <textarea className={inputClass} style={{ ...inputStyle, resize: 'none' }} rows={4}
                  value={form.description} onChange={e => upd('description', e.target.value)} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Dress code</label>
                <input className={inputClass} style={inputStyle}
                  value={form.dress_code} onChange={e => upd('dress_code', e.target.value)} />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => upd('is_urgent', !form.is_urgent)}
                  className="w-11 h-6 rounded-full transition-all relative"
                  style={{ background: form.is_urgent ? '#ef4444' : 'rgba(82,54,124,0.5)' }}>
                  <div className="absolute w-4 h-4 bg-white rounded-full top-1 transition-all"
                    style={{ left: form.is_urgent ? '24px' : '4px' }} />
                </div>
                <span className="text-sm" style={{ color: '#b8a898' }}>Mission urgente</span>
              </label>
              <button onClick={() => setStep(1)} disabled={!form.title || roles.length === 0 || !form.description}
                className="btn-gold w-full py-3 rounded-xl font-bold text-[#261642]">
                Continuer →
              </button>
            </>
          )}

          {/* Étape 2 */}
          {step === 1 && (
            <>
              {/* Ville */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Ville *</label>
                <select className={inputClass} style={inputStyle}
                  value={form.ville} onChange={e => upd('ville', e.target.value)}>
                  {VILLES.map(v => <option key={v} value={v} style={{ background: '#1e0f3c', color: '#f0e6d3' }}>{v}</option>)}
                </select>
              </div>

              {/* Durée : 1 à 3 jours */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>Durée de l'événement * <span style={{ color: '#7a6a7a' }}>(max 3 jours, facturé au jour)</span></label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(n => (
                    <button key={n} type="button" onClick={() => setDayCount(n)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all"
                      style={{
                        background: days.length === n ? 'rgba(201,168,76,0.2)' : 'transparent',
                        borderColor: days.length === n ? '#d4af37' : 'rgba(201,168,76,0.2)',
                        color: days.length === n ? '#d4af37' : '#b8a898',
                      }}>
                      {n} jour{n > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {days.map((d, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(82,54,124,0.25)', border: '1px solid rgba(201,168,76,0.12)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: '#d4af37' }}>Jour {i + 1}</span>
                    {d.start && d.end && <span className="text-xs" style={{ color: '#b8a898' }}>{Math.round(dayHours(d) * 100) / 100}h</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: '#8a7a9a' }}>Date</label>
                      <input type="date" min={today} className="w-full px-2 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                        value={d.date} onChange={e => updDay(i, { date: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: '#8a7a9a' }}>Début</label>
                      <input type="time" className="w-full px-2 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                        value={d.start} onChange={e => updDay(i, { start: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: '#8a7a9a' }}>Fin</label>
                      <input type="time" className="w-full px-2 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                        value={d.end} onChange={e => updDay(i, { end: e.target.value })} />
                    </div>
                  </div>
                  {d.date && d.date < today && (
                    <p className="text-xs mt-1" style={{ color: '#ef4444' }}>La date ne peut pas être dans le passé.</p>
                  )}
                </div>
              ))}

              {/* Tarif horaire par compétence */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>Postes & tarifs horaires * <span style={{ color: '#7a6a7a' }}>(effectif + prix/heure par compétence)</span></label>
                <div className="space-y-2">
                  {roles.map(r => (
                    <div key={r.skill} className="flex items-center gap-3 rounded-xl p-3 flex-wrap"
                      style={{ background: 'rgba(82,54,124,0.25)', border: '1px solid rgba(201,168,76,0.12)' }}>
                      <span className="text-sm font-medium flex-1 min-w-[120px]" style={{ color: '#f0e6d3' }}>{r.skill}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => updRole(r.skill, { count: Math.max(1, r.count - 1) })}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(82,54,124,0.6)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.2)' }}><Minus size={14} /></button>
                        <span className="text-sm font-bold w-5 text-center" style={{ color: '#f0e6d3' }}>{r.count}</span>
                        <button type="button" onClick={() => updRole(r.skill, { count: r.count + 1 })}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(82,54,124,0.6)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.2)' }}><Plus size={14} /></button>
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} step={100} value={r.rate}
                          onChange={e => updRole(r.skill, { rate: Number(e.target.value) })}
                          className="px-2 py-2 rounded-lg text-sm outline-none text-right" style={{ ...inputStyle, width: 90 }} />
                        <span className="text-xs" style={{ color: '#8a7a9a' }}>F/h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>
                  Adresse * <span style={{ color: '#7a6a7a' }}>(synchronisée avec la carte)</span>
                </label>
                <div className="flex gap-2">
                  <input className={inputClass} style={inputStyle} placeholder="Ex: Avenue Delafosse, Plateau"
                    value={form.location}
                    onChange={e => upd('location', e.target.value)}
                    onBlur={searchAddress}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAddress(); } }} />
                  <button type="button" onClick={searchAddress} disabled={geocoding || !form.location.trim()}
                    className="px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                    style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.4)',
                      color: '#d4af37', flexShrink: 0, cursor: 'pointer',
                      opacity: (geocoding || !form.location.trim()) ? 0.6 : 1 }}>
                    <Search size={15} /> {geocoding ? '...' : 'Localiser'}
                  </button>
                </div>
              </div>

              {/* Carte interactive */}
              <MapPicker
                lat={form.latitude}
                lng={form.longitude}
                onSelect={(lat, lng, addr) => {
                  lastGeo.current = addr; // adresse issue de la carte → ne pas la re-géocoder
                  setForm(p => ({ ...p, latitude: lat, longitude: lng, location: addr }));
                }}
              />

              {/* Photo du lieu */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>Photo du lieu (optionnel)</label>
                <input ref={venueInputRef} type="file" accept="image/*" className="hidden" onChange={handleVenueFile} />
                {venuePreview ? (
                  <div className="relative">
                    <img src={venuePreview} alt="Lieu" className="w-full h-48 object-cover rounded-xl" />
                    <button onClick={() => { setVenueFile(null); setVenuePreview(null); upd('venue_photo_url', ''); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}><X size={15} /></button>
                  </div>
                ) : (
                  <button onClick={() => venueInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all"
                    style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#b8a898' }}>
                    <Camera size={26} color="#d4af37" />
                    <span className="text-xs">Ajouter une photo du lieu</span>
                  </button>
                )}
              </div>

              {/* Aperçu total */}
              {total > 0 && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <span className="text-xs" style={{ color: '#b8a898' }}>Total estimé ({totalHrs}h · {days.length} jour{days.length > 1 ? 's' : ''})</span>
                  <span className="font-bold" style={{ color: '#d4af37' }}>{formatCFA(total)}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-outline-gold flex-1 py-3 rounded-xl">← Retour</button>
                <button onClick={() => setStep(2)} disabled={!daysValid || !rolesValid || !form.location}
                  className="btn-gold flex-1 py-3 rounded-xl font-bold text-[#261642]">
                  Continuer →
                </button>
              </div>
            </>
          )}

          {/* Étape 3 — Récapitulatif */}
          {step === 2 && (
            <>
              <h2 className="font-semibold text-lg" style={{ color: '#f0e6d3' }}>Récapitulatif</h2>
              <div className="space-y-3 text-sm" style={{ color: '#b8a898' }}>
                <div className="flex justify-between"><span>Mission</span><span style={{ color: '#f0e6d3' }} className="font-medium">{form.title}</span></div>
                <div>
                  <span className="block mb-1">Planning</span>
                  <div className="space-y-1">
                    {days.map((d, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span>Jour {i + 1} · {d.date ? new Date(d.date).toLocaleDateString('fr-CI', { day: '2-digit', month: 'short' }) : '—'}</span>
                        <span style={{ color: '#f0e6d3' }}>{d.start}–{d.end} ({Math.round(dayHours(d) * 100) / 100}h)</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="block mb-1">Postes</span>
                  <div className="space-y-1">
                    {roles.map(r => (
                      <div key={r.skill} className="flex justify-between text-xs">
                        <span>{r.skill} ×{r.count}</span>
                        <span style={{ color: '#f0e6d3' }}>{formatCFA(r.rate)}/h</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between"><span>Lieu</span><span style={{ color: '#f0e6d3' }}>{form.location}, {form.ville}</span></div>
                <div className="flex justify-between"><span>Durée totale</span><span style={{ color: '#f0e6d3' }}>{totalHrs}h · {totalHeadcount(roles)} personne(s)</span></div>
                <div className="h-px" style={{ background: 'rgba(201,168,76,0.15)' }} />
                <div className="flex justify-between"><span>Montant brut</span><span style={{ color: '#f0e6d3' }}>{formatCFA(total)}</span></div>
                <div className="flex justify-between"><span>Commission (10%)</span><span style={{ color: '#ef4444' }}>-{formatCFA(commission)}</span></div>
                <div className="flex justify-between font-bold"><span>Net freelances</span><span className="text-gold-gradient">{formatCFA(net)}</span></div>
              </div>
              {form.is_urgent && (
                <div className="badge-urgent px-3 py-2 rounded-lg text-sm text-center">Mission URGENTE</div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="btn-outline-gold flex-1 py-3 rounded-xl">← Retour</button>
                <button onClick={() => save()} disabled={saving || uploadingVenue}
                  className="btn-gold flex-1 py-3 rounded-xl font-bold text-[#261642]">
                  {uploadingVenue ? 'Photo en cours...' : saving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
