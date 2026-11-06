-- ============================================================================
-- 2K27 Comedy Platform — Stage 4: Submission hardening
-- ============================================================================
-- Run AFTER 001_initial_schema.sql and 002_rls_policies.sql.
--
-- Purpose:
--   * Tighten the content length check to the Stage 4 product limit (500).
--   * The confirmed, product-facing limit enforced server-side demonstrates
--     completion of Stage 4. Stage 4 switches to 500.
--
-- Note: application-layer limits (5/day total, 2/day to the same person,
-- duplicate detection, self-submission, block checks) live in
-- src/lib/supabase/submissions.ts and SUBMISSION_LIMITS in
-- src/lib/constants.ts. This migration only adjusts the schema-level guard.
-- ============================================================================

-- Replace the 1000-char check with the Stage 4 product limit of 500.
alter table public.submissions
  drop constraint if exists submissions_content_check;

alter table public.submissions
  add constraint submissions_content_check
  check (char_length(content) between 3 and 500);

-- Helpful indexes for daily-limit queries (sender + recipient + date).
create index if not exists submission_authors_sender_created_idx
  on public.submission_authors (sender_id, created_at desc);

create index if not exists submissions_recipient_created_idx
  on public.submissions (recipient_id, created_at desc);
