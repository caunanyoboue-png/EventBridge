-- ═══════════════════════════════════════════════════════════════
-- EventBridge — Fix : les missions n'apparaissent pas sur /feed (invité)
-- À exécuter dans Supabase → SQL Editor → Run.
--
-- CAUSE : le fil (Feed) sélectionne les colonnes `roles` et `nb_days`
-- (tarif par compétence + multi-jours), ajoutées APRÈS la migration
-- d'accès invité. Le rôle `anon` n'a pas le privilège SELECT colonne
-- sur celles-ci → toute la requête missions échoue en
-- « permission denied for table missions » (42501) → aucune mission
-- affichée pour les visiteurs non connectés (les posts, eux, s'affichent).
-- Vérifié en live : requête anon AVEC roles/nb_days = HTTP 401 ;
-- la même SANS ces colonnes = HTTP 200 (7 missions).
--
-- CORRECTIF : accorder ces colonnes (infos publiques de mission) à anon.
-- ═══════════════════════════════════════════════════════════════

GRANT SELECT (roles, days, nb_days) ON public.missions TO anon;
