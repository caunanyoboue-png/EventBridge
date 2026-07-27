-- ============================================================================
-- EventBridge — Accès INVITÉ (visiteurs non connectés) en LECTURE SEULE
--
-- Le rôle "anon" (visiteur sans compte) peut lire :
--   • le fil : publications (posts) + commentaires (post_comments)
--   • les missions OUVERTES
--   • les profils (freelances / organisateurs)
-- MAIS sans les colonnes sensibles : adresse exacte, GPS, téléphone, email, KYC.
--
-- Le rôle "authenticated" (utilisateur connecté) n'est PAS modifié.
-- À exécuter dans l'éditeur SQL Supabase.
-- ============================================================================

-- ── POSTS (publications) : lecture publique complète ─────────────────────────
drop policy if exists posts_anon_select on public.posts;
create policy posts_anon_select on public.posts
  for select to anon using (true);
grant select on public.posts to anon;

-- ── POST_COMMENTS (commentaires) : lecture publique ──────────────────────────
drop policy if exists post_comments_anon_select on public.post_comments;
create policy post_comments_anon_select on public.post_comments
  for select to anon using (true);
grant select on public.post_comments to anon;

-- ── REVIEWS (avis) : lecture publique (affichés sur les profils) ─────────────
drop policy if exists reviews_anon_select on public.reviews;
create policy reviews_anon_select on public.reviews
  for select to anon using (true);
grant select on public.reviews to anon;

-- ── MISSIONS : seules les missions OUVERTES, colonnes NON sensibles ──────────
drop policy if exists missions_anon_select on public.missions;
create policy missions_anon_select on public.missions
  for select to anon using (status = 'open');

-- on retire tout accès colonne à anon, puis on n'autorise que les colonnes sûres
revoke select on public.missions from anon;
grant select (
  id, organisateur_id, title, description, service_type, skills_required,
  roles, days, nb_days,
  ville, event_date, start_time, end_time, hourly_rate, slots_total,
  slots_filled, is_urgent, status, venue_photo_url, created_at
) on public.missions to anon;
-- Colonnes VOLONTAIREMENT exclues pour l'invité : location, latitude, longitude

-- ── PROFILES : colonnes d'affichage uniquement ───────────────────────────────
drop policy if exists profiles_anon_select on public.profiles;
create policy profiles_anon_select on public.profiles
  for select to anon using (status = 'active' or status is null);

revoke select on public.profiles from anon;
grant select (
  id, full_name, avatar_url, role, company_name, company_sector, ville, quartier,
  bio, skills, hourly_rate, avg_rating, total_reviews, total_missions,
  experience_years, is_certified, certification_level, is_available, banner_url
) on public.profiles to anon;
-- Colonnes VOLONTAIREMENT exclues pour l'invité :
--   email, phone, latitude, longitude, kyc_document_path, kyc_document_back_path,
--   kyc_status, kyc_rejection_reason, is_super_admin, ...

-- ============================================================================
-- Note : si une colonne listée ci-dessus n'existe pas dans ta base, Postgres
-- renverra « column ... does not exist » — retire-la simplement de la liste.
-- ============================================================================
