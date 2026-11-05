# Post-launch monitoring

What to watch after launch, where it comes from in the code, and what to do
when it moves. The signals exist today. The liveness alert is the "Uptime" workflow
(`.github/workflows/uptime.yml`). The other alert rules need setting up by
the owner: none could be verified from this repository.

## Signals

| Signal | Source | Healthy | Alert when | First response |
|---|---|---|---|---|
| Liveness | `GET /api/health` (anonymous: one `SELECT 1`) | 200 `{"status":"ok"}` | Two consecutive failures, 60 s apart: the "Uptime" workflow (every 5 min) fails and opens an `uptime` issue; closes it on recovery | Neon status; Vercel status; recent deploy → rollback |
| Job freshness and queues | `GET /api/health` with `Authorization: Bearer $CRON_SECRET` (`lib/ops/health.ts`) | Every job within its SLA (`JOB_SLA_MINUTES`); queues small | A job late or failing (Sentry Cron Monitors alert on missed or failed runs); a queue growing for an hour | Admin → Operations; the job's `CronRun` rows; Vercel function logs |
| A missing `CRON_SECRET` | Recorded as a failed run (Phase 28) | — | Every job failing at once | Restore the variable |
| Errors | Sentry (server, edge and client render errors since F-35) | — | New issue on `/api/public/*/bookings`, `/api/webhooks/*`, `/api/auth/*`; any spike | Sentry issue → logs by request id |
| Notification delivery | `NotificationDelivery` statuses (Admin → Operations) | Mostly SENT/SKIPPED | DEAD rising; FAILED older than 2 h | Provider status (Resend, Meta); `docs/runbooks/BOOKING_OPERATIONS.md` |
| Webhooks to organizations | `WebhookDelivery`, endpoint `consecutiveFailures` | — | An endpoint auto-disabled (20 failures) | Tell the organization; re-enable from its console |
| Access sync | `AccessSyncJob` DEAD | 0 | Any DEAD | Provider outage → venue desk paste/type fallback |
| Payment reconciliation | Admin → Operations → reconciliation (`lib/payments/reconcile.ts`) | No discrepancies | Any refund-sum, over-refund, missing receipt, held-but-paid | `docs/runbooks/PAYMENT_OPERATIONS.md` |
| Overpayment | Audit `payment.overpaid` (F-14) | none | Any | Refund the excess |
| Discount over cap | Audit `booking.discount_over_cap` (F-12) | none | Any | Decide with the business |
| Rate limiting | 429s in logs | Low | Sustained 429s on login or booking | Possible attack: Vercel Firewall |
| Backups | "Database backup" workflow | Weekly success with an artifact | Any failure | Re-run; check secrets |
| Core Web Vitals | Vercel Speed Insights / Search Console (field data) | LCP < 2.5 s, INP < 200 ms, CLS < 0.1 | Regression after a deploy | Compare deploys |

## Sentry alert rules (owner creates these)

What reaches Sentry: page and route crashes, and every `error` and `warn`
line of the app's logger (`src/instrumentation.ts`), with the message text
as written in the code. Personal data is scrubbed first (`sentry-shared.ts`).

Create each in **Sentry → Alerts → Create Alert** with **Environment =
production**, or previews will alert too. Turn on **Settings → Spike
Protection**. After creating rule 3, use "Send Test Notification" once.

**Before launch**

| # | Type | Name | When | Filter | Action |
|---|---|---|---|---|---|
| 1 | Issue | Money path | Any new event | Message contains `[stripe webhook]`, `[paymob webhook]` or `[payments]` | Email at once; at most every 5 min |
| 2 | Issue | Background jobs failing | Any new event | Message contains `cron] failed`, `[cron-run]` or `re-drive failed` | Email; at most every 30 min |
| 3 | Issue | New production error | A new issue is created | Level is error or above | Email |
| 4 | Issue | Regression | A resolved issue happens again | Level is error or above | Email |
| 5 | Issue | Booking API errors | More than 5 events in 10 min | URL contains `/api/public/` and `/bookings` | Email |

**First week**

| # | Type | Name | When | Filter | Action |
|---|---|---|---|---|---|
| 6 | Issue | Notifications given up | More than 10 events in 1 h | Message contains `[notify] delivery given up` or `[notify] dispatch failed` | Email (WhatsApp/Resend outage or expired token) |
| 7 | Issue | Sign-in trouble | More than 20 events in 10 min | URL contains `/api/auth/` or `/api/mobile/` | Email (broken sign-in or an attack) |
| 8 | Metric | Error spike | Errors in 5 min: warning above 20, critical above 50 | — | Email |
| 9 | Issue | Browser crashes | More than 10 users affected in 1 h | Platform is javascript | Email |

**When a gate partner is live**

| # | Type | Name | When | Filter |
|---|---|---|---|---|
| 10 | Issue | Gate access jobs | Any new event | Message contains `[access] job dead-lettered` or `[access] escalation raised` |

Rules 3, 4 and 9 skip warnings; 1, 2 and 6 deliberately include them. The
site being down is covered by the "Uptime" workflow, not Sentry.

**Cron Monitors (automatic).** Each scheduled job checks in to Sentry when
it starts and ends (`src/lib/ops/cron-monitor.ts`), as monitors
`cron-reminders`, `cron-notifications`, `cron-subscriptions`,
`cron-operations`, `cron-integrations` and `cron-access`. Sentry creates them
on the first run, with the `vercel.json` schedules, a 5-minute margin, a
6-minute maximum run and an issue after two failed or missed runs in a row.
Only the production site checks in (`VERCEL_PROJECT_PRODUCTION_URL` on
`maw3ed.net`); `SENTRY_CRON_MONITORS=0` turns them off. Check **Sentry →
Crons** a day after deploying: six monitors, all green. Set each monitor's
alert to email the owner (Crons → monitor → Alerts) if Sentry did not by
default.

## First week after launch

- Daily: Sentry new issues, the Operations page, reconciliation.
- After the first real Paymob and Stripe payment and refund: confirm the
  ledger, the receipt number and reconciliation agree.
- After the first real WhatsApp OTP and reminder: confirm delivery rows say
  SENT and the customer received them.
- Weekly: the backup artifact exists. Monthly: restore it (`scripts/backup-restore-drill.sh`, passphrase from the password manager).
