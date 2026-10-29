# Payment and notification operations runbook

Money and messages. Read with `docs/runbooks/BOOKING_OPERATIONS.md`.
SQL is read-only unless marked **WRITE**. Refunds leave the system only
through `/admin/payments` (super admin) or the Paymob dashboard; never
by editing rows.

## 1. How a payment is supposed to go

1. The booking is created `PENDING_PAYMENT` and a `Payment` row is
   opened `PENDING` **before** the customer is sent anywhere, so an
   abandoned checkout leaves a trace, not silence.
2. Paymob's hosted page takes the card. Nothing the browser says
   afterwards is believed: `/payment/return` only reads the booking's
   status from the database and the app polls the same.
3. Paymob calls `POST /api/webhooks/paymob`. In order, and none optional:
   HMAC verified (403 otherwise) → delivery claimed by Paymob's
   transaction id in `WebhookEvent` (a replay is `duplicate: true` and
   does nothing) → payment found by order id → refund/void recorded as
   such → amount and currency checked → settled or failed **in one
   transaction with the booking move**.
4. A `pending` callback (wallets, kiosks) releases its claim so the final
   callback under the same id is processed; a failure arriving after a
   success is ignored (`already-resolved`).
5. Only `settlePayment()` writes `SUCCEEDED`, only from the webhook, and
   only once: a second settlement assigns no second receipt number and
   runs no side effect.

Receipts are `MW-000123` from a sequence, never a count.

## 2. "The customer paid and the booking is not confirmed"

```sql
SELECT p.id, p.status, p."amountCents", p.currency, p."providerOrderId", p."providerTransactionId",
       p."receiptNumber", p."failureReason", p."createdAt", p."paidAt",
       b.status AS booking_status, b."paymobOrderId"
  FROM "Payment" p LEFT JOIN "Booking" b ON b.id = p."bookingId"
 WHERE b."customerPhoneE164" = '2010XXXXXXXX' OR p."providerOrderId" = '<order id from Paymob>'
 ORDER BY p."createdAt" DESC;

SELECT * FROM "WebhookEvent" WHERE "eventId" = '<transaction id>' OR "receivedAt" > now() - interval '1 day' ORDER BY "receivedAt" DESC LIMIT 20;
```

| You see | It means | Do |
|---|---|---|
| no `WebhookEvent` for the transaction | the callback never arrived | Paymob dashboard → transaction → resend callback. Check the callback URL is `https://www.maw3ed.net/api/webhooks/paymob` and `PAYMOB_HMAC_SECRET` matches. |
| event with `outcome = null` and `processedAt = null` | the handler threw and the claim was released; Paymob should retry | server log `[paymob webhook] handler threw`; fix the cause; resend. |
| `amount-mismatch` / `currency-mismatch` | Paymob charged something other than what we opened | payment `FAILED`, booking released. Refund from the Paymob dashboard (the ledger records that reversal when its callback arrives). |
| `paid-after-release` | paid after the 2-hour hold expired and the time was taken by somebody else | money is recorded; `AuditLog payment.paid_after_release`. Refund or rebook — call the customer. |
| `booking-revived` | paid late but the time was still free | nothing; the booking is `CONFIRMED`. |
| `payment.unexpected_deposit` in `AuditLog` | the booking had already been cancelled or confirmed by other means | refund it from `/admin/payments`. |
| payment `SUCCEEDED`, booking still `PENDING_PAYMENT` | should not happen (same transaction) | the settlement callback threw after the payment update? Check log; move the booking by hand (**WRITE**, below) only after confirming the money in Paymob. |

**WRITE**, last resort, after reading the row:
`UPDATE "Booking" SET status = 'CONFIRMED' WHERE id = '<id>' AND status = 'PENDING_PAYMENT';`

## 3. Refunds

