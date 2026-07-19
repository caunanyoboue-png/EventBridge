import { type ReactNode } from 'react';

export interface IconProps { size?: number; color?: string; className?: string; }

// Jeu d'icônes « doodle » : trait dessiné à la main, contours arrondis.
// Couleur via la prop `color` (sinon héritée du parent via currentColor).
export function Dood({ children, size = 18, color, className }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={color ? { color } : undefined}>{children}</svg>
  );
}

export const IcoDashboard = (p: IconProps) => <Dood {...p}>
  <rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2"/>
  <rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2"/>
  <rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2"/>
  <rect x="13.3" y="13.3" width="7.2" height="7.2" rx="2.2"/>
</Dood>;
export const IcoMissions = (p: IconProps) => <Dood {...p}>
  <rect x="3" y="7.5" width="18" height="12.5" rx="3"/>
  <path d="M8.5 7.5V6.2c0-1 .8-1.9 1.9-1.9h3.2c1 0 1.9.8 1.9 1.9v1.3"/>
  <path d="M3 12.5c2.9 1.4 5.9 2.1 9 2.1s6.1-.7 9-2.1"/>
</Dood>;
export const IcoUsers = (p: IconProps) => <Dood {...p}>
  <circle cx="9" cy="8" r="3.2"/>
  <path d="M3.5 19c.4-3.1 2.8-5 5.5-5s5.1 1.9 5.5 5"/>
  <path d="M16 5.4a3 3 0 0 1 .3 5.7"/>
  <path d="M17.2 14.2c1.9.6 3.1 2.2 3.3 4.6"/>
</Dood>;
export const IcoMessages = (p: IconProps) => <Dood {...p}>
  <path d="M20.5 12c0 3.7-3.8 6.6-8.5 6.6-1.1 0-2.2-.2-3.2-.5L4 20l1.4-3.6C4.5 15.3 4 13.7 4 12c0-3.7 3.8-6.6 8.5-6.6S20.5 8.3 20.5 12Z"/>
  <circle cx="9" cy="12" r=".85" fill="currentColor" stroke="none"/>
  <circle cx="12.5" cy="12" r=".85" fill="currentColor" stroke="none"/>
  <circle cx="16" cy="12" r=".85" fill="currentColor" stroke="none"/>
</Dood>;
export const IcoClipboard = (p: IconProps) => <Dood {...p}>
  <rect x="4.5" y="4.2" width="15" height="16.8" rx="3"/>
  <path d="M9 3.2h6c.7 0 1.2.6 1.2 1.2v1.1c0 .7-.5 1.2-1.2 1.2H9c-.7 0-1.2-.5-1.2-1.2V4.4c0-.6.5-1.2 1.2-1.2Z"/>
  <path d="M8.6 13.2l2.4 2.4 4.4-4.9"/>
</Dood>;
export const IcoDoc = (p: IconProps) => <Dood {...p}>
  <path d="M6.2 3.5h6.9c.3 0 .6.1.8.4l3.7 3.9c.2.2.3.5.3.8V19.6c0 1-.8 1.9-1.9 1.9H6.2c-1 0-1.9-.8-1.9-1.9V5.4c0-1 .8-1.9 1.9-1.9Z"/>
  <path d="M13 3.7V7c0 .8.6 1.4 1.4 1.4h3.2"/>
  <path d="M8.7 12.6h6.6M8.7 15.9h6.6M8.7 9.3h3"/>
</Dood>;
export const IcoPerson = (p: IconProps) => <Dood {...p}>
  <circle cx="12" cy="8" r="3.6"/>
  <path d="M5.2 20c.4-3.8 3.3-6.2 6.8-6.2s6.4 2.4 6.8 6.2"/>
</Dood>;
export const IcoDashAdmin = (p: IconProps) => <Dood {...p}>
  <path d="M4 20.5h16"/>
  <rect x="5.8" y="12" width="3.4" height="8.5" rx="1.3"/>
  <rect x="10.3" y="8" width="3.4" height="12.5" rx="1.3"/>
  <rect x="14.8" y="4.5" width="3.4" height="16" rx="1.3"/>
</Dood>;
export const IcoShield = (p: IconProps) => <Dood {...p}>
  <path d="M12 3.2l7.2 2.6v5.4c0 4.6-3.1 8.5-7.2 9.6-4.1-1.1-7.2-5-7.2-9.6V5.8L12 3.2Z"/>
  <path d="M8.8 12.2l2.2 2.2 4.2-4.6"/>
</Dood>;
export const IcoStar = (p: IconProps) => <Dood {...p}>
  <path d="M12 3.4l2.5 5.1 5.6.8-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6L3.9 9.3l5.6-.8L12 3.4Z"/>
</Dood>;
export const IcoGear = (p: IconProps) => <Dood {...p}>
  <circle cx="12" cy="12" r="3.3"/>
  <path d="M12 2.6v3.1M12 18.3v3.1M21.4 12h-3.1M5.7 12H2.6M18.7 5.3l-2.2 2.2M7.5 16.5l-2.2 2.2M18.7 18.7l-2.2-2.2M7.5 7.5 5.3 5.3"/>
</Dood>;
export const IcoWallet = (p: IconProps) => <Dood {...p}>
  <path d="M4 8.3C4 6.9 5.1 6 6.4 6H16c1.1 0 2 .9 2 2v.3"/>
  <rect x="3.5" y="8" width="17" height="11.5" rx="3"/>
  <path d="M20.5 12.6H16.2c-1.1 0-2 .8-2 1.9s.9 1.9 2 1.9h4.3"/>
  <circle cx="16.4" cy="14.5" r=".75" fill="currentColor" stroke="none"/>
</Dood>;
export const IcoLogout = (p: IconProps) => <Dood {...p}>
  <path d="M14 5.5H7.2c-1 0-1.7.8-1.7 1.7v9.6c0 1 .8 1.7 1.7 1.7H14"/>
  <path d="M18.8 12H10"/>
  <path d="M15.6 8.4 19.2 12l-3.6 3.6"/>
</Dood>;
export const IcoFeed = (p: IconProps) => <Dood {...p}>
  <path d="M4 5.5C4 4.7 4.7 4 5.5 4h10c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H5.5C4.7 20 4 19.3 4 18.5V5.5Z"/>
  <path d="M17 7.5h1.5C19.3 7.5 20 8.2 20 9v8c0 .8-.7 1.5-1.5 1.5"/>
  <path d="M7 8h6M7 11.5h6M7 15h4"/>
</Dood>;
export const IcoSOS = (p: IconProps) => <Dood {...p}>
  <circle cx="12" cy="12" r="8.6"/>
  <path d="M12 7.3v5.2"/>
  <circle cx="12" cy="16" r=".85" fill="currentColor" stroke="none"/>
</Dood>;
export const IcoPlus = (p: IconProps) => <Dood {...p}>
  <path d="M12 5.5v13M5.5 12h13"/>
</Dood>;
export const IcoGrid = (p: IconProps) => <Dood {...p}>
  <circle cx="7" cy="7" r="1.7" fill="currentColor" stroke="none"/>
  <circle cx="17" cy="7" r="1.7" fill="currentColor" stroke="none"/>
  <circle cx="7" cy="17" r="1.7" fill="currentColor" stroke="none"/>
  <circle cx="17" cy="17" r="1.7" fill="currentColor" stroke="none"/>
</Dood>;
