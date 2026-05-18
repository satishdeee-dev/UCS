-- ========================================================================
-- CommApp · Web Push subscriptions
-- ========================================================================
-- Apply via Supabase CLI:  supabase db push
-- Or paste into the SQL editor in the Supabase dashboard.

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,                       -- dummy phone identity
  endpoint      text not null unique,                -- push service URL
  p256dh        text not null,                       -- client P-256 ECDH public key
  auth          text not null,                       -- auth secret
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index push_subscriptions_phone_idx on public.push_subscriptions (phone);

-- Demo permissions:
-- Anyone with the anon key can read/write subscriptions keyed by their own
-- phone number. The dummy identity model has no real auth, so this is
-- intentionally open for the demo. Don't ship this for real production.
alter table public.push_subscriptions enable row level security;

create policy "demo: open access"
  on public.push_subscriptions
  for all
  to anon
  using (true)
  with check (true);
