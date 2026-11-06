-- ============================================================================
-- 2K27 Comedy Platform — Stage 5: AI evaluation pipeline
-- ============================================================================
-- Run AFTER 001, 002, 003 (in the Supabase SQL Editor).
--
-- What this does:
--   * Adds a `processing` state so workers can atomically CLAIM pending
--     submissions (SELECT ... FOR UPDATE SKIP LOCKED style queue pattern)
--     and therefore provably never evaluate the same submission twice.
--   * Tracks evaluation attempts + the last error for retry/failure logging.
--   * Extends moderation_records with the full comedy-score set (relatability,
--     weighted overall, confidence) and an evaluation metadata blob
--     (provider/model, AI's short evaluation and moderation category).
--
-- No new RLS policies: moderation_records already has NO write policies for
-- authenticated users; writes happen via the service-role client only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. `processing` claim state (atomic queue pattern)
-- ----------------------------------------------------------------------------
alter type public.submission_status add value if not exists 'processing';

alter table public.submissions
  add column if not exists claimed_at timestamptz,
  add column if not exists evaluation_attempts integer not null default 0
    check (evaluation_attempts >= 0),
  add column if not exists last_evaluation_error text;

-- Pending queue: oldest first (FOR UPDATE SKIP LOCKED reads in code).
create index if not exists submissions_pending_created_idx
  on public.submissions (created_at asc)
  where status = 'pending';

-- Stale-claim recovery: rows stuck in `processing` (worker died mid-flight).
create index if not exists submissions_processing_claimed_idx
  on public.submissions (claimed_at asc)
  where status = 'processing';

-- ----------------------------------------------------------------------------
-- 2. moderation_records: full score set + evaluation metadata
-- ----------------------------------------------------------------------------
alter table public.moderation_records
  add column if not exists relatability_score numeric(5,2)
    check (relatability_score is null or (relatability_score >= 0 and relatability_score <= 100)),
  add column if not exists overall_score numeric(5,2)
    check (overall_score is null or (overall_score >= 0 and overall_score <= 100)),
  add column if not exists confidence numeric(5,4)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column if not exists evaluation_meta jsonb not null default '{}'::jsonb;

-- Admin review queue: flagged submissions first, newest records first.
create index if not exists moderation_records_queue_idx
  on public.moderation_records (moderation_status, created_at desc);
