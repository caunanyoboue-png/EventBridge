import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Search, Plus, Minus } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { COMPETENCES, formatCFA, isHourlyCompetence } from '../lib/utils';
import MapPicker from '../components/MapPicker';
import { geocodeAddress } from '../lib/geo';
import {
  dayHours, totalHours, missionTotal, totalHeadcount, representativeRate, billingUnit,
  type MissionRole, type MissionDay,
} from '../lib/missionPricing';
import toast from 'react-hot-toast';

const emptyDay = (start = '', end = ''): MissionDay => ({ date: '', start, end });

export default function CreateMission() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', dress_code: '', is_urgent: false,
    location: '', ville: 'Abidjan - Cocody',
    latitude: null as number | null,
    longitude: null as number | null,
    venue_photo_url: '' as string,
  });
  // Postes : une compétence = un tarif horaire + un effectif propres
  const [roles, setRoles] = useState<MissionRole[]>([]);
  // Planning : 1 à 3 jours, chacun avec ses horaires
  const [days, setDays] = useState<MissionDay[]>([emptyDay()]);

  const [venueFile, setVenueFile] = useState<File | null>(null);
  const [venuePreview, setVenuePreview] = useState('');
  const [uploadingVenue, setUploadingVenue] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const lastGeo = useRef(''); // dernière adresse déjà localisée → évite la boucle carte ↔ adresse

  const today = new Date().toISOString().slice(0, 10);

  function upd(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

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

  // ── Postes ──────────────────────────────────────────────────────────────
  function toggleRole(skill: string) {
    setRoles(prev => prev.some(r => r.skill === skill)
      ? prev.filter(r => r.skill !== skill)
      : [...prev, isHourlyCompetence(skill)
          ? { skill, count: 1, rate: 3000, billing: 'hourly' }
          : { skill, count: 1, rate: 50000, billing: 'prestation' }]);
  }
  function updRole(skill: string, patch: Partial<MissionRole>) {
    setRoles(prev => prev.map(r => r.skill === skill ? { ...r, ...patch } : r));
  }

  // ── Jours ───────────────────────────────────────────────────────────────
  function setDayCount(n: number) {
    setDays(prev => {
      const next = [...prev];
      // nouveau jour : reprend les horaires du jour précédent (modifiables)
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
    if (file.size > 10 * 1024 * 1024) { toast.error('Image trop lourde (max 10 MB)'); return; }
    setVenueFile(file);
    setVenuePreview(URL.createObjectURL(file));
  }

  async function uploadVenuePhoto(): Promise<string> {
    if (!venueFile || !profile) return '';
    setUploadingVenue(true);
    try {
      const ext = venueFile.name.split('.').pop() || 'jpg';
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('venue-photos').upload(path, venueFile, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
      return data.publicUrl;
    } finally { setUploadingVenue(false); }
  }

  // ── Calculs ─────────────────────────────────────────────────────────────
  const totalHrs = totalHours(days);
  const total = missionTotal(roles, days);
  const commission = total * 0.10;
  const net = total - commission;
  const repRate = representativeRate(roles);

  const daysValid = days.length > 0 && days.every(d => d.date && d.date >= today && d.start && d.end && dayHours(d) > 0);
  const rolesValid = roles.length > 0 && roles.every(r => r.count >= 1 && r.rate > 0);

  const inputClass = 'w-full px-4 py-3 rounded-xl text-sm outline-none';
  const inputStyle = { background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' };

  async function submit(status: 'draft' | 'open') {
    setLoading(true);
    try {
      let venue_photo_url = form.venue_photo_url;
      if (venueFile) venue_photo_url = await uploadVenuePhoto();

      const day1 = days[0];
      const skills = roles.map(r => r.skill);
      const { data: mission, error } = await supabase.from('missions').insert({
        title: form.title,
        description: form.description,
        dress_code: form.dress_code,
        is_urgent: form.is_urgent,
        location: form.location,
        ville: form.ville,
        latitude: form.latitude,
        longitude: form.longitude,
        venue_photo_url,
        organisateur_id: profile!.id,
        // Détail publication
        roles,
        days,
        nb_days: days.length,
        // Champs « représentatifs » gardés pour compat (affichages, matching, contrat)
        service_type: skills[0] || '',
        skills_required: skills,
        slots_total: totalHeadcount(roles),
        hourly_rate: repRate,
        duration_hours: dayHours(day1),
        event_date: day1.date,
        start_time: day1.start,
        end_time: day1.end,
        total_amount: total,
        commission_rate: 0.10,
        status,
        slots_filled: 0,
        idempotency_key: crypto.randomUUID(),
      }).select('id').single();
      if (error) throw error;

      if (status === 'open' && mission) {
        const { data: count } = await supabase.rpc('notify_matching_freelances', {
          p_mission_id:      mission.id,
          p_mission_title:   form.title,
          p_hourly_rate:     repRate,
          p_ville:           form.ville,
          p_skills_required: skills.length > 0 ? skills : null,
        });
        toast.success(`Mission publiée ! ${count ?? 0} freelance(s) notifié(s)`);
      } else {
        toast.success('Brouillon enregistré');
      }
      navigate('/my-missions');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erreur inconnue';
      toast.error(msg);
    } finally { setLoading(false); }
  }

  const steps = ['Informations', 'Planning & Tarifs', 'Récapitulatif'];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} style={{ color: '#b8a898' }}>← Retour</button>
          <h1 className="font-display text-2xl font-bold" style={{ color: '#f0e6d3' }}>Nouvelle mission</h1>
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

          {/* ── Étape 1 : Informations ── */}
          {step === 0 && (
            <>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Titre de la mission *</label>
                <input className={inputClass} style={inputStyle} placeholder="Ex: Service en salle – Gala annuel"
                  value={form.title} onChange={e => upd('title', e.target.value)} />
              </div>

              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>
                  Compétence(s) recherchée(s) * &nbsp;
                  <span style={{ color: '#7a6a7a' }}>(chacune aura son tarif à l'étape suivante)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPETENCES.map(t => {
                    const on = roles.some(r => r.skill === t);
                    return (
                      <button key={t} type="button" onClick={() => toggleRole(t)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                        style={{
                          background: on ? 'rgba(201,168,76,0.2)' : 'transparent',
                          borderColor: on ? '#d4af37' : 'rgba(201,168,76,0.2)',
                          color: on ? '#d4af37' : '#b8a898',
                        }}>
                        {t}
                      </button>
                    );
                  })}
                </div>
                {roles.length > 0 && (
                  <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: 'rgba(201,168,76,0.7)' }}>
                    <Check size={13} /> {roles.length} compétence(s) sélectionnée(s)
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Description *</label>
                <textarea className={inputClass} style={{ ...inputStyle, resize: 'none' }} rows={4}
                  placeholder="Décrivez la mission, les tâches, le contexte..."
                  value={form.description} onChange={e => upd('description', e.target.value)} />
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Dress code (optionnel)</label>
                <input className={inputClass} style={inputStyle} placeholder="Ex: Tenue noire exigée"
                  value={form.dress_code} onChange={e => upd('dress_code', e.target.value)} />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => upd('is_urgent', !form.is_urgent)}
                  className="w-11 h-6 rounded-full transition-all relative"
                  style={{ background: form.is_urgent ? '#ef4444' : 'rgba(82,54,124,0.5)' }}>
                  <div className="absolute w-4 h-4 bg-white rounded-full top-1 transition-all"
                    style={{ left: form.is_urgent ? '24px' : '4px' }} />
                </div>
                <span className="text-sm flex items-center gap-1.5" style={{ color: '#b8a898' }}>Mission urgente <Zap size={14} color="#ef4444" fill="#ef4444" /></span>
              </label>

              <button onClick={() => setStep(1)}
                disabled={!form.title || roles.length === 0 || !form.description}
                className="btn-gold w-full py-3 rounded-xl font-bold text-[#261642]">
                Continuer →
              </button>
            </>
          )}

          {/* ── Étape 2 : Planning & Tarifs ── */}
          {step === 1 && (
            <>
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

              {/* Un bloc horaire par jour */}
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
                  {roles.map(r => {
                    const hourly = isHourlyCompetence(r.skill);
                    const unit = hourly ? 'F/h' : (r.billing === 'daily' ? 'F/jour' : 'F/forfait');
                    return (
                      <div key={r.skill} className="rounded-xl p-3 space-y-2"
                        style={{ background: 'rgba(82,54,124,0.25)', border: '1px solid rgba(201,168,76,0.12)' }}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium flex-1 min-w-[110px]" style={{ color: '#f0e6d3' }}>{r.skill}</span>
                          {/* effectif */}
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => updRole(r.skill, { count: Math.max(1, r.count - 1) })}
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(82,54,124,0.6)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.2)' }}><Minus size={14} /></button>
                            <span className="text-sm font-bold w-5 text-center" style={{ color: '#f0e6d3' }}>{r.count}</span>
                            <button type="button" onClick={() => updRole(r.skill, { count: r.count + 1 })}
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(82,54,124,0.6)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.2)' }}><Plus size={14} /></button>
                          </div>
                          {/* prix */}
                          <div className="flex items-center gap-1">
                            <input type="number" min={0} step={100} value={r.rate}
                              onChange={e => updRole(r.skill, { rate: Number(e.target.value) })}
                              className="px-2 py-2 rounded-lg text-sm outline-none text-right" style={{ ...inputStyle, width: 96 }} />
                            <span className="text-xs whitespace-nowrap" style={{ color: '#8a7a9a' }}>{unit}</span>
                          </div>
                        </div>
                        {/* mode de facturation (compétences non-horaires) */}
                        {!hourly && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px]" style={{ color: '#8a7a9a' }}>Facturé :</span>
                            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.2)' }}>
                              {(['daily', 'prestation'] as const).map(b => (
                                <button key={b} type="button" onClick={() => updRole(r.skill, { billing: b })}
                                  className="px-3 py-1 text-xs font-medium"
                                  style={{ background: (r.billing || 'prestation') === b ? 'rgba(201,168,76,0.2)' : 'transparent',
                                    color: (r.billing || 'prestation') === b ? '#d4af37' : '#b8a898' }}>
                                  {b === 'daily' ? 'Par jour' : 'Par prestation'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>
                  Adresse exacte * <span style={{ color: '#7a6a7a' }}>(synchronisée avec la carte)</span>
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

              {/* Photo du lieu */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>
                  Photo du lieu <span style={{ opacity: 0.5 }}>(optionnel)</span>
                </label>
                {venuePreview ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                    <img src={venuePreview} alt="Lieu"
                      style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => { setVenueFile(null); setVenuePreview(''); }}
                      style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                        borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none',
                        cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex',
                        alignItems: 'center', justifyContent: 'center' }}>
                      ×
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 8, padding: '24px 16px', borderRadius: 12,
                    border: '1.5px dashed rgba(201,168,76,0.25)', cursor: 'pointer',
                    background: 'rgba(201,168,76,0.03)', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.07)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.03)'}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleVenueFile} />
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <rect x="2" y="6" width="24" height="18" rx="3" stroke="#d4af37" strokeWidth="1.5" strokeOpacity="0.5"/>
                      <circle cx="9" cy="13" r="2.5" stroke="#d4af37" strokeWidth="1.5" strokeOpacity="0.5"/>
                      <path d="M2 20l7-5 5 4 4-3 8 5" stroke="#d4af37" strokeWidth="1.5" strokeOpacity="0.5" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 12, color: 'rgba(201,168,76,0.5)' }}>Ajouter une photo du lieu</span>
                  </label>
                )}
              </div>

              {/* Carte interactive */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>
                  Localisation sur la carte
                  {form.latitude && <span style={{ color: '#d4af37', marginLeft: 8 }} className="inline-flex items-center gap-1"><Check size={12} /> Position enregistrée</span>}
                </label>
                <MapPicker
                  lat={form.latitude}
                  lng={form.longitude}
                  onSelect={(lat, lng, addr) => {
                    lastGeo.current = addr; // adresse issue de la carte → ne pas la re-géocoder
                    setForm(p => ({ ...p, latitude: lat, longitude: lng, location: addr }));
                  }}
                />
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
                <button onClick={() => setStep(2)}
                  disabled={!daysValid || !rolesValid || !form.location}
                  className="btn-gold flex-1 py-3 rounded-xl font-bold text-[#261642]">
                  Continuer →
                </button>
              </div>
            </>
          )}

          {/* ── Étape 3 : Récapitulatif ── */}
          {step === 2 && (
            <>
              <h2 className="font-semibold text-lg" style={{ color: '#f0e6d3' }}>Récapitulatif</h2>
              <div className="space-y-3 text-sm" style={{ color: '#b8a898' }}>
                <div className="flex justify-between">
                  <span>Mission</span>
                  <span style={{ color: '#f0e6d3' }} className="font-medium">{form.title}</span>
                </div>

                {/* Planning multi-jours */}
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

                {/* Postes & tarifs */}
                <div>
                  <span className="block mb-1">Postes</span>
                  <div className="space-y-1">
                    {roles.map(r => (
                      <div key={r.skill} className="flex justify-between text-xs">
                        <span>{r.skill} ×{r.count}</span>
                        <span style={{ color: '#f0e6d3' }}>{formatCFA(r.rate)}{billingUnit(r.billing)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <span>Lieu</span>
                  <span style={{ color: '#f0e6d3', textAlign: 'right' }}>{[form.location, form.ville].filter(Boolean).join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Durée totale</span>
                  <span style={{ color: '#f0e6d3' }}>{totalHrs}h · {totalHeadcount(roles)} personne(s)</span>
                </div>
                <div className="h-px" style={{ background: 'rgba(201,168,76,0.15)' }} />
                <div className="flex justify-between">
                  <span>Montant brut</span>
                  <span style={{ color: '#f0e6d3' }}>{formatCFA(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Commission (10%)</span>
                  <span style={{ color: '#ef4444' }}>-{formatCFA(commission)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Net freelances</span>
                  <span className="text-gold-gradient">{formatCFA(net)}</span>
                </div>
              </div>
              {form.is_urgent && (
                <div className="badge-urgent px-3 py-2 rounded-lg text-sm text-center flex items-center justify-center gap-2">
                  <Zap size={15} fill="currentColor" /> Mission marquée comme URGENTE
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="btn-outline-gold flex-1 py-3 rounded-xl">← Retour</button>
                <button onClick={() => submit('draft')} disabled={loading}
                  className="flex-1 py-3 rounded-xl text-sm font-medium border"
                  style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#b8a898' }}>
                  Brouillon
                </button>
                <button onClick={() => submit('open')} disabled={loading || uploadingVenue}
                  className="btn-gold flex-1 py-3 rounded-xl font-bold text-[#261642]">
                  {uploadingVenue ? 'Photo...' : loading ? 'Publication...' : 'Publier la mission'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
