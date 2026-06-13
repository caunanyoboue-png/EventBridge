import { useState } from 'react';
import { Settings, Wallet, Siren, ShieldCheck, Globe, Save } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    commission_rate: 10,
    sos_radius_km: 10,
    sos_duration_min: 30,
    min_hourly_rate: 1000,
    max_hourly_rate: 100000,
    auto_certify: false,
    require_id_verification: true,
    platform_name: 'EventBridge',
    support_email: 'support@eventbridge.ci',
  });
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    toast.success('Paramètres sauvegardés');
  }

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm outline-none";
  const inputStyle = { background: 'rgba(82,54,124,0.5)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0e6d3' };

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <label className="text-xs mb-1.5 block font-medium" style={{ color: '#b8a898' }}>{label}</label>
        {children}
      </div>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: '#f0e6d3' }}><Settings size={26} color="#d4af37" /> Paramètres plateforme</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financier */}
        <div className="card-glass p-6 space-y-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#d4af37' }}><Wallet size={18} /> Paramètres financiers</h2>
          <Field label="Taux de commission (%)">
            <input type="number" className={inputClass} style={inputStyle}
              value={settings.commission_rate} min={0} max={50}
              onChange={e => setSettings(p => ({ ...p, commission_rate: Number(e.target.value) }))} />
          </Field>
          <Field label="Tarif horaire minimum (FCFA)">
            <input type="number" className={inputClass} style={inputStyle}
              value={settings.min_hourly_rate} step={500}
              onChange={e => setSettings(p => ({ ...p, min_hourly_rate: Number(e.target.value) }))} />
          </Field>
          <Field label="Tarif horaire maximum (FCFA)">
            <input type="number" className={inputClass} style={inputStyle}
              value={settings.max_hourly_rate} step={1000}
              onChange={e => setSettings(p => ({ ...p, max_hourly_rate: Number(e.target.value) }))} />
          </Field>
        </div>

        {/* S.O.S Brigade */}
        <div className="card-glass p-6 space-y-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#ef4444' }}><Siren size={18} /> S.O.S Brigade</h2>
          <Field label="Rayon de recherche par défaut (km)">
            <input type="number" className={inputClass} style={inputStyle}
              value={settings.sos_radius_km} min={1} max={100}
              onChange={e => setSettings(p => ({ ...p, sos_radius_km: Number(e.target.value) }))} />
          </Field>
          <Field label="Durée de validité alerte (minutes)">
            <input type="number" className={inputClass} style={inputStyle}
              value={settings.sos_duration_min} min={10} max={120} step={10}
              onChange={e => setSettings(p => ({ ...p, sos_duration_min: Number(e.target.value) }))} />
          </Field>
        </div>

        {/* Vérification */}
        <div className="card-glass p-6 space-y-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#10b981' }}><ShieldCheck size={18} /> Vérification & Certification</h2>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium" style={{ color: '#f0e6d3' }}>Certification automatique</p>
              <p className="text-xs" style={{ color: '#7a6a7a' }}>Certifier après 10 missions réussies</p>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, auto_certify: !p.auto_certify }))}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{ background: settings.auto_certify ? '#d4af37' : 'rgba(82,54,124,0.8)' }}>
              <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: settings.auto_certify ? '26px' : '4px' }} />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium" style={{ color: '#f0e6d3' }}>Vérification d'identité</p>
              <p className="text-xs" style={{ color: '#7a6a7a' }}>Obligatoire pour les freelances</p>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, require_id_verification: !p.require_id_verification }))}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{ background: settings.require_id_verification ? '#d4af37' : 'rgba(82,54,124,0.8)' }}>
              <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: settings.require_id_verification ? '26px' : '4px' }} />
            </button>
          </div>
        </div>

        {/* Général */}
        <div className="card-glass p-6 space-y-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#3b82f6' }}><Globe size={18} /> Général</h2>
          <Field label="Nom de la plateforme">
            <input type="text" className={inputClass} style={inputStyle}
              value={settings.platform_name}
              onChange={e => setSettings(p => ({ ...p, platform_name: e.target.value }))} />
          </Field>
          <Field label="Email de support">
            <input type="email" className={inputClass} style={inputStyle}
              value={settings.support_email}
              onChange={e => setSettings(p => ({ ...p, support_email: e.target.value }))} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button onClick={saveSettings} disabled={saving}
          className="btn-gold px-8 py-3 rounded-xl font-bold text-[#261642] inline-flex items-center gap-2">
          {saving ? 'Sauvegarde...' : <><Save size={17} /> Sauvegarder les paramètres</>}
        </button>
      </div>
    </DashboardLayout>
  );
}
