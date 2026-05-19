-- ========================================================================
-- CommApp · sign_in_count on commapp_profiles
-- ========================================================================
-- Idempotent: safe to run whether or not the column already exists.
-- The original 20260519000000_profiles.sql migration also now declares
-- this column; this patch lets databases that ran an earlier version
-- catch up.

alter table public.commapp_profiles
  add column if not exists sign_in_count integer not null default 1;