- Issued from `/admin/payments` by a super admin (`payments.refund`).
  The amount is **reserved first** (a conditional `UPDATE` on
  `refundedCents` that refuses to exceed the amount, so two admins cannot
  both refund the last pound), then a `Refund` row is written `PENDING`,
  then Paymob is asked.
- Paymob said yes → `Refund.SUCCEEDED`, payment `REFUNDED` or
  `PARTIALLY_REFUNDED`.
- Paymob said no (4xx, or `success:false`) → reservation released,
  `Refund.FAILED`. Retrying is safe.
- **Paymob did not answer** (timeout, network, 5xx) → the reservation is
  **kept**, the row stays `PENDING` with `failureReason = 'uncertain: …'`,
  and the admin is told not to repeat it (`code: refund-uncertain`).
  Settle it one of two ways:
  1. Wait: Paymob's own refund callback arrives at the webhook and is
     matched to the pending row by amount (`reversal-matched-admin-refund`),
     which marks it `SUCCEEDED`.
  2. Look in the Paymob dashboard. If the refund is there, nothing else
     is needed beyond (1). If it is not, release it by hand (**WRITE**):
     ```sql
     UPDATE "Refund"  SET status = 'FAILED', "failureReason" = 'not in Paymob dashboard; released by <name>' WHERE id = '<refund id>' AND status = 'PENDING';
     UPDATE "Payment" SET "refundedCents" = GREATEST(0, "refundedCents" - <amount>) WHERE id = '<payment id>';
     ```
- A refund made in the Paymob dashboard is recorded by the webhook as a
  `Refund` with `actorName = 'Paymob'`, never past the payment's amount.
  The booking is not changed by it: decide that separately.
- Cancelling a booking never refunds. `AuditLog
  booking.released_with_money` lists the ones that need a decision:
  ```sql
  SELECT at, "resourceId" AS booking_id, summary FROM "AuditLog"
   WHERE action = 'booking.released_with_money' ORDER BY at DESC LIMIT 50;
  ```

## 4. Reconciliation (weekly, or before paying a business out)

Ledger against itself:

```sql
-- Payments whose refunds do not add up to refundedCents
SELECT p.id, p."refundedCents", COALESCE(SUM(r."amountCents") FILTER (WHERE r.status = 'SUCCEEDED'), 0) AS refunded_rows
  FROM "Payment" p LEFT JOIN "Refund" r ON r."paymentId" = p.id
 GROUP BY p.id HAVING p."refundedCents" <> COALESCE(SUM(r."amountCents") FILTER (WHERE r.status = 'SUCCEEDED'), 0);

-- Refunds still pending after a day: see § 3
SELECT * FROM "Refund" WHERE status = 'PENDING' AND "createdAt" < now() - interval '1 day';

-- Webhook deliveries claimed but never closed
SELECT * FROM "WebhookEvent" WHERE "processedAt" IS NULL AND "receivedAt" < now() - interval '1 hour';

-- Holds older than the reaper's window (should be none while the hourly cron runs)
SELECT id, "createdAt" FROM "Booking" WHERE status = 'PENDING_PAYMENT' AND "createdAt" < now() - interval '3 hours';

-- Money taken per business, net of refunds, this month
SELECT "businessId", SUM("amountCents" - "refundedCents") AS net_cents
  FROM "Payment" WHERE status IN ('SUCCEEDED','PARTIALLY_REFUNDED') AND kind <> 'SUBSCRIPTION'
   AND "paidAt" >= date_trunc('month', now()) GROUP BY 1 ORDER BY 2 DESC;
```

Ledger against Paymob: export the month's transactions from the Paymob
dashboard and compare on `providerTransactionId`. Anything in Paymob and
not here is a callback that never arrived (§ 2); anything here as
`SUCCEEDED` and not in Paymob is a forged callback and a security
incident (rotate `PAYMOB_HMAC_SECRET`, read the webhook log).

`/api/admin/payments/diagnostics` answers "are the Paymob credentials
right at all" without charging anything.

