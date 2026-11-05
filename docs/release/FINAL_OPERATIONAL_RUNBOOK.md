# Final operational runbook

One page for running MAW3ED in production. It links the detailed runbooks
rather than repeating them:
- `docs/runbooks/BOOKING_OPERATIONS.md`
- `docs/runbooks/PAYMENT_OPERATIONS.md`
- `docs/runbooks/ORGANIZATION_OPERATIONS.md`
- `docs/runbooks/SECURITY_OPERATIONS.md`
- `docs/enterprise/OPERATIONS_RUNBOOK.md`
- `docs/legal/INCIDENT_RESPONSE_POLICY.md`

## Where things are

| Need | Go to |
|---|---|
| Is it up? | `https://www.maw3ed.net/api/health`; which build: `/api/version` |
| Jobs, queues, reconciliation | Admin → Operations (`/admin/operations`), or `/api/health` with the cron secret |
| Errors | Sentry project (DSN set in production) |
| Logs | Vercel → `maw-3-ed` → Logs |
| Database | Neon console (production and staging are separate projects) |
| Test environment | `https://maw3ed-staging.vercel.app` (fictional data, `docs/staging.md`) |

## Scheduled jobs (`vercel.json`)

| Job | Does | Bound | If it fails |
|---|---|---|---|
| `reminders` | Reminders, starting-soon, review requests, abandoned-payment reaper | 1,000 nearest bookings; 500 payments; 300 s | Re-run is safe (idempotent claims) |
| `notifications` | Outbox re-drive | 200 per run, 5 attempts | Rows stay FAILED with a retry time |
| `subscriptions` | Plan expiry and prunes | 500 + 500 | Safe to re-run |
| `operations` | Waitlist, loyalty and package expiry, Phase 27 messages | 240 s deadline, 2,000 rows per job; reports `skipped` | Skipped jobs run next time |
| `access` | Visitor-pass sync and reconciliation | 30 s / 50 items | Jobs back off, then DEAD |
| `integrations` | Webhook feed and delivery | 20 s feed, 25 s / 50 sends | Deliveries back off, then DEAD |

Every run is recorded in `CronRun`. A missing `CRON_SECRET` shows as a
failed run.

## Common incidents

| Symptom | Likely cause | Action |
|---|---|---|
| Everything 500s | Database unreachable | `/api/health` 503 confirms; Neon status; no code action. The rate limiter fails open (accepted, S-09 in `SECURITY_REPORT.md`) |
| Bad deploy | Regression | Instant Rollback (5 s, rehearsed). Migrations stay (additive) |
| A subsystem misbehaves (webhooks, automations, waitlist, enterprise API) | Bug or partner problem | `FEATURE_FLAGS_OFF=<name>` and redeploy |
| Customers not getting messages | Provider down or template rejected | Operations page → DEAD/FAILED deliveries; provider dashboard; the outbox re-drives on its own when the provider returns |
| Payment taken, booking not confirmed | Late webhook | The webhook revives a released hold (re-taking points and the discount; F-12); otherwise refund from Admin → Payments (SUPER_ADMIN) |
| A gate provider is down | Outage | Passes back off; the venue desk keeps paste/type check-in |
| A suspicious organization | Abuse | Admin → Organizations → suspend. Its API keys, webhooks, delegation and now its venues and desk stop at once (F-22) |
| Lost phone | Account takeover risk | The customer or owner uses "sign out everywhere" (sessions and push tokens end; the web is refused within 5 min) |

## Never do

- `prisma db push` / `prisma migrate dev` against staging or production (drops SQL-only indexes, D-01).
- Set `PAYMOB_FAKE`, `ACCESS_SANDBOX`, `WEBHOOK_ALLOW_PRIVATE` or `SITE_NOINDEX` in production.
- Set `BOOKING_PHONE_VERIFICATION=1` before M-03 is fixed: every app booking would fail.
- Configure real Emaar or Eterna data: it is a concept, with no agreement.
