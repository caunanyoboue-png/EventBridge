import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { COMPETENCES, VILLES } from '../lib/utils';
import { type UserRole } from '../types';

const LOGO = '/logo.png.jpeg';

export default function Onboarding() {
  const navigate = useNavigate();
  const { signIn, signUp, profile, updateProfile } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'complete'>('login');
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '',
    role: 'freelance' as UserRole, ville: 'Abidjan - Cocody',
    quartier: '', bio: '', skills: [] as string[],
    hourly_rate: 2500, experience_years: 0,
    company_name: '', company_sector: '', rccm: '',
  });

  function updateForm(key: string, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleSkill(skill: string) {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }));
  }

  async function handleLogin() {
    setLoading(true);
    try {
      await signIn(form.email, form.password);
      navigate('/dashboard');
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        toast.error('Confirmez votre email avant de vous connecter (vérifiez vos spams)');
      } else if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        toast.error('Email ou mot de passe incorrect');
      } else {
        toast.error(msg || 'Erreur de connexion');
      }
    } finally { setLoading(false); }
  }

  async function handleRegister() {
    setLoading(true);
    try {
      await signUp(form.email, form.password, { full_name: form.full_name, role: form.role, ville: form.ville });
      toast.success('Compte créé ! Complétez votre profil pour continuer.');
      setMode('complete');
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        toast.error('Cet email est déjà utilisé. Connectez-vous.');
        setMode('login');
      } else {
        toast.error(msg || "Erreur lors de l'inscription");
      }
    } finally { setLoading(false); }
  }

  async function handleComplete() {
    setLoading(true);
    try {
      await updateProfile({
        full_name: form.full_name || profile?.full_name,
        phone: form.phone,
        ville: form.ville || profile?.ville,
        quartier: form.quartier,
        bio: form.bio,
        skills: form.skills,
        hourly_rate: form.hourly_rate,
        experience_years: form.experience_years,
        company_name: form.company_name,
        company_sector: form.company_sector,
        rccm: form.rccm,
        onboarding_done: true,
      });
      toast.success('Profil complété ! Bienvenue sur EventBridge');
      navigate('/dashboard');
    } catch {
      toast.error('Erreur lors de la mise à jour du profil');
    } finally { setLoading(false); }
  }

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all";
  const inputStyle = {
    background: 'rgba(61,36,96,0.5)',
    border: '1px solid rgba(201,168,76,0.2)',
    color: '#f0e6d3',
  };

  // ── Détermine quel formulaire afficher ──────────────────────────────────────
  // Priorité 1 : utilisateur connecté sans onboarding → formulaire de complétion
  const needsCompletion = profile && !profile.onboarding_done;
  // Priorité 2 : flux inscription juste terminée → formulaire de complétion
  const showCompletion = needsCompletion || mode === 'complete';

  const title = showCompletion
    ? 'Complétez votre profil'
    : mode === 'login' ? 'Bienvenue !'
    : 'Créer un compte';

  const subtitle = showCompletion
    ? 'Encore quelques infos pour personnaliser votre expérience'
    : mode === 'login' ? 'Connectez-vous à votre compte'
    : 'Rejoignez EventBridge gratuitement';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #120720 0%, #1a0a2e 50%, #2d1b4e 100%)' }}>

      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src={LOGO} className="h-16 w-auto mx-auto mb-4 animate-float" alt="EventBridge" />
          <h1 className="font-display text-2xl font-bold" style={{ color: '#f0e6d3' }}>{title}</h1>
          <p className="text-sm mt-1" style={{ color: '#b8a898' }}>{subtitle}</p>
        </div>

        <div className="card-glass p-8">

          {/* ── COMPLÉTION PROFIL (prioritaire) ────────────────────────────── */}
          {showCompletion && (
            <div className="space-y-4">
              <input className={inputClass} style={inputStyle} placeholder="Téléphone (+225)"
                value={form.phone} onChange={e => updateForm('phone', e.target.value)} />
              <input className={inputClass} style={inputStyle} placeholder="Quartier"
                value={form.quartier} onChange={e => updateForm('quartier', e.target.value)} />
              <textarea className={inputClass} style={{ ...inputStyle, resize: 'none' }} rows={3}
                placeholder="Bio / Présentation"
                value={form.bio} onChange={e => updateForm('bio', e.target.value)} />

              {(form.role === 'freelance' || profile?.role === 'freelance') && (
                <>
                  <div>
                    <p className="text-sm mb-2" style={{ color: '#b8a898' }}>Compétences</p>
                    <div className="flex flex-wrap gap-2">
                      {COMPETENCES.map(c => (
                        <button key={c} onClick={() => toggleSkill(c)}
                          className="px-3 py-1 rounded-full text-xs transition-all border"
                          style={{
                            background: form.skills.includes(c) ? 'rgba(201,168,76,0.2)' : 'transparent',
                            borderColor: form.skills.includes(c) ? '#c9a84c' : 'rgba(201,168,76,0.2)',
                            color: form.skills.includes(c) ? '#c9a84c' : '#b8a898',
                          }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-xs mb-1" style={{ color: '#b8a898' }}>Tarif horaire (FCFA)</p>
                      <input className={inputClass} style={inputStyle} type="number"
                        value={form.hourly_rate} onChange={e => updateForm('hourly_rate', Number(e.target.value))} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs mb-1" style={{ color: '#b8a898' }}>Années d'expérience</p>
                      <input className={inputClass} style={inputStyle} type="number"
                        value={form.experience_years} onChange={e => updateForm('experience_years', Number(e.target.value))} />
                    </div>
                  </div>
                </>
              )}

              {(form.role === 'organisateur' || profile?.role === 'organisateur') && (
                <>
                  <input className={inputClass} style={inputStyle} placeholder="Nom de la structure *"
                    value={form.company_name} onChange={e => updateForm('company_name', e.target.value)} />
                  <input className={inputClass} style={inputStyle} placeholder="Secteur d'activité"
                    value={form.company_sector} onChange={e => updateForm('company_sector', e.target.value)} />
                  <input className={inputClass} style={inputStyle} placeholder="RCCM (optionnel)"
                    value={form.rccm} onChange={e => updateForm('rccm', e.target.value)} />
                </>
              )}

              <button onClick={handleComplete} disabled={loading}
                className="btn-gold w-full py-3 rounded-xl font-bold text-[#1a0a2e]">
                {loading ? 'Enregistrement...' : 'Accéder à la plateforme →'}
              </button>
            </div>
          )}

          {/* ── CONNEXION ───────────────────────────────────────────────────── */}
          {!showCompletion && mode === 'login' && (
            <div className="space-y-4">
              <input className={inputClass} style={inputStyle} type="email" placeholder="Email"
                value={form.email} onChange={e => updateForm('email', e.target.value)} />
              <input className={inputClass} style={inputStyle} type="password" placeholder="Mot de passe"
                value={form.password} onChange={e => updateForm('password', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <button onClick={handleLogin} disabled={loading || !form.email || !form.password}
                className="btn-gold w-full py-3 rounded-xl font-bold text-[#1a0a2e]">
                {loading ? 'Connexion...' : 'Se connecter →'}
              </button>
              <p className="text-center text-sm" style={{ color: '#b8a898' }}>
                Pas de compte ?{' '}
                <button onClick={() => { setMode('register'); setStep(0); }} className="font-medium" style={{ color: '#c9a84c' }}>
                  S'inscrire gratuitement
                </button>
              </p>
            </div>
          )}

          {/* ── INSCRIPTION — Étape 1 : choix du rôle ──────────────────────── */}
          {!showCompletion && mode === 'register' && step === 0 && (
            <div className="space-y-6">
              <h2 className="text-center font-semibold" style={{ color: '#f0e6d3' }}>Qui êtes-vous ?</h2>
              <div className="grid grid-cols-2 gap-4">
                {(['freelance', 'organisateur'] as UserRole[]).map(r => (
                  <button key={r} onClick={() => updateForm('role', r)}
                    className="p-6 rounded-xl text-center transition-all duration-200 border"
                    style={{
                      background: form.role === r ? 'rgba(201,168,76,0.15)' : 'rgba(61,36,96,0.3)',
                      borderColor: form.role === r ? '#c9a84c' : 'rgba(201,168,76,0.2)',
                      color: form.role === r ? '#c9a84c' : '#b8a898',
                    }}>
                    <div className="text-3xl mb-2">{r === 'freelance' ? '🎯' : '🏢'}</div>
                    <div className="font-semibold capitalize">{r}</div>
                    <div className="text-xs mt-1">
                      {r === 'freelance' ? 'Je propose mes services' : 'Je recrute des talents'}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="btn-gold w-full py-3 rounded-xl font-bold text-[#1a0a2e]">
                Continuer →
              </button>
              <p className="text-center text-sm" style={{ color: '#b8a898' }}>
                Déjà un compte ?{' '}
                <button onClick={() => setMode('login')} style={{ color: '#c9a84c' }}>Se connecter</button>
              </p>
            </div>
          )}

          {/* ── INSCRIPTION — Étape 2 : informations personnelles ───────────── */}
          {!showCompletion && mode === 'register' && step === 1 && (
            <div className="space-y-4">
              <h2 className="text-center font-semibold mb-2" style={{ color: '#f0e6d3' }}>Informations personnelles</h2>
              <input className={inputClass} style={inputStyle} placeholder="Nom complet *"
                value={form.full_name} onChange={e => updateForm('full_name', e.target.value)} />
              <input className={inputClass} style={inputStyle} type="email" placeholder="Email *"
                value={form.email} onChange={e => updateForm('email', e.target.value)} />
              <input className={inputClass} style={inputStyle} type="password" placeholder="Mot de passe (min. 6 caractères) *"
                value={form.password} onChange={e => updateForm('password', e.target.value)} />
              <select className={inputClass} style={inputStyle}
                value={form.ville} onChange={e => updateForm('ville', e.target.value)}>
                {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-outline-gold flex-1 py-3 rounded-xl">← Retour</button>
                <button onClick={handleRegister}
                  disabled={loading || !form.full_name || !form.email || !form.password || form.password.length < 6}
                  className="btn-gold flex-1 py-3 rounded-xl font-bold text-[#1a0a2e]">
                  {loading ? 'Création...' : "S'inscrire →"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
