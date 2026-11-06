# 2K27 — Project Plan & Roadmap

**Product:** Anonymous, student-driven comedy platform. Students submit
compliments / roasts / jokes / observations about classmates; an AI pipeline
filters and ranks them; the best are published daily.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Framer Motion ·
Lucide React · Supabase (Auth + Postgres + RLS) · Vercel deployment.

---

## Stage 1 — Foundation ✅ COMPLETE

- [x] Next.js 16.4.5 scaffold (TypeScript strict, App Router, `src/`)
- [x] Tailwind CSS v4 with design tokens (warm editorial paper palette)
- [x] Framer Motion + Lucide React installed
- [x] Folder structure: `src/app`, `src/components/{layout,ui}`, `src/lib/{supabase,validation}`, `supabase/migrations`, `docs/`
- [x] Root layout, global styles, print-safe `globals.css`
- [x] Documentation system established (this file + HANDOFF + DECISIONS)

## Stage 2 — Database & Authentication ✅ CODE COMPLETE (user action: run migrations)

- [x] Supabase packages: `@supabase/ssr`, `@supabase/supabase-js`
- [x] Browser / server / admin (service-role) clients
- [x] `.env.example` + `supabase/README.md`
- [x] Migrations `001_initial_schema.sql`, `002_rls_policies.sql`
- [x] RLS on all 9 user-facing tables; anonymity by schema design
- [x] Auth actions (signup/login/logout), profile creation, role protection
- [x] Session-refresh proxy + protected routes
- [ ] **User must run migrations 001 → 002 → 003 in Supabase SQL Editor**
- [ ] **User must confirm Email provider enabled + Site URL/Redirect URLs set**
- [ ] **User must set `NEXT_PUBLIC_SITE_URL` + optional `SCHOOL_EMAIL_DOMAIN`**
- [ ] End-to-end signup → profile → login verification (needs user testing)

## Stage 3 — Core Interface ✅ COMPLETE

- [x] App shell: header, mobile tab bar, responsive containers
- [x] Homepage (daily feed UI, mock data, empty/loading states)
- [x] Submit page UI (mock), Hall of Fame UI (mock), Profile UI (mock)
- [x] Reusable components: Button, Card, Avatar, SectionHeading, CategoryBadge,
      ReactionBar, EmptyState, Skeletons, Modal, Input/Textarea, SubmissionCard
- [x] Loading / error / not-found states, Framer Motion transitions
- [x] Build + lint clean (1 benign warning in error.tsx)

## Stage 4 — Submission System ✅ CODE COMPLETE (user action: run migration 003 + register 2 users)

- [x] Live recipient search (profiles table, public fields only, self/block exclusion)
- [x] Random recipient selection (server-side, eligible pool)
- [x] Composer wired to server action; 500-char limit; live counter
- [x] Server validation (UUID, category allowlist, length) — `src/lib/validation/submission.ts`
- [x] `createSubmission` server action: session-derived sender, forced `pending`
      status, limits (5/day, 2/recipient/day, duplicate detection, self-submit,
      block checks), rollback on author-map failure
- [x] Migration `003_submission_limits.sql` (500-char check + indexes)
- [x] Daily-usage meter from `submission_authors` (sender-private read)
- [x] Build + lint pass; proxy/smoke checks (see HANDOFF testing section)
- [ ] **User must run migration 003**
- [ ] Manual end-to-end test with 2 accounts (see HANDOFF manual test script)
- [ ] Stage 5/6 NOT started (by design)

## Stage 5 — AI Evaluation Engine ✅ CODE COMPLETE (user action: migration 004 + provider key + trigger)

- [x] Modular LLM provider (`openai` / `anthropic` / `mock`), server-side keys only
- [x] Structured moderation JSON encoding the limited rules (D12); freedom-of-expression guardrails
- [x] Comedy scoring (humour 40 / originality 25 / creativity 20 / relatability 15) — weighted in code
- [x] Single-call evaluation → `moderation_records` (+ migration 004 score columns)
- [x] Atomic claim queue (`processing`), stale recovery, 3-attempt retry → flagged
- [x] Secret-guarded `/api/evaluate` (cron/webhook trigger; no frontend trigger)
- [x] Admin review data layer (`getModerationQueueAction`, `adminOverrideAction`)
- [x] 25 unit tests (`npm test`) — mock provider, no live AI calls
- [ ] **User must run migration 004**
- [ ] **User must set LLM key + `CRON_SECRET` and wire ONE trigger (§15 HANDOFF)**
- [ ] Live end-to-end check (submit → pending → approved/flagged)
- [ ] Stage 6 NOT started (by design)

## Stage 6 — Daily Feed ⬜ NOT STARTED

- [ ] Publication logic (approved → `published` + `daily_collections` assembly)
- [ ] Real homepage feed queries (replace mock data)
- [ ] Reaction persistence, daily highlights, archive, weekly rankings
- [ ] Feed performance optimisation

## Stage 7 — Administration & Safety ⬜ NOT STARTED

- [ ] Admin dashboard (moderation queue, report review, AI decision review)
- [ ] Content removal, account suspension, blocking UI
- [ ] Analytics; permission/access-control tests

## Stage 8 — Testing & Deployment ⬜ NOT STARTED

- [ ] Full auth / DB-security / RLS / submission / AI / publication / responsive tests
- [ ] Performance optimisation; production env vars
- [ ] Vercel deployment + production verification

---

## Acceptance criteria tracking

| Stage | Criterion | Status |
|-------|-----------|--------|
| 4 | Recipient selection (manual + random) works | Code done; manual test pending user accounts |
| 4 | Server validation + limits enforced | Code done (unit-testable; see HANDOFF) |
| 4 | `status = pending` on every new submission | Code guarantees it |
| 4 | Sender identity never exposed to students | Guaranteed by schema + RLS + server-only mapping |
| 4 | Auth + Stage 3 UI intact | Build/lint pass; dev smoke test done |
| 5 | Provider integration (openai/anthropic/mock) | Code done; needs user API key |
| 5 | Moderation outcomes (approved/rejected/flagged) | Code + tests done |
| 5 | Weighted scores computed in code | Code + tests done |
| 5 | Async processing, dedupe claim, retries | Code + tests done (live trigger pending) |
| 5 | Admin review data | Code done (no UI — Stage 7) |
