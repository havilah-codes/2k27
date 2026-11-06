# Supabase setup for 2K27

## Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=<service role secret — server only, never commit>

# AI evaluation (Stage 5 — server only)
LLM_PROVIDER=openai                # openai | anthropic | mock
OPENAI_API_KEY=<your key>          # or ANTHROPIC_API_KEY
LLM_MODEL=gpt-4o-mini              # optional
LLM_TIMEOUT_MS=25000               # optional
LLM_MAX_RETRIES=2                  # optional
CRON_SECRET=<random string>        # guards /api/evaluate
```

Never expose the service role key or AI keys to the browser. The app only uses these server-side.

## Database migrations

In the Supabase Dashboard: **SQL Editor → New query**, paste and run in this order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_submission_limits.sql` (Stage 4 — 500 char limit + indexes)
4. `supabase/migrations/004_evaluation_pipeline.sql` (Stage 5 — `processing`
   claim state, attempts/errors, relatability/overall/confidence columns)

These create: `profiles`, `submissions`, `submission_authors`, `reactions`,
`reports`, `blocks`, `moderation_records`, `daily_collections`,
`daily_collection_items`, plus enums, constraints, indexes and Row Level
Security policies.

## Auth configuration (one-time manual steps)

1. **Authentication → Providers → Email**: optional/disabled — auth is
   Google-only now (nothing in the app uses email/password anymore).
2. **Authentication → Providers → Google**: **required**. Steps:
   1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
      and create a project (or use an existing one).
   2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
      application type **Web application**.
   3. **Authorized redirect URI**: paste exactly this (replace with your
      project ref from `NEXT_PUBLIC_SUPABASE_URL`):
      `https://plptnjemiliixxzkwibm.supabase.co/auth/v1/callback`
   4. Copy the **Client ID** and **Client Secret**.
   5. Back in Supabase: **Authentication → Providers → Google** → toggle ON,
      paste Client ID + Client Secret → Save.
   6. Publish the Google consent screen if Google asks (Testing → "Publish
      app" in OAuth consent screen) or only test accounts you added will work.
   7. Restart the dev server (kills the stale port-3000 instance) and click
      **Continue with Google** on `/login` or `/signup`.
   8. First-time Google users land on a profile-completion step (username +
      class); display name is prefilled from Google.
3. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/**`
4. **Email provider can stay enabled or be disabled** — the app no longer
   uses email/password at all, so neither "Confirm email" nor
   `SCHOOL_EMAIL_DOMAIN` matter anymore.

## AI evaluation trigger (Stage 5 — pick ONE)

Submissions enter as `pending`; the background worker at `/api/evaluate`
(Bearer `CRON_SECRET`) evaluates them. Wire exactly one trigger:

1. **Supabase database webhook (recommended):** Dashboard → **Database →
   Webhooks** → new webhook on `INSERT` on `public.submissions` → HTTP POST
   to `https://<app-domain>/api/evaluate` with custom header
   `Authorization: Bearer <CRON_SECRET>` and JSON body
   `{ "submissionId": "{{ record.id }}" }` (match the exact syntax the
   webhook UI shows). For local dev, expose localhost with a tunnel
   (ngrok / Cloudflare Tunnel) or use option 2.
2. **Vercel Cron:** add `vercel.json` with
   `{ "crons": [{ "path": "/api/evaluate?limit=25", "schedule": "* * * * *" }] }`
   and set `CRON_SECRET` in Vercel env.
3. **pg_cron + pg_net** (pure SQL):
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   select cron.schedule('evaluate-pending', '* * * * *', $$
     select net.http_post(
       url := 'https://<app-domain>/api/evaluate?limit=25',
       headers := jsonb_build_object(
         'Authorization', 'Bearer <CRON_SECRET>',
         'Content-Type', 'application/json'),
       body := '{}'::jsonb);
   $$);
   ```

Verify with:
`curl "http://localhost:3000/api/evaluate?limit=1" -H "Authorization: Bearer <CRON_SECRET>"`
After a submit, the row should move `pending → processing → approved/flagged`
with a `moderation_records` entry (scores + reasons; no sender identity).

## Roles

- New profiles default to `student`. Role escalation is blocked at the
  database level for authenticated users.
- To create the first admin, run in the SQL Editor (as the project owner):

```sql
update public.profiles
set role = 'admin'
where username = '<your username>';
```

Only do this after the user has signed up and a profile row exists.
