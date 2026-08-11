import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/** Bouton de bascule clair/sombre. `compact` = icône seule (en-têtes, mobile). */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
        background: 'transparent', border: '1px solid var(--color-border-hover)',
        color: 'var(--color-gold-primary)',
        // Bouton parfaitement rond en mode compact (en-tête mobile), pilule sinon.
        borderRadius: 999, ...(compact ? { width: 38, height: 38, padding: 0 } : { padding: '7px 12px' }),
        fontSize: 13, fontWeight: 600,
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {!compact && <span>{dark ? 'Clair' : 'Sombre'}</span>}
    </button>
  );
}
