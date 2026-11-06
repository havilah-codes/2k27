# 2K27 — Decision Log

Durable technical + product decisions. Do not reverse these without recording
the reason here first.

---

## D1 — Anonymity by schema design, not by UI hiding
**Date:** 2026-11-04 · **Stage:** 2

`public.submissions` has **no `sender_id` column**. The sender mapping lives in
`public.submission_authors`, whose RLS exposes it only to the sender and to
administrators. Published submissions therefore *cannot* leak the sender via
a public `SELECT` — the data simply isn't in the public table.

**Why:** "Public feed never shows senders" is the core promise. Hiding a
`sender_id` column in the UI does not protect it from direct API/DB queries.

## D2 — Every submission enters `pending`; nothing is public until Stage 5/6
**Date:** 2026-11-04 · **Stage:** 4

`createSubmission` hard-codes `status = 'pending'` server-side. Client-supplied
`status` / `senderId` values are ignored. AI evaluation (Stage 5) and the daily
collection publisher (Stage 6) are the only paths that may move a submission
out of `pending`.

## D3 — Sender identity is derived from the session, never from the client
**Date:** 2026-11-04 · **Stage:** 4

`src/lib/supabase/submissions.ts` gets the sender via `requireUser()` (server
session). There is no request parameter for `sender_id`. Errors never include
sender information.

## D4 — Limit checks use the service-role client; inserts use the session client
**Date:** 2026-11-05 · **Stage:** 4

RLS does not let a sender `SELECT` their own *pending* submissions (only
recipient / admin / published can). The daily-limit, per-recipient-limit and
duplicate checks therefore read through `createSupabaseAdminClient()`
(all server-side, response contains no sender data). The actual `INSERT`s
go through the cookie/session client so RLS still applies. The service-role
key is never sent to the browser.

## D5 — Submission limits: 5/day total, 2/day per recipient, 500 chars
**Date:** 2026-11-04 · **Stage:** 4 (brief: 5 / 2 / 500)

Single source of truth: `SUBMISSION_LIMITS` + `MAX_CONTENT_LENGTH` in
`src/lib/constants.ts`, mirrored by the DB check in migration `003` and by
server-side enforcement in `createSubmission`. UTC day boundaries
(`startOfTodayUtc()`).

## D6 — Blocks are enforced in both directions
**Date:** 2026-11-04 · **Stage:** 4

If A blocks B *or* B blocks A, neither can submit to the other. Recipient
search, random selection, and submission all exclude both directions.

## D7 — Next.js 16 `proxy.ts` (not `middleware.ts`)
**Date:** 2026-11-04 · **Stage:** 2/4

Next 16 exposes middleware as `proxy.ts`. The repo keeps the implementation in
`src/lib/supabase/middleware.ts` (with `@supabase/ssr` session refresh +
protected-route gate) and re-exports it from `proxy.ts` with an inline static
`config.matcher` (a referenced object fails the build — Turbopack requires a
statically-parsed config).

## D8 — Profile creation survives email-confirmation flows
**Date:** 2026-11-05 · **Stage:** 4

`signUp` stores username/display name/class as auth `user_metadata`. If the
user has no session yet (email confirmation on), `signIn` creates the
`profiles` row from that metadata on first login. With email confirmation
*off* (recommended for local dev), the profile is created immediately.

## D9 — School-domain restriction is configurable, not assumed
**Date:** 2026-11-04 · **Stage:** 2 · ⚠️ **Superseded by D13**

No school email domain is known yet. `SCHOOL_EMAIL_DOMAIN` env var gates
email/password signup when set and is a no-op when unset. Do not invent a
domain.

## D10 — Mock data quarantined, then removed (2026-11-05)
**Date:** 2026-11-04 · **Stage:** 3 · **Updated 2026-11-05: moc data DELETED**

Mock data lived only in `src/lib/mock-data.ts` for Stage 3 visuals. On
2026-11-05 (user request: "only use posts created by actual users") the file
was deleted and the homepage, Hall of Fame, profile, and header were wired to
real DB rows (`src/lib/supabase/feed.ts`). Homepage/archive data wiring is
not to be re-mocked; empty states handle pre-publication reality.

## D11 — Profile page is still UI-only (mock identity)
**Date:** 2026-11-04 · **Stage:** 3/4

