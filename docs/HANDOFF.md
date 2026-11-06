# 2K27 — Project Handoff

**Read this first if you are a new AI model.** Everything needed to continue
without conversation history is in this file plus `docs/PROJECT_PLAN.md` and
`docs/DECISIONS.md`.

---

## 1. Project overview

Anonymous, student-driven social comedy platform ("2K27 Daily Comedy").
Students log in, pick another eligible student (randomly or manually) and
submit a compliment / roast / joke / observation about them. Submissions are
collected all day, AI-scored for humour, creativity and originality, and the
best are published in a daily homepage feed. Submissions are anonymous to
ordinary users; admins can investigate abuse. Freedom of expression with a
deliberately limited rule set (no threats, no protected-group slurs, no
targeted harassment, no doxxing).

**Repo:** `C:\Users\USER\Documents\2k27` (git repo, initialized by create-next-app)
**Stack:** Next.js 16.4.5 · React 19 · TypeScript strict · Tailwind v4 ·
Framer Motion · Lucide React · Supabase (Postgres + Auth + RLS) · `@supabase/ssr`
**Deploy target:** Vercel + Supabase hosted. **Mobile-first.**

## 2. Current development stage

**Stage 5 (AI Evaluation Engine) — code complete, verified by build/lint/tests.
Pending user: run migration 004, set LLM + CRON env vars, wire ONE trigger
(Supabase webhook / Vercel Cron / pg_cron).** Stage 6 (publication) must NOT
be started without explicit authorisation.

## 3. Completed work

### Stage 1 — Foundation
- Next.js 16 App Router scaffold in `src/`; TS + Tailwind v4 + Framer Motion +
  Lucide; design-token globals (`src/app/globals.css`, warm editorial palette).
- Root layout, `loading.tsx`, `error.tsx`, `not-found.tsx`.

### Stage 2 — Database & Auth (code)
- Migrations `001` (schema) + `002` (RLS) — see §7.
- Supabase clients: `src/lib/supabase/client.ts` (browser), `server.ts`
  (cookie server client + service-role admin client), `env.ts`,
  `middleware.ts` + `proxy.ts` (session refresh, protected-route gate).
- Auth: `src/app/auth/actions.ts` (`signUp`/`signIn`/`signOut`), `/login`,
  `/signup`, `/auth/callback` (email confirm), profile creation with
  metadata fallback, `SCHOOL_EMAIL_DOMAIN` gate.
- `.env.example`, `supabase/README.md`.

### Stage 3 — Core interface
- App shell (header + mobile tab bar), homepage feed UI, Submit page UI,
  Hall of Fame UI, Profile UI, full reusable UI library, skeletons/empty states.

### Stage 4 — Submission system (this stage)
- Live recipient search + server-side random pick (`profiles.ts`), excluding
  self and both blocking directions.
- `SubmissionComposer` (`src/app/submit/composer.tsx`) wired to
  `createSubmission` server action; 500-char live counter; loading / success /
  error states; double-submit prevention (`submitting` state + disabled button);
  daily-usage meter.
- `createSubmission` (`src/lib/supabase/submissions.ts`): session-derived
  sender, strict server validation, recipient existence, block check,
  self-submit rejection, 5/day + 2/recipient/day limits, duplicate-content
  detection, rollback if author mapping fails, always `pending`.
- `validateSubmissionInput` (`src/lib/validation/submission.ts`) — ignores
  client-supplied `senderId`/`status`.
- Migration `003_submission_limits.sql` (500-char check + indexes).
- Header now shows the real signed-in user (browser-client fetch) + Log out
  button; submit page is a server-gated component.

