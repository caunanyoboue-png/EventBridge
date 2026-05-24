-- ============================================================
--  EventBridge — Schéma Supabase complet
--  À exécuter dans : Dashboard Supabase > SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. TABLE : profiles
-- ============================================================
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  full_name      text not null default '',
  phone          text,
  role           text not null default 'freelance' check (role in ('freelance','organisateur','admin')),
  status         text not null default 'active' check (status in ('active','pending','suspended','banned')),
  avatar_url     text,
  bio            text,
  ville          text default 'Abidjan - Cocody',
  quartier       text,
  skills         text[] default '{}',
  hourly_rate    numeric default 2500,
  experience_years integer default 0,
  is_certified   boolean default false,
  is_available   boolean default true,
  avg_rating     numeric(3,2) default 0,
  total_missions integer default 0,
  -- Organisateur
  company_name   text,
  company_sector text,
  rccm           text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- 2. TABLE : missions
-- ============================================================
create table if not exists public.missions (
  id               uuid primary key default uuid_generate_v4(),
  organisateur_id  uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  description      text,
  service_type     text not null,
  event_date       date,
  start_time       text,
  end_time         text,
  location         text,
  ville            text default 'Abidjan - Cocody',
  dress_code       text,
  slots_total      integer not null default 1,
  slots_filled     integer not null default 0,
  hourly_rate      numeric not null default 3000,
  duration_hours   numeric default 0,
  total_amount     numeric default 0,
  commission_rate  numeric default 0.10,
  skills_required  text[] default '{}',
  is_urgent        boolean default false,
  status           text not null default 'open' check (status in ('draft','open','in_progress','completed','cancelled','disputed')),
  idempotency_key  text unique,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ============================================================
-- 3. TABLE : applications
-- ============================================================
create table if not exists public.applications (
  id           uuid primary key default uuid_generate_v4(),
  mission_id   uuid not null references public.missions(id) on delete cascade,
  freelance_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn','completed')),
  cover_letter text,
  proposed_rate numeric,
  applied_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(mission_id, freelance_id)
);

-- ============================================================
-- 4. TABLE : conversations
-- ============================================================
create table if not exists public.conversations (
  id              uuid primary key default uuid_generate_v4(),
  participant_1   uuid not null references public.profiles(id) on delete cascade,
  participant_2   uuid not null references public.profiles(id) on delete cascade,
  last_message    text,
  last_message_at timestamptz default now(),
  created_at      timestamptz default now(),
  unique(participant_1, participant_2)
);

-- ============================================================
-- 5. TABLE : messages
-- ============================================================
create table if not exists public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null,
  is_read         boolean default false,
  created_at      timestamptz default now()
);