The profile *page* still renders `mockMe` (edit is local state). The header
does show the real user (browser-client fetch). Wiring the profile page to
`profiles` is a small Stage 5/6 follow-up and must keep the "no sender
history" privacy rule.

## D12 — Community rules are deliberately limited (product stance)
**Date:** 2026-11-01 (brief) · **Locked**

Prohibited: threats/intimidation, discriminatory insults against protected
groups, repeated targeted harassment, private personal info. Rude,
controversial, sarcastic or dark-humour content is generally permitted.
Reports are human-reviewed against these rules; never auto-remove on a report
alone. Do not silently tighten this in moderation prompts or policies.

## D13 — Google-only authentication (supersedes D9)
**Date:** 2026-11-05 · **Stage:** 4 (user-requested change)

Email/password auth was removed: verification-email friction and Supabase's
15-second signup throttle made it unusable for a student audience. All
identity goes through Google OAuth (Supabase `signInWithOAuth`); first-time
users complete a profile step (username + class). The Email provider can be
disabled in the Supabase dashboard; `SCHOOL_EMAIL_DOMAIN` is unused.

Supersedes D9 for email signup. Access control via a school domain remains
future work (invite codes / provider allowlist) — Google personal accounts
cannot be domain-gated.

## D14 — Free expression + human review (product stance, reaffirmed)
**Date:** 2026-11-05 · **Stage:** 4

Per the brief: reports are human-reviewed, never auto-removed on report
alone. Stage 5 moderation prompts must encode exactly the D12 rules — no
silent tightening.

## D15 — Class-roast easter egg (demo content, ephemeral)
**Date:** 2026-11-05 · **Stage:** 3/4 (user-requested adaption)

The user's original joke script (Python insult-lookup) lives on as a
clearly-labelled joke section on the homepage (`src/lib/demo-roasts.ts` +
`DemoRoastSection`): type a classmate's full name → insult cards appear →
each card vanishes the instant someone reacts to it (consumed set persists
per device via localStorage; "Replay the joke" resets).

Deliberately NOT in the real feed: the published feed stays real-user-only
(user's 2026-11-05 instruction). Seeded roasts violating D12 (protected-group
/ gendered mockery) were excluded: the "Fulani man" ethnic reference and the
Stephanie + Divine lines; Ella's roast keeps only its non-ethnic portion.
Nothing here touches the database.
## D16 — AI evaluation architecture (Stage 5)
**Date:** 2026-11-06 · **Stage:** 5

- **Single-call evaluation:** one LLM call returns moderation verdict +
  comedy scores together (cheaper + consistent). Scores are only stored
  when the verdict is `approved`; rejected/flagged records store nulls.
- **Atomic claim queue:** submissions carry a `processing` claim state +
  `claimed_at` + `evaluation_attempts` (migration 004). Workers claim via
  compare-and-set (pending→processing, guarded finalize by claim timestamp),
  stale claims (> 10 min) self-heal. Duplicate processing is impossible,
  including with concurrent sweepers (unit-tested).
- **Weighted overall computed in code** (`calculateOverallScore`), never
  trusted from the model. The Stage 5 brief's worked example contains an
  arithmetic slip: (90×0.40)+(80×0.25)+(85×0.20)+(75×0.15) = **84.25**, not
  83.25 — the code follows the formula, and tests assert 84.25.
- **AI verdicts are advisory:** approvals below confidence 0.65 downgrade
  to `flagged`; uncertain content is flagged, never auto-rejected.
- **Trigger:** `/api/evaluate` guarded by `CRON_SECRET`, invoked by webhook
  / Vercel Cron / pg_cron — never by the frontend (see HANDOFF §15).
- **Sender anonymity extends to the AI:** prompts receive content + public
  recipient info + targeting-history COUNTS only.

## D17 — Offline-first testability for the AI layer
**Date:** 2026-11-06 · **Stage:** 5

The ai package (`src/lib/ai`) keeps runtime imports within its own directory
with explicit `.ts` extensions (plus `allowImportingTsExtensions`), so the
same files run under Node's built-in test runner with no new dependencies.
A deterministic `mock` provider provides canned outcomes for all test
scenarios — live AI calls are never required for CI. The worker's database
layer is an injected `EvaluationStore`, so concurrency/retry logic is unit
tested against an in-memory fake implementing the same CAS semantics.
