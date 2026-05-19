-- ========================================================================
-- CommApp · Shared profile roster for admin dashboard
-- ========================================================================
-- Apply via Supabase CLI:  supabase db push
-- Or paste into the SQL editor in the Supabase dashboard.

create table public.commapp_profiles (
  phone           text primary key,           -- dummy phone identity
  display_name    text,
  avatar_base64   text,                       -- 256² JPEG, ~30 KB
  avatar_mime     text,
  sign_in_count   integer not null default 1, -- bumped on every register
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

create index commapp_profiles_last_seen_idx
  on public.commapp_profiles (last_seen_at desc);

-- Demo permissions:
-- Anyone with the anon key can upsert/select their own profile. There is
-- no enforced auth in the dummy-phone model, so this is intentionally
-- open for the demo. Don't ship this for real production.
alter table public.commapp_profiles enable row level security;

create policy "demo: open access"
  on public.commapp_profiles
  for all
  to anon
  using (true)
  with check (true);