### Stage 5 — AI Evaluation Engine (this stage) — code complete, untested live
- **Modular provider layer** (`src/lib/ai/provider.ts`): `openai` (OpenAI-
  compatible), `anthropic`, `mock` — configured by `LLM_PROVIDER`; timeouts
  (default 25s), retries (≤2), fail-closed config errors. `src/lib/ai/prompt.ts`
  encodes the D12 rules; `src/lib/ai/validate.ts` validates + downgrades
  low-confidence approvals; `src/lib/ai/scoring.ts` computes the weighted
  score (humour 40 / originality 25 / creativity 20 / relatability 15) in code.
- **Worker** (`src/lib/ai/worker.ts`): `processBatch` / `processOne` over an
  injected `EvaluationStore`; atomic claim (status pending→processing CAS +
  claimed_at guard), stale-claim recovery (10 min), 3-attempt retry → flagged
  `evaluation_failed` record. Supabase adapter in
  `src/lib/supabase/evaluation-store.ts` (service-role only; context = counts,
  never sender identity; admin queue + override functions included).
- **Endpoint** `POST/GET /api/evaluate` — `Bearer <CRON_SECRET>` guarded,
  server-only, no submission publishing (Stage 6 owns publication).
- **Migration `004_evaluation_pipeline.sql`** — `processing` enum value,
  `claimed_at`, `evaluation_attempts`, `last_evaluation_error`, score columns
  (relatability/overall/confidence), `evaluation_meta` jsonb.
- **Tests:** `tests/ai-evaluation.test.ts` — 25 tests, all passing.
  **NOTE — brief arithmetic slip:** the brief's worked example (90/80/85/75)
  states 83.25; the formula it defines yields **84.25**. Code follows the
  formula (36+20+17+11.25 = 84.25).

### Stage 4 follow-up — demo data removed, real feed (user-requested, 2026-11-05)
- `src/lib/mock-data.ts` **deleted**. Homepage, Hall of Fame, profile, and
  header now use only real rows: `getPublishedFeed()`, `getCollections()`
  (`src/lib/supabase/feed.ts` → `daily_collections`/`daily_collection_items`),
  `getCurrentProfile()` + real `getDailyUsage()`.
- Feed shape `FeedSubmission` has **no sender fields** (schema guarantee).
- Profile edit now persists via the new `updateProfile` server action
  (username/display name/class only; role untouched).
- Until Stage 5 (AI) + Stage 6 (publication) land, the feed is legitimately
  empty: submissions enter as `pending`. To preview a real post in the feed,
  run in the SQL Editor:
  `update public.submissions set status = 'published', published_at = now() order by created_at desc limit 1;`
  (renders publicly; RLS already allows authenticated reads of published rows).
- Reaction/report interactions remain visual-only (Stages 6–7).
- **Class-roast easter egg** (user's joke script, DECISIONS D15):
  `src/lib/demo-roasts.ts` + `DemoRoastSection` on the homepage — type a
  classmate's full name → insult cards → each vanishes on reaction (persisted
  per device in localStorage; "Replay the joke" resets). Not in the DB.
  Three entries excluded per D12 (ethnic/gendered content).

### Stage 4 follow-up — Google login, then Google-only (user-requested)
- "Continue with Google" on `/login` and `/signup` (`GoogleButton` client
  component → `supabase.auth.signInWithOAuth({ provider: 'google' })`).
- `/auth/callback` now checks for a profile row after OAuth; first-time
  Google users land on `/signup`, which renders a profile-completion form
  (username + class; display name prefilled from Google) backed by the new
  `completeProfile` server action.
- **Email/password auth fully removed** (user decision 2026-11-05): login and
  signup pages are Google-only; `signUp`/`signIn` server actions deleted;
  `SCHOOL_EMAIL_DOMAIN` no longer used. See DECISIONS D13.
- Dashboard steps to enable the provider: `supabase/README.md`. You can
  also disable the Email provider there (nothing uses it anymore).

## 4. Files created (Stage 4 increment)

- `src/lib/supabase/env.ts`, `client.ts`, `server.ts`, `middleware.ts`, `auth.ts`,
  `profiles.ts`, `submissions.ts`, `feed.ts` (real feed/collections queries)
