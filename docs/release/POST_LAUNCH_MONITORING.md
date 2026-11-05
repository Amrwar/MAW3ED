# Post-launch monitoring

What to watch after launch, where it comes from in the code, and what to do
when it moves. The signals exist today. The alert rules need setting up by
the owner: none could be verified from this repository.

## Signals

| Signal | Source | Healthy | Alert when | First response |
|---|---|---|---|---|
| Liveness | `GET /api/health` (anonymous: one `SELECT 1`) | 200 `{"status":"ok"}` | Two consecutive non-200s | Neon status; Vercel status; recent deploy → rollback |
| Job freshness and queues | `GET /api/health` with `Authorization: Bearer $CRON_SECRET` (`lib/ops/health.ts`) | Every job within its SLA (`JOB_SLA_MINUTES`); queues small | A job late or failing; a queue growing for an hour | Admin → Operations; the job's `CronRun` rows; Vercel function logs |
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

## First week after launch

- Daily: Sentry new issues, the Operations page, reconciliation.
- After the first real Paymob and Stripe payment and refund: confirm the
  ledger, the receipt number and reconciliation agree.
- After the first real WhatsApp OTP and reminder: confirm delivery rows say
  SENT and the customer received them.
- Weekly: the backup artifact exists and restores.
