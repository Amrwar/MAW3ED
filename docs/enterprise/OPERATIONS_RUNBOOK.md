# Operations runbook

For whoever is on call. Complements `docs/runbooks/*` (bookings, organizations, payments,
security).

## Health and alerting

- `GET https://www.maw3ed.net/api/health` → `{ "status": "ok" | "degraded" }` (200) or 503 when
  the database does not answer. Point an uptime monitor at it (every 1–5 min); alert on 503 or
  on `degraded` for more than 15 minutes.
- With `Authorization: Bearer <CRON_SECRET>` it returns the detail: database latency, each
  job's last success and whether it is **late** (allowance: reminders 90 min, notifications
  30, operations 30, access 20, integrations 20, subscriptions 26 h), and queue depths.
- Admin → **Operations** shows the same, the last 60 job runs, the feature flags, and payment
  reconciliation.
- Errors: Sentry (server, edge, client). Alert rules to set in Sentry: new issue; issue
  frequency > 10/min; any error tagged `cron`.

`degraded` means one of: a job is late; database > 2 s; an access sync job died in 24 h;
more than 50 notifications died in 24 h.

## Scheduled jobs (vercel.json)

| Job | Every | Bound per run | If late |
|---|---|---|---|
| reminders | hour | bounded batches | check Sentry; run by hand with the cron secret |
| notifications | 10 min | 200 rows | provider down? retries resume by themselves |
| operations | 10 min | 2,000 rows per job; each job isolated | look at `failed` in the last run's summary |
| access | 5 min | 30 s budget, 10 jobs | provider health on the venue's integrations panel |
| integrations | 5 min | 200 bookings per endpoint, 50 deliveries, 25 s | see webhooks below |
| subscriptions | daily 05:00 | bounded | plans expire a day late at worst |

Run one by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://www.maw3ed.net/api/cron/<job>`.
Every job is idempotent.

## Webhooks

- Failing endpoint: Console → Integrations shows status, failures in a row, last error per
  delivery. After 20 failures in a row the endpoint switches itself off (audited); the
  organization switches it back on when fixed. DEAD deliveries are not resent automatically.
- To stop all webhooks platform-wide: set `FEATURE_FLAGS_OFF=webhooks` in Vercel and
  redeploy. Deliveries wait (they are not lost) until the flag is removed.

## Enterprise API

- A leaked key: the owner revokes it (Console → Integrations); immediate. The platform can
  also end the organization's contract (keys stop with 403) or set
  `FEATURE_FLAGS_OFF=enterpriseApi` (all keys, 503).
- Abuse: per-key rate limit from the contract; lower `apiRequestsPerMinute`.

## Venue access providers

- One venue's provider failing: its jobs retry with backoff (30 s … 1 h, 6 attempts) and then
  die; other venues are unaffected. The venue's desk shows the state; the venue manager can
  switch visitor passes off. Revoke the venue's credential if it is compromised (Admin →
  venue → Venue credential); only that venue stops.

## Feature flags

`FEATURE_FLAGS_OFF` (comma-separated): `enterpriseApi`, `webhooks`, `automations`,
`waitlist`. Unset = everything on. Change in Vercel → redeploy (≈ 2 min).

## Deployments and rollback

- Production deploys from `main` (Vercel). **Rollback**: Vercel → Deployments → the previous
  production deployment → *Instant Rollback* (or `vercel rollback <url>`); no rebuild. Verified
  on staging during Phase 28 (see `docs/phases/PHASE_28_REPORT.md`).
- A rollback does not undo a database migration. Every migration in this project is additive
  and idempotent, so older code keeps working on a newer schema; that is why rollback is safe.
  Never deploy a destructive migration without a separate, reviewed plan.

## Backups and restore

- Production: Neon point-in-time restore (window per the Neon plan — check it; 6 h was
  recorded in `docs/runbooks/SECURITY_OPERATIONS.md`) and manual snapshots before each
  migration (`pg_dump -Fc`).
- Restore drill (QA, Phase 28): `pg_dump -Fc` → `pg_restore` into a fresh database → row
  counts of all 92 tables, constraints (229), triggers and indexes (333) identical, the search
  function works; 3 s for the QA dataset. Repeat quarterly and before risky migrations.
- To restore production: create a Neon branch at the timestamp before the incident, verify it,
  point `DATABASE_URL` at it (or restore into the main branch), redeploy.

## Payments

Admin → Operations → Payment reconciliation (or `/api/admin/payments/reconciliation`):
totals per provider and kind, and payments whose ledger does not add up (refund sum, status,
over-refund, missing receipt, deposit paid but booking held). Investigate each; never edit
amounts by hand without an audit note. `docs/runbooks/PAYMENT_OPERATIONS.md`.
