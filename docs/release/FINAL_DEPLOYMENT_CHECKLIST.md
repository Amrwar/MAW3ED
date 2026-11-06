# Final deployment checklist

For merging branch `final-audit` and for every later production deploy.
Tick each item with the evidence (a command output, a URL, a run id). Never
write "done" without it.

## A. This release (`final-audit`)

| # | Step | Who | Evidence required |
|---|---|---|---|
| 1 | CI green on the PR (typecheck, lint, audits, unit tests, build) | CI | PR checks |
| 2 | No migration in this release: confirm `git diff d9e8ece..HEAD -- prisma/` is empty | Engineering | Command output |
| 3 | Deploy staging from the branch; signed-out smoke: `/api/health` 200, `/login` 200, `/dashboard` → sign-in, `/api/v1/organization` 401 | Engineering | curl codes |
| 4 | Staging signed in: open `/dashboard/check-in`, press "scan": the browser **asks** for the camera (F-02) | Owner (device) | Screenshot |
| 5 | Staging: sign in, "sign out everywhere" in another browser, reopen `/dashboard` in the first: lands on the sign-in form, **no redirect loop** (F-27) | Engineering | Browser |
| 6 | Merge (owner) | Owner | Merge commit |
| 7 | Production serves the merge commit (`/api/version`); signed-out smoke as step 3 | Engineering | curl |
| 8 | **Run "Database backup" by hand** (Actions → Database backup → Run workflow) and confirm an artifact `maw3ed-db-<stamp>` exists (F-01) | Owner | **Done 2026-11-05**: run 42083812601, `maw3ed-db-20261105-1823` |
| 9 | Restore that artifact into a scratch database once (`scripts/backup-restore-drill.sh`); compare table counts | Owner / Engineering | **Done 2026-11-05**: 0 errors |
| 10 | Uptime monitor on `https://www.maw3ed.net/api/health` (200 healthy, 503 database down); alert on two consecutive failures | Owner | **Done**: `.github/workflows/uptime.yml`, every 5 min (GitHub may run it late); opens an `uptime` issue when down, closes it when back. Optional: a 1-minute external monitor (UptimeRobot or Better Stack, owner's account) |
| 11 | Sentry alert rules: the ten rules listed in `POST_LAUNCH_MONITORING.md` (1–5 before launch); confirm six green Cron Monitors a day after deploy | Owner | Rule list; Crons page |

## B. Every production deploy

1. **Migrations first, by the owner, before the merge.** Every migration is
   additive and idempotent. Run the prepared script, which prints
   `VERIFIED` from its verify block. Never `prisma db push` or `migrate dev`
   against staging or production (D-01).
2. Staging migrated and deployed first; rollback rehearsed when the release
   adds routes or crons.
3. CI green on the PR.
4. Merge; watch the Vercel build; confirm `/api/version` shows the commit.
5. Signed-out smoke (above) and one signed-in check of the changed area.
6. Watch Sentry and `/api/health` (with the cron secret: job freshness) for
   one hour.

## C. Rollback

- **Code:** Vercel → Deployments → previous production → *Instant
  Rollback*, or `vercel rollback <url>`. Rehearsed on staging: 5 s each way
  (`docs/phases/PHASE_28_REPORT.md`). Expect the edge to serve the old
  answer for a few seconds.
- **Database:** never rolled back with the code. Migrations are additive, so
  the older code runs on the newer schema. A destructive migration needs its
  own reviewed plan.
- **Features:** `FEATURE_FLAGS_OFF=enterpriseApi,webhooks,automations,waitlist`
  (any subset) switches a Phase 27/28 subsystem off without a deploy of new
  code (an environment change and redeploy).

## D. Environment (production, names only)

Must be set: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_URL`/`NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
`NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `PSEUDONYM_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, Paymob (4), Stripe (2), WhatsApp (token, number, templates),
Cloudinary (3). All present on 2026-11-05.

Optional: `EMAIL_FROM_BILLING` (subscription mail sender and reply-to). Unset, it is
`billing@` on `EMAIL_FROM`'s domain, which must then receive mail (on maw3ed.net it is an
alias on the Workspace mailbox).

Must **not** be set in production: `PAYMOB_FAKE`, `ACCESS_SANDBOX`, `WEBHOOK_ALLOW_PRIVATE`,
`SITE_NOINDEX`, `BOOKING_PHONE_VERIFICATION` (until M-03 is fixed). None set on 2026-11-05.

Still missing (mobile release): `APPLE_TEAM_ID`, `ANDROID_CERT_SHA256`.
