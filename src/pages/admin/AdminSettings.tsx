import { useState, useEffect } from 'react';
import { Wallet, Siren, ShieldCheck, Globe, Save, KeyRound, Mail, UserPlus, Crown, Trash2, LogOut } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { type Profile } from '../../types';
import { getInitials } from '../../lib/utils';
import { IcoGear } from '../../components/icons/DoodleIcons';
import { roleColor } from '../../lib/roleTheme';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const { profile, signOut } = useAuth();
  const isSuper = !!profile?.is_super_admin;

  // ── Mon compte ──────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyPwd, setBusyPwd] = useState(false);

  async function updateEmail() {
    if (!newEmail.trim()) return;
    setBusyEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setBusyEmail(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Email de confirmation envoyé à la nouvelle adresse.');
    setNewEmail('');
  }

  async function updatePassword() {
    if (pwd.length < 8) { toast.error('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (pwd !== pwd2) { toast.error('Les deux mots de passe ne correspondent pas.'); return; }
    setBusyPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusyPwd(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Mot de passe mis à jour.');
    setPwd(''); setPwd2('');
  }

  // ── Administrateurs (super-admin only) ──────────────────────
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [caName, setCaName] = useState('');
  const [caEmail, setCaEmail] = useState('');
  const [caPwd, setCaPwd] = useState('');
  const [busyCreate, setBusyCreate] = useState(false);

  useEffect(() => { if (isSuper) fetchAdmins(); }, [isSuper]);

  async function fetchAdmins() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'admin').order('created_at');
    setAdmins(data || []);
  }

  async function createAdmin() {
    if (!caEmail.trim() || caPwd.length < 8) { toast.error('Email + mot de passe (8 car. min.) requis.'); return; }
    setBusyCreate(true);
    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${base}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: caEmail.trim(), password: caPwd, full_name: caName.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erreur');
      toast.success('Administrateur créé.');
      setCaName(''); setCaEmail(''); setCaPwd('');
      fetchAdmins();
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Erreur';
      toast.error(/failed to fetch/i.test(raw)
        ? 'Service indisponible (Edge Function admin-create-user non déployée).' : raw);
    } finally { setBusyCreate(false); }
  }

  async function revokeAdmin(a: Profile) {
    const { error } = await supabase.from('profiles').update({ role: 'organisateur' }).eq('id', a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${a.full_name} n'est plus administrateur.`);
    fetchAdmins();
  }

  // ── Réglages plateforme (existants) ─────────────────────────
  const [settings, setSettings] = useState({
    commission_rate: 10, sos_radius_km: 10, sos_duration_min: 30,
    min_hourly_rate: 1000, max_hourly_rate: 100000,
    auto_certify: false, require_id_verification: true,
    platform_name: 'EventBridge', support_email: 'support@eventbridge.ci',
  });
  const [saving, setSaving] = useState(false);

  // Charger la configuration persistée
  useEffect(() => {
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setSettings(s => ({ ...s, ...data }));
    });
  }, []);

  async function saveSettings() {
    setSaving(true);
    const { error } = await supabase.from('app_settings').update({
      commission_rate: settings.commission_rate,
      sos_radius_km: settings.sos_radius_km,
      sos_duration_min: settings.sos_duration_min,
      min_hourly_rate: settings.min_hourly_rate,
      max_hourly_rate: settings.max_hourly_rate,
      auto_certify: settings.auto_certify,
      require_id_verification: settings.require_id_verification,
      platform_name: settings.platform_name,
      support_email: settings.support_email,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    if (error) { toast.error('Erreur lors de la sauvegarde'); return; }
    toast.success('Paramètres sauvegardés');
  }

  const inputClass = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none';
  const inputStyle = { background: 'var(--color-input-bg)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--color-text-primary)' };

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
        {children}
      </div>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: 'var(--color-text-primary)' }}><IcoGear size={26} color={roleColor('admin')} /> Paramètres</h1>

      {/* ── Mon compte ── */}
      <div className="card-glass p-6 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-gold-primary)' }}><KeyRound size={18} /> Mon compte</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Email */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Email actuel : <span style={{ color: 'var(--color-text-primary)' }}>{profile?.email}</span>
            </p>
            <Field label="Nouvel email">
              <input type="email" className={inputClass} style={inputStyle} placeholder="nouveau@email.com"
                value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </Field>
            <button onClick={updateEmail} disabled={busyEmail || !newEmail.trim()}
              className="btn-outline-gold mt-3 px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2 disabled:opacity-50">
              <Mail size={15} /> {busyEmail ? '…' : 'Mettre à jour l\'email'}
            </button>
          </div>
          {/* Mot de passe */}
          <div>
            <Field label="Nouveau mot de passe (8 car. min.)">
              <input type="password" className={inputClass} style={inputStyle} placeholder="••••••••"
                value={pwd} onChange={e => setPwd(e.target.value)} />
            </Field>
            <div className="mt-3">
              <Field label="Confirmer le mot de passe">
                <input type="password" className={inputClass} style={inputStyle} placeholder="••••••••"
                  value={pwd2} onChange={e => setPwd2(e.target.value)} />
              </Field>
            </div>
            <button onClick={updatePassword} disabled={busyPwd || !pwd}
              className="btn-gold mt-3 px-4 py-2 rounded-xl text-sm font-bold text-[#261642] inline-flex items-center gap-2 disabled:opacity-50">
              <KeyRound size={15} /> {busyPwd ? '…' : 'Changer le mot de passe'}
            </button>
          </div>
        </div>

        <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(201,168,76,0.12)' }}>
          <button onClick={signOut}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
            <LogOut size={16} /> Se déconnecter
          </button>
        </div>
      </div>

      {/* ── Administrateurs (admin principal uniquement) ── */}
      {isSuper && (
        <div className="card-glass p-6 mb-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--color-gold-primary)' }}><Crown size={18} /> Administrateurs</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Réservé à l'admin principal.</p>

          {/* Liste */}
          <div className="space-y-2 mb-5">
            {admins.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: 'var(--color-surface)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--color-gold-primary)', color: '#261642' }}>
                    {getInitials(a.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                      {a.full_name}
                      {a.is_super_admin && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.18)', color: 'var(--color-gold-primary)' }}><Crown size={11} /> Principal</span>}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{a.email}</p>
                  </div>
                </div>
                {!a.is_super_admin && a.id !== profile?.id && (
                  <button onClick={() => revokeAdmin(a)}
                    className="px-3 py-1.5 rounded-lg text-xs border inline-flex items-center gap-1"
                    style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#ef4444' }}>
                    <Trash2 size={12} /> Retirer
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Créer un admin */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>Créer un nouvel administrateur</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className={inputClass} style={inputStyle} placeholder="Nom complet"
                value={caName} onChange={e => setCaName(e.target.value)} />
              <input type="email" className={inputClass} style={inputStyle} placeholder="Email"
                value={caEmail} onChange={e => setCaEmail(e.target.value)} />
              <input type="password" className={inputClass} style={inputStyle} placeholder="Mot de passe (8 car. min.)"
                value={caPwd} onChange={e => setCaPwd(e.target.value)} />
            </div>
            <button onClick={createAdmin} disabled={busyCreate}
              className="btn-gold mt-3 px-5 py-2.5 rounded-xl text-sm font-bold text-[#261642] inline-flex items-center gap-2 disabled:opacity-60">
              <UserPlus size={15} /> {busyCreate ? 'Création…' : 'Créer l\'administrateur'}
            </button>
          </div>
        </div>
      )}

      {/* ── Réglages plateforme ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-glass p-6 space-y-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-gold-primary)' }}><Wallet size={18} /> Paramètres financiers</h2>
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

        <div className="card-glass p-6 space-y-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#10b981' }}><ShieldCheck size={18} /> Vérification & Certification</h2>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Certification automatique</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Certifier après 10 missions réussies</p>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, auto_certify: !p.auto_certify }))}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{ background: settings.auto_certify ? 'var(--color-gold-primary)' : 'var(--color-surface-strong)' }}>
              <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: settings.auto_certify ? '26px' : '4px' }} />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Vérification d'identité</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Obligatoire pour les freelances</p>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, require_id_verification: !p.require_id_verification }))}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{ background: settings.require_id_verification ? 'var(--color-gold-primary)' : 'var(--color-surface-strong)' }}>
              <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: settings.require_id_verification ? '26px' : '4px' }} />
            </button>
          </div>
        </div>

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
