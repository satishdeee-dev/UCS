-- ========================================================================
-- UCS · Initial schema · Phase 1 MVP
-- ========================================================================
-- Apply via Supabase CLI:  supabase db push
-- Or paste into the SQL editor in the Supabase dashboard.

-- ========================================================================
-- USERS  (profile data extending auth.users)
-- ========================================================================
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  avatar_url    text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index users_last_seen_idx on public.users (last_seen_at desc);

alter table public.users enable row level security;

create policy "users: read any (authenticated)"
  on public.users for select
  to authenticated
  using (true);

create policy "users: update own"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create a profile row whenever a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========================================================================
-- CONVERSATIONS
-- ========================================================================
create type conversation_type as enum ('direct', 'group');

create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  type        conversation_type not null default 'direct',
  name        text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

alter table public.conversations         enable row level security;
alter table public.conversation_members  enable row level security;

-- Helper: is current user a member of this conversation?
create function public.is_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = cid and user_id = auth.uid()
  );
$$;

create policy "conversations: members can read"
  on public.conversations for select
  to authenticated
  using (public.is_member(id));

create policy "conversations: any auth user can create"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "conversation_members: members can read membership"
  on public.conversation_members for select
  to authenticated
  using (public.is_member(conversation_id));

create policy "conversation_members: creator adds or self-joins"
  on public.conversation_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

create policy "conversation_members: leave own"
  on public.conversation_members for delete
  to authenticated
  using (user_id = auth.uid());

-- ========================================================================
-- MESSAGES
-- ========================================================================
create table public.messages (
  id                  uuid primary key,           -- generated client-side for offline writes
  conversation_id     uuid not null references public.conversations(id) on delete cascade,
  sender_id           uuid not null references public.users(id) on delete cascade,
  body                text not null,
  client_created_at   timestamptz not null,       -- device clock (offline-friendly)
  server_received_at  timestamptz not null default now(),
  deleted_at          timestamptz
);

create index messages_conversation_time_idx
  on public.messages (conversation_id, client_created_at desc);

alter table public.messages enable row level security;

create policy "messages: members can read"
  on public.messages for select
  to authenticated
  using (public.is_member(conversation_id));

create policy "messages: sender inserts into own conversations"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id));

create policy "messages: sender can soft-delete own"
  on public.messages for update
  to authenticated
  using (sender_id = auth.uid());

alter publication supabase_realtime add table public.messages;

-- ========================================================================
-- VOICE NOTES
-- ========================================================================
create table public.voice_notes (
  id                  uuid primary key,
  conversation_id     uuid not null references public.conversations(id) on delete cascade,
  sender_id           uuid not null references public.users(id) on delete cascade,
  storage_path        text not null,              -- key in voice-notes bucket
  duration_ms         integer not null,
  transcript          text,
  client_created_at   timestamptz not null,
  server_received_at  timestamptz not null default now(),
  deleted_at          timestamptz
);

create index voice_notes_conversation_time_idx
  on public.voice_notes (conversation_id, client_created_at desc);

alter table public.voice_notes enable row level security;

create policy "voice_notes: members can read"
  on public.voice_notes for select
  to authenticated
  using (public.is_member(conversation_id));

create policy "voice_notes: sender inserts"
  on public.voice_notes for insert
  to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id));

create policy "voice_notes: sender updates own"
  on public.voice_notes for update
  to authenticated
  using (sender_id = auth.uid());

alter publication supabase_realtime add table public.voice_notes;

-- ========================================================================
-- NOTIFICATIONS
-- ========================================================================
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications: read own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications: update own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.notifications;

-- ========================================================================
-- STORAGE BUCKETS
-- ========================================================================
insert into storage.buckets (id, name, public)
values
  ('avatars',        'avatars',        true),
  ('voice-notes',    'voice-notes',    false),
  ('message-images', 'message-images', false)
on conflict (id) do nothing;

-- Avatar policies (public bucket — anyone can read; only owner writes)
create policy "avatars: anyone reads"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: owner writes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner updates"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Voice notes (private — readers must be conversation members)
create policy "voice-notes: members read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'voice-notes'
    and exists (
      select 1
      from public.voice_notes v
      where v.storage_path = name
        and public.is_member(v.conversation_id)
    )
  );

create policy "voice-notes: sender writes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Message images (private — same model as voice notes; path prefix = sender id)
create policy "message-images: sender writes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "message-images: members read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'message-images'
    and (storage.foldername(name))[1] in (
      select cm2.user_id::text
      from public.conversation_members cm1
      join public.conversation_members cm2 on cm1.conversation_id = cm2.conversation_id
      where cm1.user_id = auth.uid()
    )
  );
