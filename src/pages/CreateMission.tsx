import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { COMPETENCES, VILLES } from '../lib/utils';
import MapPicker from '../components/MapPicker';
import toast from 'react-hot-toast';

const SERVICE_TYPES = [
  'Service en salle', 'Bar / Barman', 'Cuisine gastronomique', 'Hôtesse accueil',
  'Animation', 'MC / Présentateur', 'Son & Lumière', 'Photographie',
  'Vidéographie', 'Sécurité', 'Chauffeur', 'Manutention', 'Décoration',
];

export default function CreateMission() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: '', service_type: '', description: '', dress_code: '', is_urgent: false,
    event_date: '', start_time: '', end_time: '', location: '', ville: 'Abidjan - Cocody',
    slots_total: 1, hourly_rate: 3000, skills_required: [] as string[],
    latitude: null as number | null,
    longitude: null as number | null,
    venue_photo_url: '' as string,
  });
  const [venueFile, setVenueFile] = useState<File | null>(null);
  const [venuePreview, setVenuePreview] = useState('');
  const [uploadingVenue, setUploadingVenue] = useState(false);

  function upd(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

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
  function toggleSkill(s: string) {
    setForm(p => ({ ...p, skills_required: p.skills_required.includes(s) ? p.skills_required.filter(x => x !== s) : [...p.skills_required, s] }));
  }

  const duration = form.start_time && form.end_time
    ? Math.max(0, (new Date(`2000-01-01T${form.end_time}`).getTime() - new Date(`2000-01-01T${form.start_time}`).getTime()) / 3600000)
    : 0;
  const total = form.hourly_rate * duration * form.slots_total;
  const commission = total * 0.10;
  const net = total - commission;

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none";
  const inputStyle = { background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' };

  async function submit(status: 'draft' | 'open') {
    setLoading(true);
    try {
      let venue_photo_url = form.venue_photo_url;
      if (venueFile) venue_photo_url = await uploadVenuePhoto();

      const { data: mission, error } = await supabase.from('missions').insert({
        ...form,
        venue_photo_url,
        organisateur_id: profile!.id,
        duration_hours: duration,
        total_amount: total,
        commission_rate: 0.10,
        status,
        slots_filled: 0,
        idempotency_key: crypto.randomUUID(),
      }).select('id').single();
      if (error) throw error;

      if (status === 'open' && mission) {
        const { data: count } = await supabase.rpc('notify_matching_freelances', {
          p_mission_id:       mission.id,
          p_mission_title:    form.title,
          p_hourly_rate:      form.hourly_rate,
          p_ville:            form.ville,
          p_skills_required:  form.skills_required.length > 0 ? form.skills_required : null,
        });
        toast.success(`Mission publiée ! ${count ?? 0} freelance(s) notifié(s) 🎯`);
      } else {
        toast.success('Brouillon enregistré');
      }
      navigate('/my-missions');
    } catch { toast.error('Erreur lors de la publication'); }
    finally { setLoading(false); }
  }

  const steps = ['Informations', 'Détails & Tarif', 'Récapitulatif'];

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
                    ? { background: 'linear-gradient(135deg,#c9a84c,#e8c97a)', color: '#261642' }
                    : { border: '1px solid rgba(201,168,76,0.3)', color: '#7a6a7a' }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-xs hidden sm:block" style={{ color: i === step ? '#c9a84c' : '#7a6a7a' }}>{s}</span>
              </div>
              {i < steps.length - 1 && <div className="w-8 h-px mx-2" style={{ background: i < step ? '#c9a84c' : 'rgba(201,168,76,0.2)' }} />}
            </div>
          ))}
        </div>

        <div className="card-glass p-8 space-y-5">
          {/* Étape 1 */}
          {step === 0 && (
            <>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Titre de la mission *</label>
                <input className={inputClass} style={inputStyle} placeholder="Ex: Service en salle – Gala annuel"
                  value={form.title} onChange={e => upd('title', e.target.value)} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Type de prestation *</label>
                <select className={inputClass} style={inputStyle} value={form.service_type} onChange={e => upd('service_type', e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
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
                <span className="text-sm" style={{ color: '#b8a898' }}>Mission urgente ⚡</span>
              </label>
              <button onClick={() => setStep(1)} disabled={!form.title || !form.service_type || !form.description}
                className="btn-gold w-full py-3 rounded-xl font-bold text-[#261642]">Continuer →</button>
            </>
          )}

          {/* Étape 2 */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Date *</label>
                  <input type="date" className={inputClass} style={inputStyle} value={form.event_date} onChange={e => upd('event_date', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Ville *</label>
                  <select className={inputClass} style={inputStyle} value={form.ville} onChange={e => upd('ville', e.target.value)}>
                    {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Heure début *</label>
                  <input type="time" className={inputClass} style={inputStyle} value={form.start_time} onChange={e => upd('start_time', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Heure fin *</label>
                  <input type="time" className={inputClass} style={inputStyle} value={form.end_time} onChange={e => upd('end_time', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Adresse exacte *</label>
                <input className={inputClass} style={inputStyle} placeholder="Ex: Avenue Delafosse, Plateau"
                  value={form.location} onChange={e => upd('location', e.target.value)} />
              </div>

              {/* Photo du lieu */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>
                  Photo du lieu <span style={{ opacity: 0.5 }}>(optionnel)</span>
                </label>
                {venuePreview ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                    <img src={venuePreview} alt="Lieu" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
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
                      <rect x="2" y="6" width="24" height="18" rx="3" stroke="#c9a84c" strokeWidth="1.5" strokeOpacity="0.5"/>
                      <circle cx="9" cy="13" r="2.5" stroke="#c9a84c" strokeWidth="1.5" strokeOpacity="0.5"/>
                      <path d="M2 20l7-5 5 4 4-3 8 5" stroke="#c9a84c" strokeWidth="1.5" strokeOpacity="0.5" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 12, color: 'rgba(201,168,76,0.5)' }}>Ajouter une photo du lieu</span>
                  </label>
                )}
              </div>

              {/* Carte interactive */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>
                  Localisation sur la carte
                  {form.latitude && <span style={{ color: '#c9a84c', marginLeft: 8 }}>✓ Position enregistrée</span>}
                </label>
                <MapPicker
                  lat={form.latitude}
                  lng={form.longitude}
                  onSelect={(lat, lng, addr) => {
                    upd('latitude', lat);
                    upd('longitude', lng);
                    if (!form.location) upd('location', addr);
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Nombre d'extras</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => upd('slots_total', Math.max(1, form.slots_total - 1))}
                      className="w-10 h-10 rounded-lg font-bold text-lg" style={{ background: 'rgba(82,54,124,0.5)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)' }}>-</button>
                    <span className="text-xl font-bold" style={{ color: '#f0e6d3' }}>{form.slots_total}</span>
                    <button onClick={() => upd('slots_total', form.slots_total + 1)}
                      className="w-10 h-10 rounded-lg font-bold text-lg" style={{ background: 'rgba(82,54,124,0.5)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)' }}>+</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Tarif horaire (FCFA)</label>
                  <input type="number" className={inputClass} style={inputStyle} value={form.hourly_rate} onChange={e => upd('hourly_rate', Number(e.target.value))} />
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
                        borderColor: form.skills_required.includes(c) ? '#c9a84c' : 'rgba(201,168,76,0.2)',
                        color: form.skills_required.includes(c) ? '#c9a84c' : '#b8a898',
                      }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-outline-gold flex-1 py-3 rounded-xl">← Retour</button>
                <button onClick={() => setStep(2)} disabled={!form.event_date || !form.start_time || !form.end_time || !form.location}
                  className="btn-gold flex-1 py-3 rounded-xl font-bold text-[#261642]">Continuer →</button>
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
              {form.is_urgent && <div className="badge-urgent px-3 py-2 rounded-lg text-sm text-center">⚡ Mission marquée comme URGENTE</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="btn-outline-gold flex-1 py-3 rounded-xl">← Retour</button>
                <button onClick={() => submit('draft')} disabled={loading}
                  className="flex-1 py-3 rounded-xl text-sm font-medium border" style={{ borderColor: 'rgba(201,168,76,0.3)', color: '#b8a898' }}>
                  Brouillon
                </button>
                <button onClick={() => submit('open')} disabled={loading || uploadingVenue}
                  className="btn-gold flex-1 py-3 rounded-xl font-bold text-[#261642]">
                  {uploadingVenue ? 'Photo en cours...' : loading ? 'Publication...' : 'Publier 🚀'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
