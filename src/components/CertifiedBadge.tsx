import { BadgeCheck } from 'lucide-react';
import { type CertificationLevel } from '../types';

// Badge de certification : gris (standard) ou bleu (premium).
// Rien si non certifié.
export default function CertifiedBadge({ level, size = 'sm' }: { level?: CertificationLevel | null; size?: 'sm' | 'md' }) {
  if (!level || level === 'none') return null;
  const blue = level === 'blue';
  const color = blue ? '#3b82f6' : '#9ca3af';
  const label = blue ? 'Certifié Pro' : 'Certifié';
  const fs = size === 'md' ? 12 : 10.5;
  const ic = size === 'md' ? 13 : 11;
  return (
    <span
      title={blue ? 'Certifié Premium (identité + documents)' : 'Certifié (identité vérifiée)'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        fontSize: fs, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap',
        padding: size === 'md' ? '4px 10px' : '3px 8px', borderRadius: 999,
        background: `${color}1f`, color, border: `1px solid ${color}55`,
      }}
    >
      <BadgeCheck size={ic} /> {label}
    </span>
  );
}
