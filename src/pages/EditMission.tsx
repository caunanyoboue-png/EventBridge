import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X, Camera, Search } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { COMPETENCES, VILLES } from '../lib/utils';
import MapPicker from '../components/MapPicker';
import { geocodeAddress } from '../lib/geo';
import toast from 'react-hot-toast';

const SERVICE_TYPES = [
  'Service en salle', 'Bar / Barman', 'Cuisine gastronomique', 'Hôtesse accueil',
  'Animation', 'MC / Présentateur', 'Son & Lumière', 'Photographie',
  'Vidéographie', 'Sécurité', 'Chauffeur', 'Manutention', 'Décoration',
];

const inputClass = 'w-full px-4 py-3 rounded-xl text-sm outline-none';
const inputStyle = { background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' };

export default function EditMission() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const [params]    = useSearchParams();
  const missionId   = params.get('id');

  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [form, setForm] = useState({
    title: '', service_type: '', description: '', dress_code: '', is_urgent: false,
    event_date: '', start_time: '', end_time: '', location: '', ville: 'Abidjan - Cocody',
    slots_total: 1, hourly_rate: 3000, skills_required: [] as string[],
    latitude: null as number | null, longitude: null as number | null, venue_photo_url: '',
  });

  const [venueFile, setVenueFile]     = useState<File | null>(null);
  const [venuePreview, setVenuePreview] = useState<string | null>(null);
  const [uploadingVenue, setUploadingVenue] = useState(false);
  const venueInputRef = useRef<HTMLInputElement>(null);
  const [geocoding, setGeocoding] = useState(false);
  const lastGeo = useRef(''); // dernière adresse déjà localisée → évite la boucle carte ↔ adresse

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
          service_type:    data.service_type      || '',
          description:     data.description       || '',
          dress_code:      data.dress_code        || '',
          is_urgent:       data.is_urgent         || false,
          event_date:      data.event_date        || '',
          start_time:      data.start_time        || '',
          end_time:        data.end_time          || '',
          location:        data.location          || '',
          ville:           data.ville             || 'Abidjan - Cocody',
          slots_total:     data.slots_total       || 1,
          hourly_rate:     data.hourly_rate       || 3000,
          skills_required: data.skills_required   || [],
          latitude:        data.latitude          ?? null,
          longitude:       data.longitude         ?? null,
          venue_photo_url: data.venue_photo_url   || '',
        });
        if (data.venue_photo_url) setVenuePreview(data.venue_photo_url);
        setLoading(false);
      });
  }, [missionId, profile, navigate]);

  function upd(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

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

  function toggleSkill(s: string) {
    setForm(p => ({
      ...p,
      skills_required: p.skills_required.includes(s)
        ? p.skills_required.filter(x => x !== s)
        : [...p.skills_required, s],
    }));
  }

  const duration = form.start_time && form.end_time
    ? Math.max(0, (new Date(`2000-01-01T${form.end_time}`).getTime() - new Date(`2000-01-01T${form.start_time}`).getTime()) / 3600000)
    : 0;
  const total      = form.hourly_rate * duration * form.slots_total;
  const commission = total * 0.10;
  const net        = total - commission;

  async function save(newStatus?: 'open' | 'draft') {
    if (!missionId) return;
    setSaving(true);
    try {
      let photoUrl = form.venue_photo_url;
      if (venueFile) photoUrl = await uploadVenuePhoto();

      const { error } = await supabase.from('missions').update({
        ...form,
        venue_photo_url: photoUrl,
        duration_hours: duration,
        total_amount:   total,
        ...(newStatus ? { status: newStatus } : {}),
      }).eq('id', missionId);
      if (error) throw error;

      // Si on publie (passage à 'open'), déclencher le matching
      if (newStatus === 'open') {
        const { data: count } = await supabase.rpc('notify_matching_freelances', {
          p_mission_id:      missionId,
          p_mission_title:   form.title,
          p_hourly_rate:     form.hourly_rate,
          p_ville:           form.ville,
          p_skills_required: form.skills_required.length > 0 ? form.skills_required : null,
        });
        toast.success(`Mission publiée ! ${count ?? 0} freelance(s) notifié(s)`);
      } else {
        toast.success('Mission mise à jour !');
      }
      navigate('/my-missions');
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  }

  const steps = ['Informations', 'Détails & Tarif', 'Récapitulatif'];

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
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Type de prestation *</label>
                <select className={inputClass} style={inputStyle}
                  value={form.service_type} onChange={e => upd('service_type', e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
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
              <button onClick={() => setStep(1)} disabled={!form.title || !form.service_type || !form.description}
                className="btn-gold w-full py-3 rounded-xl font-bold text-[#261642]">
                Continuer →
              </button>
            </>
          )}

          {/* Étape 2 */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Date *</label>
                  <input type="date" min={new Date().toISOString().slice(0, 10)} className={inputClass} style={inputStyle}
                    value={form.event_date} onChange={e => upd('event_date', e.target.value)} />
                  {form.event_date && form.event_date < new Date().toISOString().slice(0, 10) && (
                    <p className="text-xs mt-1" style={{ color: '#ef4444' }}>La date ne peut pas être dans le passé.</p>
                  )}
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Ville *</label>
                  <select className={inputClass} style={inputStyle}
                    value={form.ville} onChange={e => upd('ville', e.target.value)}>
                    {VILLES.map(v => <option key={v} value={v} style={{ background: '#1e0f3c', color: '#f0e6d3' }}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Heure début *</label>
                  <input type="time" className={inputClass} style={inputStyle}
                    value={form.start_time} onChange={e => upd('start_time', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Heure fin *</label>
                  <input type="time" className={inputClass} style={inputStyle}
                    value={form.end_time} onChange={e => upd('end_time', e.target.value)} />
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Nombre d'extras</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => upd('slots_total', Math.max(1, form.slots_total - 1))}
                      className="w-10 h-10 rounded-lg font-bold text-lg"
                      style={{ background: 'rgba(82,54,124,0.5)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.2)' }}>-</button>
                    <span className="text-xl font-bold" style={{ color: '#f0e6d3' }}>{form.slots_total}</span>
                    <button onClick={() => upd('slots_total', form.slots_total + 1)}
                      className="w-10 h-10 rounded-lg font-bold text-lg"
                      style={{ background: 'rgba(82,54,124,0.5)', color: '#d4af37', border: '1px solid rgba(201,168,76,0.2)' }}>+</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Tarif horaire (FCFA)</label>
                  <input type="number" className={inputClass} style={inputStyle}
                    value={form.hourly_rate} onChange={e => upd('hourly_rate', Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>Compétences requises</label>
                <div className="flex flex-wrap gap-2">
                  {COMPETENCES.map(c => (
                    <button key={c} onClick={() => toggleSkill(c)}
                      className="px-3 py-1 rounded-full text-xs transition-all border"
                      style={{
                        background: form.skills_required.includes(c) ? 'rgba(201,168,76,0.2)' : 'transparent',
                        borderColor: form.skills_required.includes(c) ? '#d4af37' : 'rgba(201,168,76,0.2)',
                        color: form.skills_required.includes(c) ? '#d4af37' : '#b8a898',
                      }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-outline-gold flex-1 py-3 rounded-xl">← Retour</button>
                <button onClick={() => setStep(2)} disabled={!form.event_date || form.event_date < new Date().toISOString().slice(0, 10) || !form.start_time || !form.end_time || !form.location}
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
                <div className="flex justify-between"><span>Type</span><span style={{ color: '#f0e6d3' }}>{form.service_type}</span></div>
                <div className="flex justify-between"><span>Date</span><span style={{ color: '#f0e6d3' }}>{form.event_date} · {form.start_time} - {form.end_time}</span></div>
                <div className="flex justify-between"><span>Lieu</span><span style={{ color: '#f0e6d3' }}>{form.location}, {form.ville}</span></div>
                <div className="flex justify-between"><span>Extras</span><span style={{ color: '#f0e6d3' }}>{form.slots_total} personne(s)</span></div>
                <div className="flex justify-between"><span>Durée</span><span style={{ color: '#f0e6d3' }}>{duration}h</span></div>
                <div className="h-px" style={{ background: 'rgba(201,168,76,0.15)' }} />
                <div className="flex justify-between"><span>Tarif horaire</span><span style={{ color: '#f0e6d3' }}>{form.hourly_rate.toLocaleString('fr-CI')} FCFA/h</span></div>
                <div className="flex justify-between"><span>Montant brut</span><span style={{ color: '#f0e6d3' }}>{total.toLocaleString('fr-CI')} FCFA</span></div>
                <div className="flex justify-between"><span>Commission (10%)</span><span style={{ color: '#ef4444' }}>-{commission.toLocaleString('fr-CI')} FCFA</span></div>
                <div className="flex justify-between font-bold"><span>Net freelances</span><span className="text-gold-gradient">{net.toLocaleString('fr-CI')} FCFA</span></div>
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
