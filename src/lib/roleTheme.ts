// Couleurs par rôle (« côté ») — partagées entre le menu latéral et les en-têtes de page.
// Invité (aucun rôle) → doré par défaut.
export interface RolePalette { active: string; inactive: string; bg: string; glow: string; }

export const ROLE_PAL: Record<string, RolePalette> = {
  freelance:    { active: '#e8c97a', inactive: 'rgba(232,201,122,0.5)', bg: 'rgba(212,175,55,0.16)', glow: 'rgba(212,175,55,0.14)' },
  organisateur: { active: '#7cb3ff', inactive: 'rgba(124,179,255,0.5)', bg: 'rgba(96,165,250,0.16)', glow: 'rgba(96,165,250,0.14)' },
  admin:        { active: '#4ade80', inactive: 'rgba(74,222,128,0.5)',  bg: 'rgba(52,211,153,0.16)', glow: 'rgba(52,211,153,0.14)' },
};

export function rolePal(role?: string | null): RolePalette {
  return (role && ROLE_PAL[role]) || ROLE_PAL.freelance;
}

/** Couleur d'accent du côté (invité → doré). */
export function roleColor(role?: string | null): string {
  return rolePal(role).active;
}
