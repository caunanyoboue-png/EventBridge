// ─────────────────────────────────────────────────────────────────────────────
// Calcul de tarif d'une mission : tarif horaire PAR COMPÉTENCE + planning multi-jours.
//
//   Total brut = (heures cumulées de tous les jours) × Σ (tarif_poste × effectif_poste)
//   càd, jour par jour : Σ_jours [ heures_du_jour × Σ_postes(tarif × effectif) ]
//
// Un poste = { skill, count, rate }. Un jour = { date, start, end }.
// Chaque poste est présent tous les jours de l'événement.
// ─────────────────────────────────────────────────────────────────────────────
import { formatCFA } from './utils';
import type { MissionRole, MissionDay } from '../types';

export type { MissionRole, MissionDay } from '../types';

/** Heures d'une journée (gère les créneaux qui passent minuit). */
export function dayHours(d: { start?: string; end?: string } | null | undefined): number {
  if (!d?.start || !d?.end) return 0;
  const s = new Date(`2000-01-01T${d.start}`).getTime();
  let e = new Date(`2000-01-01T${d.end}`).getTime();
  if (e <= s) e += 24 * 3600 * 1000; // fin après minuit
  return (e - s) / 3600000;
}

/** Heures cumulées sur tous les jours de l'événement. */
export function totalHours(days: MissionDay[] | null | undefined): number {
  return (days || []).reduce((sum, d) => sum + dayHours(d), 0);
}

/** Coût horaire cumulé de tous les postes = Σ (tarif × effectif). */
export function rolesHourlyCost(roles: MissionRole[] | null | undefined): number {
  return (roles || []).reduce((sum, r) => sum + (Number(r.rate) || 0) * (Number(r.count) || 0), 0);
}

/** Effectif total (toutes compétences confondues). */
export function totalHeadcount(roles: MissionRole[] | null | undefined): number {
  return (roles || []).reduce((sum, r) => sum + (Number(r.count) || 0), 0);
}

/** Total brut de la mission (tous jours, tous postes). */
export function missionTotal(roles: MissionRole[] | null | undefined, days: MissionDay[] | null | undefined): number {
  return totalHours(days) * rolesHourlyCost(roles);
}

/** Coût d'un poste pour UNE personne sur tout l'événement = tarif × heures cumulées. */
export function roleTotalPerPerson(rate: number, days: MissionDay[] | null | undefined): number {
  return (Number(rate) || 0) * totalHours(days);
}

/** Fourchette de tarif horaire (min/max) parmi les postes. */
export function rateRange(roles: MissionRole[] | null | undefined): { min: number; max: number } {
  const rates = (roles || []).map(r => Number(r.rate) || 0).filter(r => r > 0);
  if (rates.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...rates), max: Math.max(...rates) };
}

/**
 * Libellé compact du tarif pour les cartes/listes :
 *   un seul tarif        → « 2 500 FCFA/h »
 *   plusieurs tarifs     → « dès 1 700 FCFA/h »
 *   pas de postes (legacy) → « <fallback> FCFA/h »
 */
export function formatRateLabel(roles: MissionRole[] | null | undefined, fallback: number): string {
  const { min, max } = rateRange(roles);
  if (!min && !max) return `${formatCFA(fallback)}/h`;
  return min === max ? `${formatCFA(min)}/h` : `dès ${formatCFA(min)}/h`;
}
