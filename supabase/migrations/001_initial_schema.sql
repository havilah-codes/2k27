-- ============================================================================
-- 2K27 Comedy Platform — Stage 2: Initial schema
-- ============================================================================
-- Run order in Supabase SQL Editor:
--   1) 001_initial_schema.sql
--   2) 002_rls_policies.sql
--
-- SECURITY NOTE: submissions intentionally has NO sender_id column.
-- The sender identity lives only in submission_authors, whose RLS exposes it
-- solely to the sender and to administrators. Published submissions can
-- therefore never leak the sender via a public select query.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.profile_role as enum ('student', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.submission_category as enum ('compliment', 'roast', 'joke', 'observation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.submission_status as enum ('pending', 'approved', 'rejected', 'flagged', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reaction_type as enum ('laugh', 'love', 'fire', 'shocked', 'mind_blown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.moderation_status as enum ('approved', 'flagged', 'rejected', 'manual_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.collection_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Helpers: timestamps + admin check
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- SECURITY DEFINER so policy checks can read roles without recursing through
-- the profiles table's own RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 1. profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 30),
  display_name text not null check (char_length(display_name) between 1 and 60),
  class_name text not null check (char_length(class_name) between 1 and 40),
  avatar_url text,
  role public.profile_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_class_name_idx on public.profiles (class_name);
create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role-escalation guard. Authenticated users may only ever insert with role
-- 'student' and may only change role if they already are an admin. Service
-- role operations (auth.uid() is null) are the server's bootstrap path.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role <> 'student' and auth.uid() is not null then
      raise exception 'Only administrators can be assigned the admin role';
    end if;
  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Users cannot change their own role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before insert or update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ----------------------------------------------------------------------------
-- 2. submissions (sender_id intentionally NOT stored here)
-- ----------------------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete restrict,
  content text not null check (char_length(content) between 1 and 1000),
  category public.submission_category not null,
  status public.submission_status not null default 'pending',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (published_at is null or status in ('approved', 'published'))
);

create index if not exists submissions_status_created_idx
  on public.submissions (status, created_at desc);
create index if not exists submissions_recipient_idx
  on public.submissions (recipient_id);
create index if not exists submissions_published_at_idx
  on public.submissions (published_at desc) where status = 'published';

-- ----------------------------------------------------------------------------
-- 2b. submission_authors (private sender mapping)
-- ----------------------------------------------------------------------------
create table if not exists public.submission_authors (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists submission_authors_sender_idx
  on public.submission_authors (sender_id);

-- ----------------------------------------------------------------------------
-- 3. reactions
-- ----------------------------------------------------------------------------
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction_type public.reaction_type not null,
  created_at timestamptz not null default now(),
  unique (submission_id, user_id, reaction_type),
  check (user_id is not null)
);

create index if not exists reactions_submission_idx on public.reactions (submission_id);
create index if not exists reactions_user_idx on public.reactions (user_id);

-- ----------------------------------------------------------------------------
-- 4. reports
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 80),
  description text check (char_length(description) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (submission_id, reporter_id)
);

create index if not exists reports_submission_idx on public.reports (submission_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_status_idx on public.reports (status);

-- ----------------------------------------------------------------------------
-- 5. blocks
-- ----------------------------------------------------------------------------
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- ----------------------------------------------------------------------------
-- 6. moderation_records (AI + admin review outcomes; scores are server-only)
-- ----------------------------------------------------------------------------
create table if not exists public.moderation_records (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  moderation_status public.moderation_status not null,
  humour_score numeric(5,2) check (humour_score is null or (humour_score >= 0 and humour_score <= 100)),
  originality_score numeric(5,2) check (originality_score is null or (originality_score >= 0 and originality_score <= 100)),
  creativity_score numeric(5,2) check (creativity_score is null or (creativity_score >= 0 and creativity_score <= 100)),
  moderation_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists moderation_records_submission_idx
  on public.moderation_records (submission_id);
create index if not exists moderation_records_status_idx
  on public.moderation_records (moderation_status);

-- ----------------------------------------------------------------------------
-- 7. daily_collections
-- ----------------------------------------------------------------------------
create table if not exists public.daily_collections (
  id uuid primary key default gen_random_uuid(),
  collection_date date not null unique,
  status public.collection_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (published_at is null or status in ('published', 'archived'))
);

create index if not exists daily_collections_date_idx
  on public.daily_collections (collection_date desc);

-- ----------------------------------------------------------------------------
-- 8. daily_collection_items
-- ----------------------------------------------------------------------------
create table if not exists public.daily_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.daily_collections (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  position integer not null check (position >= 1),
  created_at timestamptz not null default now(),
  unique (collection_id, submission_id),
  unique (collection_id, position)
);

create index if not exists daily_collection_items_collection_idx
  on public.daily_collection_items (collection_id, position);
create index if not exists daily_collection_items_submission_idx
  on public.daily_collection_items (submission_id);
