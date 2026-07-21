// ─────────────────────────────────────────────────────────────────────────────
// Calcul de tarif d'une mission — facturation MIXTE par compétence :
//   • 'hourly'     : rate = tarif/heure   → rate × effectif × heures cumulées (tous les jours)
//   • 'daily'      : rate = prix/jour      → rate × effectif × nombre de jours
//   • 'prestation' : rate = forfait unique → rate × effectif (quel que soit le nb de jours)
//
// Un poste = { skill, count, rate, billing }. Un jour = { date, start, end }.
// ─────────────────────────────────────────────────────────────────────────────
import { formatCFA } from './utils';
import type { MissionRole, MissionDay, BillingMode } from '../types';

export type { MissionRole, MissionDay, BillingMode } from '../types';

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

/** Effectif total (toutes compétences confondues). */
export function totalHeadcount(roles: MissionRole[] | null | undefined): number {
  return (roles || []).reduce((sum, r) => sum + (Number(r.count) || 0), 0);
}

/** Unité d'affichage du prix selon le mode de facturation. */
export function billingUnit(billing?: BillingMode | string): string {
  return billing === 'daily' ? '/jour' : billing === 'prestation' ? '/prestation' : '/h';
}

/** Coût d'un poste (effectif compris) selon son mode de facturation. */
export function roleCost(role: MissionRole, days: MissionDay[] | null | undefined): number {
  const rate = Number(role.rate) || 0;
  const count = Number(role.count) || 0;
  const nbDays = (days || []).length || 1;
  switch (role.billing) {
    case 'prestation': return rate * count;
    case 'daily':      return rate * count * nbDays;
    default:           return rate * count * totalHours(days); // 'hourly'
  }
}

/** Coût d'un poste pour UNE personne (sans l'effectif). */
export function roleTotalPerPerson(role: MissionRole, days: MissionDay[] | null | undefined): number {
  return roleCost({ ...role, count: 1 }, days);
}

/** Total brut de la mission (tous jours, tous postes, tous modes). */
export function missionTotal(roles: MissionRole[] | null | undefined, days: MissionDay[] | null | undefined): number {
  return (roles || []).reduce((sum, r) => sum + roleCost(r, days), 0);
}

/**
 * Tarif « représentatif » stocké dans la colonne legacy `hourly_rate`
 * (affichages/matching/contrat) : le plus bas tarif HORAIRE s'il existe, sinon
 * le plus bas prix parmi les postes.
 */
export function representativeRate(roles: MissionRole[] | null | undefined): number {
  const list = roles || [];
  const hourly = list.filter(r => (r.billing ?? 'hourly') === 'hourly').map(r => Number(r.rate) || 0).filter(r => r > 0);
  const pool = hourly.length ? hourly : list.map(r => Number(r.rate) || 0).filter(r => r > 0);
  return pool.length ? Math.min(...pool) : 0;
}

/**
 * Libellé compact du tarif pour les cartes/listes. L'horaire prime :
 *   au moins un poste horaire → « dès 1 700 FCFA/h »
 *   sinon (jour/prestation homogène) → « dès 50 000 FCFA/jour » / « /prestation »
 *   sinon (modes mélangés)   → « dès 50 000 FCFA »
 */
export function formatRateLabel(roles: MissionRole[] | null | undefined, fallback: number): string {
  const list = roles || [];
  if (!list.length) return `${formatCFA(fallback)}/h`;
  const hourly = list.filter(r => (r.billing ?? 'hourly') === 'hourly');
  const pool = hourly.length ? hourly : list;
  const rates = pool.map(r => Number(r.rate) || 0).filter(r => r > 0);
  if (!rates.length) return `${formatCFA(fallback)}/h`;
  const min = Math.min(...rates), max = Math.max(...rates);
  const modes = new Set(pool.map(r => r.billing ?? 'hourly'));
  const unit = modes.size === 1 ? billingUnit([...modes][0]) : '';
  return `${min === max ? '' : 'dès '}${formatCFA(min)}${unit}`;
}