- `src/lib/validation/submission.ts`
- `src/proxy.ts` — Next 16 proxy (must live in `src/`, same level as `app/`;
  a repo-root `proxy.ts` is silently IGNORED when a `src/` directory exists)
- `src/app/auth/actions.ts`, `src/app/auth/callback/route.ts`
- `src/app/login/page.tsx`, `src/app/signup/page.tsx`
- `src/app/signup/signup-form.tsx`, `src/app/signup/profile-completion.tsx`
- `src/components/ui/GoogleButton.tsx`
- `src/app/submit/page.tsx` (server gate), `src/app/submit/composer.tsx`
- `src/app/feed-client.tsx`, `src/app/hall-of-fame/hall-of-fame-client.tsx`,
  `src/app/profile/page.tsx` (real data), `src/app/profile/profile-editor.tsx`
- **Deleted:** `src/lib/mock-data.ts` (all demo posts/collections/identities)
- `supabase/migrations/003_submission_limits.sql`
- `.env.example`
- `docs/HANDOFF.md`, `docs/PROJECT_PLAN.md`, `docs/DECISIONS.md` (filled in now)

### Stage 5 files

- `supabase/migrations/004_evaluation_pipeline.sql`
- `src/lib/ai/types.ts`, `scoring.ts`, `validate.ts`, `prompt.ts`,
  `provider.ts`, `worker.ts`
- `src/lib/supabase/evaluation-store.ts`, `admin-actions.ts`
- `src/app/api/evaluate/route.ts`
- `tests/ai-evaluation.test.ts` + `npm test` script (Node built-in runner)

## 5. Files modified (Stage 4 increment)

- `src/lib/constants.ts` — `MAX_CONTENT_LENGTH` 1000 → 500, added `SUBMISSION_LIMITS`
- `src/components/layout/AppHeader.tsx` — real-user fetch + Log out form
- `src/components/layout/AppShell.tsx` — (briefly took a user prop; reverted)
- `src/app/layout.tsx` — reverted to plain server layout (no blocking fetch)
- `src/app/profile/page.tsx`, `src/components/ui/SubmissionCard.tsx` — lint cleanup
- `supabase/README.md` — migration 003 + email-confirm + site-URL notes
- `src/lib/supabase/submissions.ts` — service-role client for limit checks

## 6. Important architectural decisions

See `docs/DECISIONS.md` (D1–D15). Highlights:

- Anonymity lives in the **schema** (`submissions` has no `sender_id`;
  mapping in `submission_authors`, RLS = sender + admin only).
- New submissions are always `pending`; Stage 5/6 own publication.
- Limit checks use the service-role client server-side only; inserts use the
  session client so RLS applies.
- Blocks enforced in **both** directions.
- Next 16 `proxy.ts` with inline static matcher config.
- AI evaluation: atomic claim (status pending→processing), mock provider for
  tests, weighted score computed in code (never trusted from the model),
  low-confidence approvals downgrade to flagged; brief's example sum corrected
  (90/80/85/75 = 84.25, not 83.25).

## 7. Database changes

Run in Supabase **SQL Editor → New query**, in order (if not already run):

1. `supabase/migrations/001_initial_schema.sql` — enums, `profiles`,
   `submissions` (no `sender_id`!), `submission_authors`, `reactions`,
   `reports`, `blocks`, `moderation_records`, `daily_collections`,
   `daily_collection_items`, role-escalation trigger.
2. `supabase/migrations/002_rls_policies.sql` — RLS + policies on all 9 tables.
3. `supabase/migrations/003_submission_limits.sql` — content check 3–500
   chars + `submission_authors(sender_id, created_at)` and
   `submissions(recipient_id, created_at)` indexes.
4. `supabase/migrations/004_evaluation_pipeline.sql` — `processing` state,
    claim/attempt/error columns on submissions; relatability/overall/
    confidence + `evaluation_meta` on moderation_records.