## 5. Notifications: the outbox

Every message is a row in `NotificationDelivery`, keyed by
event + booking + recipient + channel (`dedupeKey`), so the same thing is
never sent twice however many times a cron, a webhook retry or a
double-tap asks.

| `status` | Means |
|---|---|
| `PENDING` | claimed; the provider has not answered yet. Older than 5 minutes = the process died mid-send; the re-drive picks it up |
| `SENT` | handed to the provider and accepted |
| `SKIPPED` | not attempted: no address, channel off, provider not configured, plan without WhatsApp |
| `FAILED` | refused or unreachable; `nextAttemptAt` says when it is tried again (2 min, 10 min, 30 min, 2 h) |
| `DEAD` | given up: five attempts failed, the refusal was permanent (4xx, invalid number), or the message went stale (a reminder after the appointment started) |

`/api/cron/notifications` runs every ten minutes and hands due rows back
to the dispatcher, which re-claims exactly those and sends only them.
Routes schedule their sends with `after()` so the serverless function is
kept alive until the send returns; the outbox is what makes a lost one
recoverable rather than forgotten.

Look:

```sql
SELECT status, count(*) FROM "NotificationDelivery" WHERE "createdAt" > now() - interval '1 day' GROUP BY 1;
SELECT "dedupeKey", channel, status, attempts, error, "nextAttemptAt", "lastAttemptAt"
  FROM "NotificationDelivery" WHERE "bookingId" = '<id>' ORDER BY "createdAt";
SELECT error, count(*) FROM "NotificationDelivery" WHERE status = 'DEAD' AND "createdAt" > now() - interval '7 days' GROUP BY 1 ORDER BY 2 DESC;
```

`/admin/notifications` shows the same with counts for "retrying" and
"dead".

| Symptom | Cause | Do |
|---|---|---|
| many `FAILED http-401`/`http-403` on WHATSAPP | the Meta token expired | renew `WHATSAPP_ACCESS_TOKEN`; the pending retries then succeed on their own |
| `DEAD invalid-phone` | the number cannot be sent to | nothing to retry; the in-app/email copies still went |
| `SKIPPED whatsapp-not-configured` / `email-not-configured` | the provider is not set in this environment | expected on Preview; on production set the key |
| `SKIPPED not-allowed` | the recipient or business switched that channel off | consent respected; nothing to do |
| `PENDING` older than an hour | the re-drive cron is not running | § booking runbook 9 |
| a customer says they got two of the same | two different events (e.g. "created" and "confirmed"), or two different times (a reschedule) | read their rows; the key says which |

Resend one message by hand (**WRITE**): set the row back to due and let
the cron take it.
`UPDATE "NotificationDelivery" SET status = 'FAILED', "nextAttemptAt" = now(), attempts = LEAST(attempts, 3) WHERE id = '<id>';`

Consent: a customer with an account has `notifyByEmail`,
`notifyByWhatsApp`, `notifyBySms` on `User`; a guest gets the booking's
own channels (the confirmation for the booking they just made). A
business has per-event switches (`notifyNewBooking`, `notifyCancellation`,
`notifyPayment`) and per-channel ones. Staff get in-app, push and their
own email only. WhatsApp to the customer rides on the business's plan.

## 6. Testing, never on real cards

- Local: `PAYMOB_FAKE=1` (refused in production by three independent
  checks) replaces only the hosted page; `scripts/qa-phase19.mjs` runs
  the whole path over HTTP.
- Database tests: `src/app/api/webhooks/paymob/route.db.test.ts` (signed
  callbacks, replay, out of order, pending→final, cancel mid-payment,
  revive, refund contention),
  `src/lib/notifications/outbox.db.test.ts`,
  `src/lib/bookings/reliability.db.test.ts`.
- Production: a Paymob **test** integration id on a Preview deployment, or
  a 1 EGP service refunded afterwards. Never automate charges against
  the live integration.
