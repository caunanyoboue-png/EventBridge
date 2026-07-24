-- ============================================================================
-- FIX RLS : réautoriser l'insertion de notifications côté client
-- ----------------------------------------------------------------------------
-- Problème : `supabase_migration_notifications.sql` supprime TOUTES les policies
-- de `notifications` puis n'en recrée que SELECT (own) et UPDATE (own).
-- => plus aucune policy INSERT => avec RLS activée, tout INSERT direct est REFUSÉ.
--
-- Conséquence : le **S.O.S Brigade** (insert direct de notifications aux
-- freelances ciblés), les **candidatures**, les **avis**, les réponses S.O.S…
-- échouaient SILENCIEUSEMENT (l'app n'inspecte pas l'erreur) → les freelances
-- ne recevaient jamais la notification, alors que le toast disait « X notifiés ».
-- (Les missions passaient, elles, par la RPC SECURITY DEFINER notify_matching_freelances.)
--
-- Correctif : une policy INSERT permettant à un utilisateur authentifié de créer
-- une notification (y compris pour un autre utilisateur — c'est le design d'origine
-- « Système peut créer des notifications » retiré par erreur).
--
-- À exécuter dans l'éditeur SQL Supabase (idempotent).
-- ============================================================================

DROP POLICY IF EXISTS "authenticated can insert notifications" ON public.notifications;
CREATE POLICY "authenticated can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