Full manual-setup checklist: `supabase/README.md` (§15 for triggers).

## 8. Environment variables required

In `.env.local` (never commit; never print values):

| Var | Scope | Status |
|-----|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | public | set by user |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | set by user |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | set by user |
| `NEXT_PUBLIC_SITE_URL` | public (OAuth links) | **ADD: `http://localhost:3000`** |
| `SCHOOL_EMAIL_DOMAIN` | server | **unused since 2026-11-05** (Google-only auth) |
| `LLM_PROVIDER` | server | `openai` (default) \| `anthropic` \| `mock` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | **server only** | match `LLM_PROVIDER` |
| `LLM_MODEL` | server | default `gpt-4o-mini` / `claude-haiku-4-5-20251001` |
| `LLM_TIMEOUT_MS` / `LLM_MAX_RETRIES` | server | 25000 / 2 |
| `CRON_SECRET` | **server only** | required by `/api/evaluate` |

## 9. Current implementation status

| Area | Status |
|------|--------|
| Foundation + design system | ✅ built |
| Supabase integration + RLS | ✅ code; DB needs migrations run |
| Auth (signup/login/logout) | ✅ code; needs manual verification |
| Submit → `pending` in DB | ✅ code; needs manual 2-account test |
| Homepage / archive / profile | ✅ real DB data (feed: published only; profile: real + editable) |
| AI evaluation | ✅ code + 25 unit tests; needs migration 004 + provider key + trigger |
| Daily publication | ⬜ not started |
| Admin dashboard | ⬜ not started (data layer ready: `getModerationQueueAction`, `adminOverrideAction`) |

## 10. Known bugs and unresolved issues

1. **Proxy placement bug found + fixed during this job.** The first build
   silently ignored repo-root `proxy.ts` (project uses `src/`), so logged-out
   `/submit` returned 200 instead of redirecting to `/login`. Moved to
   `src/proxy.ts`; the rebuilt output now lists `ƒ Proxy (Middleware)`.
   **Action for the user: restart your dev server on port 3000** (it still
   runs the broken middleware) before relying on route protection.
2. **Lint warning (benign):** `src/app/error.tsx` uses `window.location.href`
   for "Back home" — rewrite with `useRouter().push` in a later cleanup.
3. **Profile page still mock-backed** (Stage 3 UI) — see DECISIONS D11.
4. **Submit page requires DB to be migrated** — before migrations run,
   recipient search errors gracefully ("Could not load classmates").
5. **`submission_authors` has no UPDATE policy by design** — authorship is
   immutable; admin edits go through the service role (Stage 7).
6. **Users stuck in `processing`** — stale claims (> 10 min) self-heal to
   `pending` on the next sweep.
7. **`/api/evaluate` is unauthenticated without `CRON_SECRET`** — the route
8. **Prefetch/pre-perf (2026-11-06):** dynamic pages now use a static
   shell + `<Suspense>` (Next 16 PPR rule: `connection()` and other dynamic
   reads must live inside Suspense boundaries). Dev-server latency in logs
   (proxy ~0.5–1s, Supabase ops ~1s/keystroke) is expected dev round-trip
   cost, not a code bug; production is faster.
   returns 503 until the secret is set; never expose it to the browser.

## 11. Outstanding tasks

1. User runs migrations **001 → 002 → 003 → 004** in Supabase SQL Editor.
2. User adds `NEXT_PUBLIC_SITE_URL=http://localhost:3000` + `CRON_SECRET`
   (random string) + LLM provider keys to `.env.local` and restarts dev.
3. User confirms: Google provider + URL config set (see `supabase/README.md`).
4. Manual two-account test (script below) + trigger test (see §15).
5. Stage 6 (daily publication) — only when explicitly authorised.

### Manual test script (run the dev server, then in a browser)

