import { BadgeCheck } from 'lucide-react';
import { type CertificationLevel } from '../types';

// Badge de certification — ICÔNE SEULE, juste après le nom.
//   gris  = certifié standard (pièce d'identité)
//   bleu  = certifié premium (pièce + documents)
// Robuste : s'affiche aussi si is_certified=true sans niveau précis (→ gris).
export default function CertifiedBadge({
  level, certified, size = 'sm',
}: { level?: CertificationLevel | null; certified?: boolean; size?: 'sm' | 'md' }) {
  const eff: CertificationLevel = level && level !== 'none' ? level : certified ? 'grey' : 'none';
  if (eff === 'none') return null;

  const blue = eff === 'blue';
  const color = blue ? '#3b82f6' : '#9ca3af';
  const px = size === 'md' ? 20 : 16;

  return (
    <BadgeCheck
      size={px}
      color={color}
      aria-label={blue ? 'Certifié Premium' : 'Certifié'}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    >
      <title>{blue ? 'Certifié Premium' : 'Certifié'}</title>
    </BadgeCheck>
  );
}