-- ============================================================
-- 6. TABLE : reviews
-- ============================================================
create table if not exists public.reviews (
  id          uuid primary key default uuid_generate_v4(),
  mission_id  uuid not null references public.missions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_id uuid not null references public.profiles(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now(),
  unique(mission_id, reviewer_id, reviewed_id)
);

-- ============================================================
-- 7. TABLE : disputes
-- ============================================================
create table if not exists public.disputes (
  id          uuid primary key default uuid_generate_v4(),
  mission_id  uuid not null references public.missions(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  description text,
  status      text not null default 'open' check (status in ('open','investigating','resolved','closed')),
  resolution  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- 8. TABLE : sos_sessions
-- ============================================================
create table if not exists public.sos_sessions (
  id               uuid primary key default uuid_generate_v4(),
  organisateur_id  uuid not null references public.profiles(id) on delete cascade,
  service_type     text not null,
  location         text not null,
  slots_needed     integer not null default 1,
  slots_confirmed  integer not null default 0,
  radius_km        integer not null default 10,
  notified_count   integer not null default 0,
  message          text,
  status           text not null default 'active' check (status in ('active','completed','expired','cancelled')),
  expires_at       timestamptz not null,
  created_at       timestamptz default now()
);

-- ============================================================
-- 9. TABLE : notifications
-- ============================================================
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  data       jsonb default '{}',
  is_read    boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES (performances)
-- ============================================================
create index if not exists idx_missions_organisateur    on public.missions(organisateur_id);
create index if not exists idx_missions_status          on public.missions(status);
create index if not exists idx_missions_service_type    on public.missions(service_type);
create index if not exists idx_missions_event_date      on public.missions(event_date);
create index if not exists idx_applications_mission     on public.applications(mission_id);
create index if not exists idx_applications_freelance   on public.applications(freelance_id);
create index if not exists idx_messages_conversation    on public.messages(conversation_id);
create index if not exists idx_notifications_user       on public.notifications(user_id);
create index if not exists idx_notifications_unread     on public.notifications(user_id, is_read);
create index if not exists idx_profiles_role            on public.profiles(role);
create index if not exists idx_profiles_status          on public.profiles(status);

-- ============================================================
-- TRIGGER : updated_at automatique
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trg_missions_updated_at
  before update on public.missions
  for each row execute function public.handle_updated_at();

create trigger trg_applications_updated_at
  before update on public.applications
  for each row execute function public.handle_updated_at();

create trigger trg_disputes_updated_at
  before update on public.disputes
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TRIGGER : créer le profil automatiquement à l'inscription
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'freelance'),
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TRIGGER : mettre à jour avg_rating après chaque review
-- ============================================================
create or replace function public.update_avg_rating()
returns trigger language plpgsql as $$
begin
  update public.profiles
  set avg_rating = (
    select round(avg(rating)::numeric, 2)
    from public.reviews
    where reviewed_id = new.reviewed_id
  ),
  total_missions = (
    select count(*)
    from public.reviews
    where reviewed_id = new.reviewed_id
  )
  where id = new.reviewed_id;
  return new;
end;
$$;

create trigger trg_reviews_update_rating
  after insert or update on public.reviews
  for each row execute function public.update_avg_rating();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.missions      enable row level security;
alter table public.applications  enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.reviews       enable row level security;
alter table public.disputes      enable row level security;
alter table public.sos_sessions  enable row level security;
alter table public.notifications enable row level security;

-- PROFILES
create policy "Profils visibles par tous les connectés"
  on public.profiles for select to authenticated using (true);

create policy "Chacun modifie son propre profil"
  on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Admin peut tout modifier"
  on public.profiles for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- MISSIONS
create policy "Missions visibles par tous les connectés"
  on public.missions for select to authenticated using (true);

create policy "Organisateur crée ses missions"
  on public.missions for insert to authenticated
  with check (organisateur_id = auth.uid());

create policy "Organisateur modifie ses missions"
  on public.missions for update to authenticated
  using (organisateur_id = auth.uid());

create policy "Admin peut tout sur les missions"
  on public.missions for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- APPLICATIONS
create policy "Freelance voit ses candidatures"
  on public.applications for select to authenticated
  using (freelance_id = auth.uid() or
         exists (select 1 from public.missions where id = mission_id and organisateur_id = auth.uid()));

create policy "Freelance postule"
  on public.applications for insert to authenticated
  with check (freelance_id = auth.uid());

create policy "Freelance/Organisateur modifient le statut"
  on public.applications for update to authenticated
  using (freelance_id = auth.uid() or
         exists (select 1 from public.missions where id = mission_id and organisateur_id = auth.uid()));

-- CONVERSATIONS
create policy "Participants voient leurs conversations"
  on public.conversations for select to authenticated
  using (participant_1 = auth.uid() or participant_2 = auth.uid());

create policy "Créer une conversation"
  on public.conversations for insert to authenticated
  with check (participant_1 = auth.uid() or participant_2 = auth.uid());

create policy "Participants modifient la conversation"
  on public.conversations for update to authenticated
  using (participant_1 = auth.uid() or participant_2 = auth.uid());

-- MESSAGES
create policy "Participants voient les messages"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations
      where id = conversation_id
        and (participant_1 = auth.uid() or participant_2 = auth.uid())
    )
  );

create policy "Envoyer un message"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid());

create policy "Marquer comme lu"
  on public.messages for update to authenticated
  using (
    exists (
      select 1 from public.conversations
      where id = conversation_id
        and (participant_1 = auth.uid() or participant_2 = auth.uid())
    )
  );

-- REVIEWS
create policy "Avis visibles par tous"
  on public.reviews for select to authenticated using (true);

create policy "Créer un avis"
  on public.reviews for insert to authenticated
  with check (reviewer_id = auth.uid());

-- DISPUTES
create policy "Voir ses litiges"
  on public.disputes for select to authenticated
  using (reporter_id = auth.uid() or reported_id = auth.uid() or
         exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Créer un litige"
  on public.disputes for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "Admin résout les litiges"
  on public.disputes for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- SOS SESSIONS
create policy "Voir les sessions SOS actives"
  on public.sos_sessions for select to authenticated using (true);

create policy "Organisateur crée une session SOS"
  on public.sos_sessions for insert to authenticated
  with check (organisateur_id = auth.uid());

create policy "Organisateur modifie sa session SOS"
  on public.sos_sessions for update to authenticated
  using (organisateur_id = auth.uid());

-- NOTIFICATIONS
create policy "Chacun voit ses notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Système peut créer des notifications"
  on public.notifications for insert to authenticated
  with check (true);

create policy "Chacun marque ses notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- DONNÉES DE DÉMO (optionnel — à commenter si non désiré)
-- ============================================================
-- Pour créer un admin manuellement après inscription :
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'ton_email@example.com';
