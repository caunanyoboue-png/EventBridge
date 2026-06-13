// Logo EventBridge — l'image d'origine (pont doré sur violet), sublimée :
// écrin aux coins arrondis, fin liseré doré, halo lumineux, animation
// d'entrée + reflet doré et léger soulèvement au survol.
import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';

const LOGO_SRC = '/logo.png.jpeg';

function imgStyle(radius: number): CSSProperties {
  return {
    display: 'block',
    height: '100%',
    width: 'auto',
    borderRadius: radius,
    border: '1px solid rgba(201,168,76,0.22)',
    boxShadow: '0 6px 20px rgba(15,10,30,0.45), 0 0 16px rgba(201,168,76,0.10)',
  };
}

interface CommonProps {
  animated?: boolean;
  className?: string;
}

interface LogoProps extends CommonProps {
  /** Hauteur du logo en pixels. */
  height?: number;
  /** Conservé pour compatibilité — l'image inclut déjà le wordmark. */
  variant?: 'horizontal' | 'vertical' | 'mark';
  withTagline?: boolean;
}

/** L'emblème seul (alias de Logo, conservé pour compatibilité). */
export function LogoMark({ size = 48, animated = false, className }: { size?: number } & CommonProps) {
  return <Logo height={size} animated={animated} className={className} variant="mark" />;
}

export default function Logo({ height = 40, animated = false, className }: LogoProps) {
  const reduceMotion = useReducedMotion();
  const radius = Math.max(6, Math.round(height * 0.16));

  const img = <img src={LOGO_SRC} alt="EventBridge" style={imgStyle(radius)} draggable={false} />;

  // Version animée : apparition en fondu + reflet doré qui balaie, soulèvement au survol
  if (animated && !reduceMotion) {
    return (
      <motion.span
        className={className}
        style={{
          height, display: 'inline-flex', alignItems: 'center',
          position: 'relative', overflow: 'hidden', borderRadius: radius,
        }}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -2 }}
      >
        {img}
        <motion.span
          aria-hidden
          style={{
            position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
            background: 'linear-gradient(105deg, transparent 35%, rgba(245,230,196,0.38) 50%, transparent 65%)',
          }}
          initial={{ x: '-130%' }}
          animate={{ x: '130%' }}
          transition={{ duration: 1.15, delay: 0.45, ease: [0.65, 0, 0.35, 1] }}
        />
      </motion.span>
    );
  }

  // Version statique : halo doré doux au survol
  return (
    <span
      className={className}
      style={{
        height, display: 'inline-flex', alignItems: 'center',
        transition: 'filter 0.3s ease, transform 0.3s ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.filter = 'drop-shadow(0 0 11px rgba(201,168,76,0.4))';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.filter = 'none';
        el.style.transform = 'none';
      }}
    >
      {img}
    </span>
  );
}
