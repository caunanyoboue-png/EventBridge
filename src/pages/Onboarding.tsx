import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { COMPETENCES, VILLES } from '../lib/utils';
import { type UserRole } from '../types';
import toast from 'react-hot-toast';

const LOGO = '/logo.png.jpeg';

// ─── Styles réutilisables ─────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 12,
  fontSize: 14,
  outline: 'none',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(201,168,76,0.2)',
  color: '#f0e6d3',
  boxSizing: 'border-box',
};
const btnGold: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  background: 'linear-gradient(135deg,#c9a84c,#e8c97a)',
  color: '#261642',
  transition: 'opacity 0.15s',
};
const btnOutline: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  background: 'transparent',
  border: '1px solid rgba(201,168,76,0.3)',
  color: '#c9a84c',
  transition: 'background 0.15s',
};

type Mode = 'login' | 'register';

export default function Onboarding() {
  const navigate   = useNavigate();
  const { signIn, signUp, updateProfile, profile, user, loading } = useAuth();

  const [mode, setMode]       = useState<Mode>('login');
  const [step, setStep]       = useState(0);   // 0=rôle, 1=infos, 2=complétion
  const [busy, setBusy]       = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Champs formulaire
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [fullName, setFullName]   = useState('');
  const [role, setRole]           = useState<UserRole>('freelance');
  const [ville, setVille]         = useState('Abidjan - Cocody');
  const [phone, setPhone]         = useState('');
  const [quartier, setQuartier]   = useState('');
  const [bio, setBio]             = useState('');
  const [skills, setSkills]       = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState(2500);
  const [expYears, setExpYears]   = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [companySector, setCompanySector] = useState('');

  // ── Rediriger si déjà connecté et profil complet ──────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user || !profile) return;
    // onboarding_done peut être true, false ou undefined (colonne absente)
    if (profile.onboarding_done !== false) {
      // Profil complet → aller au bon dashboard
      if (profile.role === 'freelance')        navigate('/freelance-dashboard', { replace: true });
      else if (profile.role === 'organisateur') navigate('/organisateur-dashboard', { replace: true });
      else if (profile.role === 'admin')        navigate('/admin/AdminDashboard', { replace: true });
    }
  }, [loading, user, profile, navigate]);

  const MAX_SKILLS = 8;
  function toggleSkill(s: string) {
    setSkills(prev => {
      if (prev.includes(s)) return prev.filter(x => x !== s);
      if (prev.length >= MAX_SKILLS) { toast.error(`Maximum ${MAX_SKILLS} compétences`); return prev; }
      return [...prev, s];
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONNEXION
  // ─────────────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!email || !password) return;
    setBusy(true);
    try {
      await signIn(email, password);
      // La redirection est gérée par l'useEffect ci-dessus (via profile chargé)
      navigate('/dashboard');
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.includes('email not confirmed') || msg.includes('Email not confirmed')) {
        toast.error('Confirmez votre adresse email avant de vous connecter.');
      } else if (msg.includes('Invalid login') || msg.includes('invalid credentials') || msg.includes('Invalid credentials')) {
        toast.error('Email ou mot de passe incorrect.');
      } else {
        toast.error(msg || 'Erreur de connexion.');
      }
    } finally { setBusy(false); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INSCRIPTION — étape 1 : créer le compte
  // ─────────────────────────────────────────────────────────────────────────
  async function handleRegister() {
    if (!fullName || !email || !password) return;
    if (password.length < 6) { toast.error('Le mot de passe doit faire au moins 6 caractères.'); return; }
    setBusy(true);
    try {
      await signUp(email, password, { full_name: fullName, role, ville });
      setEmailSent(true); // afficher l'écran "Vérifiez votre email"
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('already been registered')) {
        toast.error('Cet email est déjà utilisé. Veuillez vous connecter.');
        setMode('login');
        setStep(0);
      } else if (msg.includes('rate limit') || msg.includes('email rate')) {
        toast.error('Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.');
      } else {
        toast.error(msg || "Erreur lors de l'inscription.");
      }
    } finally { setBusy(false); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLÉTION DU PROFIL
  // ─────────────────────────────────────────────────────────────────────────
  async function handleComplete() {
    setBusy(true);
    try {
      const currentRole = profile?.role || role;
      await updateProfile({
        full_name:       fullName || profile?.full_name,
        phone:           phone    || undefined,
        ville:           ville    || profile?.ville,
        quartier:        quartier || undefined,
        bio:             bio      || undefined,
        skills:          skills.length ? skills : undefined,
        hourly_rate:     currentRole === 'freelance' ? hourlyRate : undefined,
        experience_years: currentRole === 'freelance' ? expYears : undefined,
        company_name:    currentRole === 'organisateur' ? companyName  : undefined,
        company_sector:  currentRole === 'organisateur' ? companySector : undefined,
        onboarding_done: true,
      });
      toast.success('Bienvenue sur EventBridge !');
      const r = profile?.role || role;
      if (r === 'freelance')        navigate('/freelance-dashboard',    { replace: true });
      else if (r === 'organisateur') navigate('/organisateur-dashboard', { replace: true });
      else                           navigate('/dashboard',              { replace: true });
    } catch (e: unknown) {
      const msg = (e as Error).message || JSON.stringify(e);
      console.error('[handleComplete] Supabase error:', e);
      toast.error(`Erreur : ${msg}`);
    } finally { setBusy(false); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Détermine si on doit montrer la complétion
  // ─────────────────────────────────────────────────────────────────────────
  const needsCompletion = (profile && profile.onboarding_done === false) || (mode === 'register' && step === 2);

  // Titre dynamique
  const title    = needsCompletion ? 'Complétez votre profil'
    : mode === 'login' ? 'Bienvenue !'
    : step === 0 ? 'Qui êtes-vous ?'
    : 'Créer votre compte';
  const subtitle = needsCompletion ? 'Encore quelques informations pour personnaliser votre expérience'
    : mode === 'login' ? 'Connectez-vous à votre espace EventBridge'
    : step === 0 ? 'Choisissez votre profil'
    : 'Renseignez vos informations';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0a1e' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #c9a84c',
          borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const currentRole = profile?.role || role;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      backgroundImage: 'url(/images/img-de-fond-page-connexion.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      {/* Overlay sombre pour lisibilité */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(10,5,24,0.82) 0%, rgba(19,8,40,0.85) 50%, rgba(30,16,64,0.82) 100%)',
      }} />
      <div className="onboarding-wrap" style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>

        {/* Logo + titre */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={LOGO} style={{ height: 56, width: 'auto', marginBottom: 16, display: 'block', margin: '0 auto 16px' }} alt="EventBridge" />
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#f0e6d3', margin: '0 0 6px' }}>{title}</h1>
          <p style={{ fontSize: 14, color: 'rgba(240,230,211,0.5)', margin: 0 }}>{subtitle}</p>
        </div>

        {/* Card formulaire */}
        <div className="onboarding-card" style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(201,168,76,0.15)',
          borderRadius: 20,
          padding: '32px 28px',
          backdropFilter: 'blur(20px)',
        }}>

            {/* ══════════════════════════════════════════════════════════
              EMAIL ENVOYÉ — confirmation requise
          ══════════════════════════════════════════════════════════ */}
          {emailSent && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0e6d3', margin: '0 0 12px' }}>
                Vérifiez votre boîte mail
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(240,230,211,0.65)', lineHeight: 1.7, margin: '0 0 20px' }}>
                Nous avons envoyé un lien de confirmation à<br/>
                <strong style={{ color: '#c9a84c' }}>{email}</strong>.<br/>
                Cliquez sur ce lien pour activer votre compte et accéder à la plateforme.
              </p>
              <p style={{ fontSize: 12, color: 'rgba(240,230,211,0.35)', margin: '0 0 20px', lineHeight: 1.6 }}>
                Vous ne trouvez pas l'email ? Vérifiez vos spams.<br/>
                Le lien expire après 24h.
              </p>
              <button onClick={() => { setEmailSent(false); setMode('login'); setStep(0); }}
                style={{ ...btnGold, width: 'auto', padding: '10px 28px' }}>
                Aller à la connexion →
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              COMPLÉTION DU PROFIL (prioritaire)
          ══════════════════════════════════════════════════════════ */}
          {!emailSent && needsCompletion && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Téléphone — format ivoirien +225 XX XX XX XX XX */}
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 13, color: '#c9a84c', fontWeight: 600, pointerEvents: 'none', userSelect: 'none',
                }}>🇨🇮 +225</span>
                <input
                  style={{ ...inp, paddingLeft: 80 }}
                  placeholder="07 00 00 00 00"
                  value={phone.replace(/^\+?225\s?/, '')}
                  maxLength={14}
                  onChange={e => {
                    // Garde uniquement les chiffres et espaces
                    const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 10);
                    // Formate en XX XX XX XX XX
                    const formatted = digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
                    setPhone(digits.length ? `+225 ${formatted}` : '');
                  }}
                />
              </div>
              {phone && !/^\+225 \d{2} \d{2} \d{2} \d{2} \d{2}$/.test(phone) && (
                <p style={{ fontSize: 11, color: '#f59e0b', margin: '-8px 0 0', paddingLeft: 4 }}>
                  Format : +225 07 00 00 00 00 (10 chiffres)
                </p>
              )}

              <input style={inp} placeholder="Quartier"
                value={quartier} onChange={e => setQuartier(e.target.value)} />

              <textarea style={{ ...inp, resize: 'none', height: 90 }}
                placeholder="Présentez-vous en quelques mots…"
                value={bio} onChange={e => setBio(e.target.value)} />

              {/* Freelance : compétences + tarif */}
              {currentRole === 'freelance' && (
                <>
                  <div>
                    <p style={{ fontSize: 12, color: 'rgba(240,230,211,0.5)', marginBottom: 10 }}>
                      Compétences — {skills.length}/{MAX_SKILLS} sélectionnée(s)
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {COMPETENCES.map(c => (
                        <button key={c} type="button" onClick={() => toggleSkill(c)}
                          style={{
                            padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                            transition: 'all 0.15s',
                            background: skills.includes(c) ? 'rgba(201,168,76,0.2)' : 'transparent',
                            border: `1px solid ${skills.includes(c) ? '#c9a84c' : 'rgba(201,168,76,0.2)'}`,
                            color: skills.includes(c) ? '#c9a84c' : 'rgba(240,230,211,0.5)',
                          }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 12, color: 'rgba(240,230,211,0.5)', marginBottom: 6 }}>
                        Tarif horaire (FCFA)
                      </p>
                      <input style={inp} type="number" min={0} placeholder="Ex: 2500"
                        value={hourlyRate === 0 ? '' : hourlyRate}
                        onChange={e => setHourlyRate(e.target.value === '' ? 0 : Math.abs(parseInt(e.target.value, 10) || 0))} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: 'rgba(240,230,211,0.5)', marginBottom: 6 }}>
                        Années d'expérience
                      </p>
                      <input style={inp} type="number" min={0} placeholder="Ex: 3"
                        value={expYears === 0 ? '' : expYears}
                        onChange={e => setExpYears(e.target.value === '' ? 0 : Math.abs(parseInt(e.target.value, 10) || 0))} />
                    </div>
                  </div>
                </>
              )}

              {/* Organisateur : structure */}
              {currentRole === 'organisateur' && (
                <>
                  <input style={inp} placeholder="Nom de la structure *"
                    value={companyName} onChange={e => setCompanyName(e.target.value)} />
                  <select
                    style={{ ...inp, cursor: 'pointer', background: '#1e0f3c', color: companySector ? '#f0e6d3' : 'rgba(240,230,211,0.4)' }}
                    value={companySector}
                    onChange={e => setCompanySector(e.target.value)}>
                    <option value="" style={{ background: '#1e0f3c', color: 'rgba(240,230,211,0.4)' }}>Secteur d'activité</option>
                    {[
                      'Événementiel & Communication',
                      'Hôtellerie & Restauration',
                      'Musique & Entertainment',
                      'Mariage & Célébrations',
                      'Mode & Beauté',
                      'Sport & Fitness',
                      'Art & Culture',
                      'Entreprise & Corporate',
                      'ONG & Associations',
                      'Éducation & Formation',
                      'Technologie & Numérique',
                      'Santé & Bien-être',
                      'Finance & Assurance',
                      'Immobilier',
                      'Commerce & Distribution',
                      'Transport & Logistique',
                      'Médias & Audiovisuel',
                      'Religion & Spiritualité',
                      'Politique & Institutionnel',
                      'Autre',
                    ].map(s => (
                      <option key={s} value={s} style={{ background: '#1e0f3c', color: '#f0e6d3' }}>{s}</option>
                    ))}
                  </select>
                </>
              )}

              <button onClick={handleComplete} disabled={busy} style={{ ...btnGold, opacity: busy ? 0.7 : 1, marginTop: 4 }}>
                {busy ? 'Enregistrement…' : 'Accéder à la plateforme →'}
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              CONNEXION
          ══════════════════════════════════════════════════════════ */}
          {!emailSent && !needsCompletion && mode === 'login' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input style={inp} type="email" placeholder="Adresse email"
                value={email} onChange={e => setEmail(e.target.value)} />
              <input style={inp} type="password" placeholder="Mot de passe"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />

              <button onClick={handleLogin}
                disabled={busy || !email || !password}
                style={{ ...btnGold, opacity: (busy || !email || !password) ? 0.6 : 1, marginTop: 4 }}>
                {busy ? 'Connexion…' : 'Se connecter →'}
              </button>

              <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(240,230,211,0.45)', margin: 0 }}>
                Pas encore de compte ?{' '}
                <button type="button"
                  onClick={() => { setMode('register'); setStep(0); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c9a84c', fontWeight: 600, fontSize: 13 }}>
                  S'inscrire gratuitement
                </button>
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              INSCRIPTION — Étape 0 : choix du rôle
          ══════════════════════════════════════════════════════════ */}
          {!emailSent && !needsCompletion && mode === 'register' && step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(['freelance', 'organisateur'] as UserRole[]).map(r => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    style={{
                      padding: '20px 12px', borderRadius: 14, textAlign: 'center',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: role === r ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${role === r ? '#c9a84c' : 'rgba(201,168,76,0.15)'}`,
                      color: role === r ? '#c9a84c' : 'rgba(240,230,211,0.5)',
                    }}>
                    <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', textTransform: 'capitalize' }}>{r}</p>
                    <p style={{ fontSize: 12, margin: 0, color: role === r ? 'rgba(201,168,76,0.7)' : 'rgba(240,230,211,0.35)' }}>
                      {r === 'freelance' ? 'Je propose mes services' : 'Je recrute des talents'}
                    </p>
                  </button>
                ))}
              </div>

              <button onClick={() => setStep(1)} style={btnGold}>
                Continuer →
              </button>

              <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(240,230,211,0.45)', margin: 0 }}>
                Déjà un compte ?{' '}
                <button type="button" onClick={() => setMode('login')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c9a84c', fontWeight: 600, fontSize: 13 }}>
                  Se connecter
                </button>
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              INSCRIPTION — Étape 1 : informations du compte
          ══════════════════════════════════════════════════════════ */}
          {!emailSent && !needsCompletion && mode === 'register' && step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input style={inp} placeholder="Nom complet *"
                value={fullName} onChange={e => setFullName(e.target.value)} />
              <input style={inp} type="email" placeholder="Adresse email *"
                value={email} onChange={e => setEmail(e.target.value)} />
              <input style={inp} type="password" placeholder="Mot de passe (min. 6 caractères) *"
                value={password} onChange={e => setPassword(e.target.value)} />
              <select
                style={{ ...inp, cursor: 'pointer', background: '#1e0f3c', color: '#f0e6d3' }}
                value={ville} onChange={e => setVille(e.target.value)}>
                {VILLES.map(v => (
                  <option key={v} value={v}
                    style={{ background: '#1e0f3c', color: '#f0e6d3', padding: '8px' }}>
                    {v}
                  </option>
                ))}
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setStep(0)} style={btnOutline}>
                  ← Retour
                </button>
                <button onClick={handleRegister}
                  disabled={busy || !fullName || !email || !password || password.length < 6}
                  style={{ ...btnGold, opacity: (busy || !fullName || !email || !password || password.length < 6) ? 0.6 : 1 }}>
                  {busy ? 'Création…' : "S'inscrire →"}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Lien retour accueil */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(240,230,211,0.3)' }}>
          <button type="button" onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,230,211,0.3)', fontSize: 13 }}>
            ← Retour à l'accueil
          </button>
        </p>

      </div>
    </div>
  );
}
