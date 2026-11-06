-- ============================================================================
-- 2K27 Comedy Platform — Stage 2: Row Level Security
-- ============================================================================
-- Design principle: anonymous submissions must be anonymous at the database
-- layer. `public.submissions` has no sender_id column; the mapping lives in
-- `public.submission_authors` and only the sender + admins can read it.
-- Service-role operations (Edge Functions / server routes) bypass RLS by
-- design and are the only path that may read or write AI scores and sender
-- identities.
--
-- Run AFTER 001_initial_schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and role = 'student');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- submissions
-- ----------------------------------------------------------------------------
alter table public.submissions enable row level security;

-- Recipients can read submissions written about them (recipient_id is not
-- sensitive). Admins can read everything for moderation.
drop policy if exists "submissions_select_recipient" on public.submissions;
create policy "submissions_select_recipient"
  on public.submissions for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "submissions_select_admin" on public.submissions;
create policy "submissions_select_admin"
  on public.submissions for select
  to authenticated
  using (public.is_admin());

-- Published submissions are readable by any authenticated student. Sender
-- identity is never exposed because it does not live in this table.
drop policy if exists "submissions_select_published" on public.submissions;
create policy "submissions_select_published"
  on public.submissions for select
  to authenticated
  using (status = 'published');

-- Students may insert a submission about someone else. They cannot set the
-- status or published_at fields.
drop policy if exists "submissions_insert_student" on public.submissions;
create policy "submissions_insert_student"
  on public.submissions for insert
  to authenticated
  with check (
    status = 'pending'
    and published_at is null
    and recipient_id <> auth.uid()
  );

-- Students may edit only their own pending submissions (via submission_authors).
drop policy if exists "submissions_update_own_pending" on public.submissions;
create policy "submissions_update_own_pending"
  on public.submissions for update
  to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from public.submission_authors sa
      where sa.submission_id = submissions.id
        and sa.sender_id = auth.uid()
    )
  )
  with check (
    status = 'pending'
    and published_at is null
  );

-- Students may delete only their own pending submissions.
drop policy if exists "submissions_delete_own_pending" on public.submissions;
create policy "submissions_delete_own_pending"
  on public.submissions for delete
  to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from public.submission_authors sa
      where sa.submission_id = submissions.id
        and sa.sender_id = auth.uid()
    )
  );

-- Admins may update / delete any submission (moderation actions).
drop policy if exists "submissions_update_admin" on public.submissions;
create policy "submissions_update_admin"
  on public.submissions for update
  to authenticated
  using (public.is_admin());

drop policy if exists "submissions_delete_admin" on public.submissions;
create policy "submissions_delete_admin"
  on public.submissions for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- submission_authors — the private sender mapping.
-- ONLY the sender and admins can read it. This table is never exposed
-- through any public view or feed query.
-- ----------------------------------------------------------------------------
alter table public.submission_authors enable row level security;

drop policy if exists "submission_authors_select_own" on public.submission_authors;
create policy "submission_authors_select_own"
  on public.submission_authors for select
  to authenticated
  using (sender_id = auth.uid());

drop policy if exists "submission_authors_select_admin" on public.submission_authors;
create policy "submission_authors_select_admin"
  on public.submission_authors for select
  to authenticated
  using (public.is_admin());

drop policy if exists "submission_authors_insert_own" on public.submission_authors;
create policy "submission_authors_insert_own"
  on public.submission_authors for insert
  to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "submission_authors_delete_own" on public.submission_authors;
create policy "submission_authors_delete_own"
  on public.submission_authors for delete
  to authenticated
  using (sender_id = auth.uid());

-- No update policy: authorship must never change. Admins act via service role.

-- ----------------------------------------------------------------------------
-- reactions
-- ----------------------------------------------------------------------------
alter table public.reactions enable row level security;

drop policy if exists "reactions_select_authenticated" on public.reactions;
create policy "reactions_select_authenticated"
  on public.reactions for select
  to authenticated
  using (true);

drop policy if exists "reactions_insert_own" on public.reactions;
create policy "reactions_insert_own"
  on public.reactions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reactions_update_own" on public.reactions;
create policy "reactions_update_own"
  on public.reactions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_delete_own"
  on public.reactions for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "reactions_delete_admin" on public.reactions;
create policy "reactions_delete_admin"
  on public.reactions for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- reports
-- ----------------------------------------------------------------------------
alter table public.reports enable row level security;

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid());

drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin"
  on public.reports for select
  to authenticated
  using (public.is_admin());

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports for update
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- blocks
-- ----------------------------------------------------------------------------
alter table public.blocks enable row level security;

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own"
  on public.blocks for select
  to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own"
  on public.blocks for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own"
  on public.blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "blocks_delete_admin" on public.blocks;
create policy "blocks_delete_admin"
  on public.blocks for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- moderation_records — admins read, but NEVER write via RLS.
-- Writes happen server-side with the service-role key (AI pipeline / admin
-- actions invoked through server code with explicit validation).
-- ----------------------------------------------------------------------------
alter table public.moderation_records enable row level security;

drop policy if exists "moderation_records_select_admin" on public.moderation_records;
create policy "moderation_records_select_admin"
  on public.moderation_records for select
  to authenticated
  using (public.is_admin());

-- No INSERT / UPDATE / DELETE policies for authenticated users.

-- ----------------------------------------------------------------------------
-- daily_collections
-- ----------------------------------------------------------------------------
alter table public.daily_collections enable row level security;

drop policy if exists "daily_collections_select_published" on public.daily_collections;
create policy "daily_collections_select_published"
  on public.daily_collections for select
  to authenticated
  using (status in ('published', 'archived'));

drop policy if exists "daily_collections_select_admin" on public.daily_collections;
create policy "daily_collections_select_admin"
  on public.daily_collections for select
  to authenticated
  using (public.is_admin());

-- No write policies for authenticated users: publishing is a server/admin job.

-- ----------------------------------------------------------------------------
-- daily_collection_items
-- ----------------------------------------------------------------------------
alter table public.daily_collection_items enable row level security;

drop policy if exists "daily_collection_items_select_published" on public.daily_collection_items;
create policy "daily_collection_items_select_published"
  on public.daily_collection_items for select
  to authenticated
  using (
    exists (
      select 1 from public.daily_collections dc
      where dc.id = daily_collection_items.collection_id
        and dc.status in ('published', 'archived')
    )
  );

drop policy if exists "daily_collection_items_select_admin" on public.daily_collection_items;
create policy "daily_collection_items_select_admin"
  on public.daily_collection_items for select
  to authenticated
  using (public.is_admin());

-- Rejection-proofing: verify RLS is enabled on every user-facing table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','submissions','submission_authors','reactions','reports',
    'blocks','moderation_records','daily_collections','daily_collection_items'
  ] loop
    if not exists (
      select 1 from pg_tables
      where schemaname = 'public' and tablename = t and rowsecurity = true
    ) then
      raise exception 'RLS not enabled on public.%', t;
    end if;
  end loop;
end $$;
