import { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type SosSession } from '../types';
import toast from 'react-hot-toast';

const SERVICE_TYPES = [
  'Service en salle', 'Bar / Barman', 'Cuisine gastronomique', 'Hôtesse accueil',
  'Animation', 'Son & Lumière', 'Sécurité', 'Chauffeur', 'Manutention',
];

export default function SosBrigade() {
  const { profile } = useAuth();
  const [form, setForm] = useState({ service_type: '', location: '', slots_needed: 3, message: '' });
  const [session, setSession] = useState<SosSession | null>(null);
  const [loading, setLoading] = useState(false);

  async function declencher() {
    if (!profile || !form.service_type || !form.location) return;
    setLoading(true);
    try {
      const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      // 1. Créer la session SOS
      const { data, error } = await supabase.from('sos_sessions').insert({
        organisateur_id: profile.id,
        service_type: form.service_type,
        location: form.location,
        slots_needed: form.slots_needed,
        slots_confirmed: 0,
        radius_km: 10,
        notified_count: 0,
        status: 'active',
        expires_at,
        message: form.message || null,
      }).select().single();
      if (error) throw error;

      // 2. Chercher les freelances disponibles avec la compétence requise
      const { data: freelances } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'freelance')
        .eq('is_available', true)
        .contains('skills', [form.service_type])
        .neq('id', profile.id);

      const targets = freelances || [];

      // 3. Envoyer une notification à chaque freelance trouvé
      if (targets.length > 0) {
        const notifications = targets.map(f => ({
          user_id: f.id,
          type: 'sos_alert',
          title: '🚨 S.O.S Brigade — Urgence !',
          body: `Besoin urgent de ${form.service_type} à ${form.location}. ${form.slots_needed} poste(s) disponible(s). Répondez maintenant !`,
          data: { sos_session_id: data.id, service_type: form.service_type, location: form.location },
          is_read: false,
        }));
        await supabase.from('notifications').insert(notifications);

        // 4. Mettre à jour le compteur de notifiés
        await supabase.from('sos_sessions')
          .update({ notified_count: targets.length })
          .eq('id', data.id);

        data.notified_count = targets.length;
      }

      setSession(data);
      toast.success(`🚨 Alerte déclenchée ! ${targets.length} freelance(s) notifié(s).`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Erreur lors du déclenchement');
    }
    finally { setLoading(false); }
  }

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none";
  const inputStyle = { background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-sos inline-block">🚨</div>
          <h1 className="font-display text-3xl font-bold" style={{ color: '#f0e6d3' }}>S.O.S Brigade</h1>
          <p className="mt-2" style={{ color: '#b8a898' }}>
            Besoin d'extras en urgence ? Mobilisez les freelances disponibles autour de vous en moins de 10 minutes.
          </p>
        </div>

        {!session ? (
          <div className="card-glass p-8 space-y-5">
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Type de prestation *</label>
              <select className={inputClass} style={inputStyle}
                value={form.service_type} onChange={e => setForm(p => ({ ...p, service_type: e.target.value }))}>
                <option value="">Sélectionner...</option>
                {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Adresse exacte *</label>
              <input className={inputClass} style={inputStyle}
                placeholder="Ex: Avenue Delafosse, Plateau, Abidjan"
                value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs mb-2 block" style={{ color: '#b8a898' }}>Nombre d'extras requis</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setForm(p => ({ ...p, slots_needed: Math.max(1, p.slots_needed - 1) }))}
                  className="w-12 h-12 rounded-xl font-bold text-xl" style={{ background: 'rgba(82,54,124,0.5)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)' }}>-</button>
                <span className="text-3xl font-bold text-gold-gradient">{form.slots_needed}</span>
                <button onClick={() => setForm(p => ({ ...p, slots_needed: p.slots_needed + 1 }))}
                  className="w-12 h-12 rounded-xl font-bold text-xl" style={{ background: 'rgba(82,54,124,0.5)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)' }}>+</button>
              </div>
            </div>

            <div>
              <label className="text-xs mb-1 block" style={{ color: '#b8a898' }}>Message (optionnel)</label>
              <textarea className={inputClass} style={{ ...inputStyle, resize: 'none' }} rows={3}
                placeholder="Précisions supplémentaires..."
                value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
            </div>

            <button onClick={declencher} disabled={loading || !form.service_type || !form.location}
              className="w-full py-4 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-2 transition-all hover:opacity-90 animate-sos"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
              {loading ? 'Déclenchement...' : '🚨 Déclencher l\'alerte S.O.S'}
            </button>

            {/* Comment ça fonctionne */}
            <div className="pt-4 border-t" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: '#c9a84c' }}>💡 Comment ça fonctionne ?</p>
              {[
                'Vous décrivez votre besoin urgent',
                'Tous les freelances disponibles dans 10km reçoivent une alerte',
                'Les premiers confirmés sont sélectionnés automatiquement',
                'Vous recevez les profils en temps réel',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 mb-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)' }}>
                    {i + 1}
                  </div>
                  <p className="text-sm" style={{ color: '#b8a898' }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SosTracker session={session} onReset={() => setSession(null)} />
        )}
      </div>
    </DashboardLayout>
  );
}

function SosTracker({ session, onReset }: { session: SosSession; onReset: () => void }) {
  const timeLeft = Math.max(0, Math.round((new Date(session.expires_at).getTime() - Date.now()) / 60000));

  return (
    <div className="card-glass p-8 text-center">
      {/* Animation ondes */}
      <div className="relative inline-flex items-center justify-center mb-8">
        {[1, 2, 3].map(i => (
          <div key={i}
            className="absolute rounded-full border-2 animate-ping-slow"
            style={{
              width: `${i * 60}px`, height: `${i * 60}px`,
              borderColor: 'rgba(220,38,38,0.5)',
              animationDelay: `${i * 0.4}s`,
            }} />
        ))}
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl relative z-10"
          style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
          🚨
        </div>
      </div>

      <h2 className="text-xl font-bold text-gold-gradient mb-1">Recherche en cours...</h2>
      <p className="text-sm mb-6" style={{ color: '#b8a898' }}>
        {session.service_type} · {session.location}
      </p>
      <p className="text-sm mb-8" style={{ color: '#7a6a7a' }}>
        Rayon actuel : {session.radius_km} km · Expire dans {timeLeft} min
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card-glass p-4 text-center">
          <div className="text-2xl font-bold text-gold-gradient">{session.notified_count}</div>
          <div className="text-xs mt-1" style={{ color: '#b8a898' }}>Notifiés</div>
        </div>
        <div className="card-glass p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#10b981' }}>{session.slots_confirmed}</div>
          <div className="text-xs mt-1" style={{ color: '#b8a898' }}>Confirmés</div>
        </div>
        <div className="card-glass p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#ef4444' }}>{session.slots_needed}</div>
          <div className="text-xs mt-1" style={{ color: '#b8a898' }}>Requis</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="w-full h-3 rounded-full" style={{ background: '#52367c' }}>
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${(session.slots_confirmed / session.slots_needed) * 100}%`,
              background: 'linear-gradient(to right,#10b981,#34d399)',
            }} />
        </div>
        <p className="text-xs mt-1" style={{ color: '#b8a898' }}>{session.slots_confirmed}/{session.slots_needed} postes confirmés</p>
      </div>

      <button onClick={onReset} className="btn-outline-gold px-6 py-2 rounded-xl text-sm mt-4">
        Nouvelle alerte S.O.S
      </button>
    </div>
  );
}
