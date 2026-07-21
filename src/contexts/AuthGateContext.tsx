// Porte d'authentification pour le mode invité.
// requireAuth() : si connecté → true ; sinon ouvre une modale « Inscrivez-vous »
// et mémorise la page courante pour y revenir après inscription (clé eb_return_to).
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, LogIn, X } from 'lucide-react';
import { useAuth } from './AuthContext';

interface AuthGateValue {
  /** Renvoie true si l'utilisateur est connecté ; sinon ouvre la modale et renvoie false. */
  requireAuth: (intent?: string) => boolean;
}

const Ctx = createContext<AuthGateValue | undefined>(undefined);
export const RETURN_KEY = 'eb_return_to';

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<string | undefined>(undefined);

  function requireAuth(i?: string): boolean {
    if (user) return true;
    setIntent(i);
    setOpen(true);
    return false;
  }

  function go() {
    try { localStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search); } catch { /* ignore */ }
    setOpen(false);
    navigate('/onboarding');
  }

  return (
    <Ctx.Provider value={{ requireAuth }}>
      {children}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 16, background: 'rgba(10,4,22,0.82)', backdropFilter: 'blur(6px)' }}>
          <div onClick={e => e.stopPropagation()} className="card-glass"
            style={{ width: '100%', maxWidth: 420, padding: '26px 24px', position: 'relative', textAlign: 'center' }}>
            <button onClick={() => setOpen(false)} aria-label="Fermer"
              style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none',
                color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex' }}>
              <X size={18} />
            </button>

            <div style={{ width: 52, height: 52, borderRadius: 14, margin: '4px auto 14px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.06))',
              border: '1px solid rgba(201,168,76,0.3)' }}>
              <UserPlus size={24} color="var(--color-gold-primary)" />
            </div>

            <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Créez un compte pour continuer
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '8px 0 20px' }}>
              {intent
                ? <>Pour <b style={{ color: 'var(--color-gold-light)' }}>{intent}</b>, connectez-vous ou inscrivez-vous — c'est gratuit et rapide.</>
                : <>Connectez-vous ou inscrivez-vous pour interagir — c'est gratuit et rapide.</>}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={go}
                className="btn-gold w-full py-3 rounded-xl font-bold text-[#261642] inline-flex items-center justify-center gap-2">
                <UserPlus size={16} /> S'inscrire
              </button>
              <button onClick={go}
                className="btn-outline-gold w-full py-3 rounded-xl font-medium inline-flex items-center justify-center gap-2">
                <LogIn size={15} /> J'ai déjà un compte
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuthGate doit être utilisé dans AuthGateProvider');
  return ctx;
}
