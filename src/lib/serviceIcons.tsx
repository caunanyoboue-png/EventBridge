// Icônes de prestations — style « doodle » (trait dessiné à la main), remplaçant les icônes lucide.
import { type ReactNode } from 'react';

const SERVICE_PATHS: Record<string, ReactNode> = {
  'Service en salle': (<>
    <path d="M6 3v4a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3"/><path d="M8 3v4"/><path d="M8 9v12"/>
    <path d="M16 3c-1.6 0-2.5 3.5-2.5 6.5 0 1.4 1.1 2 2.5 2"/><path d="M16 3v18"/>
  </>),
  'Bar / Barman': (<>
    <path d="M7.5 3.5h9l-1.2 6.5a3.3 3.3 0 0 1-6.6 0L7.5 3.5Z"/><path d="M12 13.5V20M8.5 20.5h7"/>
  </>),
  'Cuisine gastronomique': (<>
    <path d="M7 21h10l-.5-7c2 .2 3.5-1.3 3.5-3.2 0-1.9-1.6-3.3-3.5-3.1C16 4.5 14.2 3.2 12 3.2S8 4.5 7.5 7.7C5.6 7.5 4 8.9 4 10.8c0 1.9 1.5 3.4 3.5 3.2L7 21Z"/><path d="M7 17h10"/>
  </>),
  'Hôtesse accueil': (<>
    <path d="M4 18h16"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 6V4.2"/><circle cx="12" cy="3.2" r="1.1"/><path d="M10.3 6h3.4"/>
  </>),
  'Animation': (<>
    <path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>
  </>),
  'MC / Présentateur': (<>
    <path d="M4 9.5v5l10 3.5V6L4 9.5Z"/><path d="M14 6c2 0 3.5 2.7 3.5 6s-1.5 6-3.5 6"/><path d="M6.5 15.2V19a1.4 1.4 0 0 0 2.8 0v-2.7"/>
  </>),
  'Son & Lumière': (<>
    <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3Z"/><path d="M9 17h6M10 20h4"/>
  </>),
  'Photographie': (<>
    <rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8.5 7l1.3-2.2h4.4L15.5 7"/><circle cx="12" cy="13.5" r="3.4"/>
  </>),
  'Vidéographie': (<>
    <rect x="3" y="7" width="12" height="10" rx="2.5"/><path d="M15 11l5.5-3v8L15 13"/><circle cx="7" cy="12" r="1" fill="currentColor" stroke="none"/>
  </>),
  'Sécurité': (<>
    <path d="M12 3.2l7.2 2.6v5.4c0 4.6-3.1 8.5-7.2 9.6-4.1-1.1-7.2-5-7.2-9.6V5.8L12 3.2Z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.6"/>
  </>),
  'Chauffeur': (<>
    <path d="M4 15l1.4-4.2A2 2 0 0 1 7.3 9.4h9.4a2 2 0 0 1 1.9 1.4L20 15"/><path d="M3.5 15h17v3.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V18H7v.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V15Z"/><circle cx="7.5" cy="16.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="16.5" r="1.1" fill="currentColor" stroke="none"/>
  </>),
  'Manutention': (<>
    <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"/><path d="M4 7l8 4 8-4"/><path d="M12 11v10"/>
  </>),
  'Décoration': (<>
    <path d="M12 3.5c-4.7 0-8.5 3.4-8.5 7.7 0 2.6 2 4.3 4.3 4.3H10a1.7 1.7 0 0 1 1.4 2.6c-.4.6-.5 1.1-.2 1.6.3.5.9.8 1.6.8 4.2 0 7.7-3.7 7.7-8.4 0-4.9-3.9-8.6-8.5-8.6Z"/><circle cx="7.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="11" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="7.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="11.5" r="1.1" fill="currentColor" stroke="none"/>
  </>),
};

const DEFAULT_PATH: ReactNode = (<>
  <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z"/><path d="M18 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/>
</>);

function serviceInner(type?: string | null): ReactNode {
  return (type && SERVICE_PATHS[type]) || DEFAULT_PATH;
}

interface ServiceIconProps {
  type?: string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

/** Icône de prestation, style doodle. Par défaut dorée. */
export function ServiceIcon({ type, size = 22, color = '#d4af37', strokeWidth = 1.6, className }: ServiceIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ color }}>
      {serviceInner(type)}
    </svg>
  );
}

/** Icône de prestation dans une pastille dorée arrondie (pour les cartes). */
export function ServiceIconBadge({ type, size = 44, iconSize }: { type?: string | null; size?: number; iconSize?: number }) {
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: size * 0.28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(201,168,76,0.16), rgba(201,168,76,0.06))',
        border: '1px solid rgba(201,168,76,0.28)',
      }}
    >
      <ServiceIcon type={type} size={iconSize ?? Math.round(size * 0.5)} />
    </div>
  );
}