1. `/signup` two accounts (A and B), then log in as A.
2. A submits a **compliment** to B → success toast, usage meter 1/5.
3. A submits a **roast** to B → success, 2/5.
4. A submits the *identical* text to B → "already sent this exact submission".
5. A submits a 3rd (different) text to B → blocked ("already submitted 2 times").
6. A fills in 501 characters → counter blocks submission; 500 chars OK.
7. A tries to submit to themselves → self not in list; crafted UUID
   rejected server-side.
8. A submits 5 total → 6th shows "Daily limit reached".
9. Supabase SQL Editor: `select * from submissions order by created_at desc;`
   — new rows are `pending`; `submission_authors` maps them to A only.
10. As B, `select sender_id from submission_authors;` via SQL editor works
    (you're the owner) — **but** sign in as B in the app and confirm the
    homepage/submit screens never show who sent anything.

## 12. Exact next recommended task

**Run migration 004 + manual verify Stage 5 (steps 1–4 above + trigger
setup in §17), then — still pending authorisation hygiene — the two-account
submission test in §11. Then, on explicit authorisation only, start
**Stage 6: Daily Feed & Publication** (approved → published + daily collection
assembly, reaction persistence, archive, weekly rankings).

## 13. Instructions for the next AI model

1. Read `docs/HANDOFF.md` (this file), `docs/PROJECT_PLAN.md`,
   `docs/DECISIONS.md`.
2. Inspect `src/lib/supabase/submissions.ts`, `src/app/submit/composer.tsx`,
   `src/lib/validation/submission.ts`, and the three SQL migrations.
3. **Do not** invent Supabase credentials or assume migrations are applied —
   ask the user or check `supabase/README.md` steps.
4. **Do not** start Stage 6 without explicit authorisation.
5. After every job: update HANDOFF + PROJECT_PLAN + DECISIONS with what was
   done, what was tested, known issues, and the exact next task.
6. Never claim a test passed unless it was actually executed. Environment:
   Windows + PowerShell shell; npm via `npm.cmd` (PowerShell script execution
   is disabled). `.env.local` holds real secrets — never print or commit them.

## 14. Testing record (this job)

- `npm run build` — **PASS** (all routes listed, TypeScript clean; `/api/evaluate` registered).
- `npm run lint` — **PASS** (0 errors; 1 benign warning in `error.tsx`).
- `npm test` — **PASS, 25/25.** `tests/ai-evaluation.test.ts` (Node built-in
  runner, no new dependencies): weighted-score math; response validation
  (6 cases); low-confidence downgrade; all 9 moderation scenarios (compliment,
  roast, sarcastic observation, controversial joke, threat, discrimination,
  harassment, private info, ambiguous) via the deterministic mock provider;
  malformed → error; provider 500 → retry → give-up-flagged after 3 attempts;
  timeout non-completion; concurrent `processBatch` never double-evaluates;
  config errors propagate as `AiProviderError("config")`.
- Live DB/AI end-to-end: **NOT executed** — requires migration 004 + an LLM
  API key + one trigger wired (§15). No live AI calls were made.
- Dev server note: the user's port-3000 instance predates the Stage 5 route;
  restart it (`npm run dev`) before testing `/api/evaluate`.

### Verification note (production smoke test)

- Checked production `next start` (port 3105) against a fresh build:
  - `/login` → **200**, form renders ("Welcome back").
  - `/submit` logged-out → **307 → `/login?next=%2Fsubmit`** ✅.
  - `/` logged-out → **307 → `/login?next=%2F`** ✅.
  - `/signup` → **200**.
- The previously-running user dev server on port 3000 predates the proxy
  fix; restart it to pick up current middleware.

## 15. AI evaluation: architecture, triggers & admin review

**Code map**

- `src/lib/ai/types.ts` — shared types, `AiProviderError` (codes: timeout /
  malformed / upstream / auth / config).
- `src/lib/ai/prompt.ts` — system prompt encoding the D12 rules + user
  payload builder (content + public recipient info + history COUNTS only —
  sender identity is never included).
- `src/lib/ai/provider.ts` — `openai` / `anthropic` / `mock` adapters over
  `fetch` with timeout (default 25s), JSON-only responses, and retries (≤2)
  for retryable errors only (never for auth/config).
- `src/lib/ai/validate.ts` — strict response validation; rejects invalid
  statuses/scores/confidence; computes stored values: low-confidence
  approvals (< 0.65) downgrade to `flagged`; scores stored ONLY for approved.
- `src/lib/ai/scoring.ts` — weighted overall computed IN CODE
  (humour 40 / originality 25 / creativity 20 / relatability 15). The model
  never invents the final number. **Brief arithmetic note:** the brief's
  worked example (90/80/85/75 → 83.25) is an arithmetic slip; the formula
  yields **84.25**, which is what the code computes (see DECISIONS D16).
- `src/lib/ai/worker.ts` — `processBatch` / `processOne` over an injected
  `EvaluationStore`; stale-claim recovery (10 min), 3-attempt retry, then a
  `flagged` record with the failure reason.
- `src/lib/supabase/evaluation-store.ts` — Supabase implementation
  (service-role only): atomic claim (pending→processing compare-and-set +
  `claimed_at` guard), finalize guarded by claim timestamp, admin queue +
  `adminOverride`. `src/lib/supabase/admin-actions.ts` wraps those as
  `"use server"` actions for Stage 7.
- `/api/evaluate` (`GET ?limit=N`, `POST {submissionId}`) guarded by
  `Authorization: Bearer <CRON_SECRET>` (constant-time compare, 503 when the
  secret is unset). No submission is published here — Stage 6 owns that.

**Safety properties**

- Anonymity: the AI prompt contains no sender identity; moderation_records
  store no sender; the endpoint's JSON responses include ids/statuses only.
- Users cannot influence outcomes: the client never triggers evaluation;
  scores/statuses are only writable via the service role.
- Uncertainty never auto-rejects: low-confidence approvals → `flagged`.
- Config failures (missing key, 4xx) flag immediately without burning retries.

**Trigger setup — pick ONE** (the user never triggers evaluation):

1. **Option A (preferred): Supabase database webhook.** In the Supabase
   dashboard: Database → Webhooks → create an `INSERT` trigger on
   `public.submissions` → HTTP POST to
   `https://<your-app-domain>/api/evaluate` with custom header
   `Authorization: Bearer <CRON_SECRET>` and body `{{ "submissionId": "{{ record.id }}" }}`
   (exact body syntax per the webhook UI). Local dev: use a tunnel
   (ngrok / Cloudflare Tunnel) to expose localhost, or use Option B.
2. **Option B: Vercel Cron.** Add a `vercel.json` with
   `{ "crons": [{ "path": "/api/evaluate?limit=25", "schedule": "* * * * *" }] }`
   and set the `CRON_SECRET` env var in Vercel. Vercel Cron automatically
   sends `Authorization: Bearer <CRON_SECRET>`.
3. **Option C: pg_cron + pg_net** (all inside Supabase):
   `create extension if not exists pg_cron; create extension if not exists pg_net;`
   then
   `select cron.schedule('evaluate-pending', '* * * * *', $$
     select net.http_post(
       url := 'https://<your-app-domain>/api/evaluate?limit=25',
       headers := jsonb_build_object(
         'Authorization', 'Bearer <CRON_SECRET>',
         'Content-Type', 'application/json'),
       body := '{}'::jsonb);
   $$);`

Verify manually after wiring: submit a post, then
`curl "http://localhost:3000/api/evaluate?limit=1" -H "Authorization: Bearer $CRON_SECRET"`
(works for any option during local testing) and confirm the row moves
`pending → processing → approved/flagged`, with a row in `moderation_records`.
