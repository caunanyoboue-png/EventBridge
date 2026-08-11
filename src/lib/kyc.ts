import { type Profile } from '../types';

/**
 * Dossier d'identité complet : recto + verso + selfie tenant la pièce.
 * (Certains anciens profils ont un kyc_status « verified » hérité sans aucun
 * document : on exige donc la présence réelle des fichiers.)
 */
export function hasIdentityDocs(p?: Profile | null): boolean {
  return !!p?.kyc_document_path && !!p?.kyc_document_back_path && !!p?.kyc_selfie_path;
}

/** Identité vérifiée par un administrateur, dossier complet à l'appui. */
export function isIdentityVerified(p?: Profile | null): boolean {
  return p?.kyc_status === 'verified' && hasIdentityDocs(p);
}

/**
 * Un organisateur ne peut publier une mission ou lancer un S.O.S Brigade
 * qu'une fois son identité vérifiée. Même règle côté base (trigger
 * require_verified_organizer) : l'interface ne fait que l'annoncer tôt.
 */
export function canPublish(p?: Profile | null): boolean {
  if (!p) return false;
  if (p.role === 'admin') return true;
  return isIdentityVerified(p);
}

/** Profil réduit aux champs de certification (annuaire, matching, S.O.S). */
type CertLike = {
  certification_level?: string | null;
  certification_expires_at?: string | null;
  avg_rating?: number | null;
};

/**
 * Rang de certification : 2 = Bleu actif, 1 = Gris actif, 0 = gratuit ou expiré.
 * Miroir exact de la fonction SQL `cert_rank` (une échéance nulle = certification
 * accordée à la main par l'admin, sans expiration).
 */
export function certRank(p?: CertLike | null): number {
  const lvl = p?.certification_level;
  if (!lvl || lvl === 'none') return 0;
  const exp = p?.certification_expires_at;
  if (exp && new Date(exp) <= new Date()) return 0;
  return lvl === 'blue' ? 2 : lvl === 'grey' ? 1 : 0;
}

/**
 * Classement mis en avant par la certification : Bleu tout en haut, puis Gris,
 * puis les profils gratuits — et, à rang égal, la meilleure note.
 * C'est ce qui rend concrètes les promesses « remontée dans les recherches »
 * (Gris) et « visibilité maximale » (Bleu).
 */
export function byCertificationThenRating<T extends CertLike>(a: T, b: T): number {
  const d = certRank(b) - certRank(a);
  if (d !== 0) return d;
  return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
}
