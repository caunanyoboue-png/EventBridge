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
