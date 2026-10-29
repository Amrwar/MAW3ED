# Booking operations runbook

For whoever is on support. Everything here is read from the database
or the admin screens; nothing requires guessing at what the code did.
SQL is read-only unless marked **WRITE**. Production database access is
the owner's; run writes only after reading the row first.

Phase 19 (`docs/phases/PHASE_19_REPORT.md`) is where the guarantees
below were established; `docs/architecture/ARCHITECTURE_OVERVIEW.md`
has the shape of the system.

## 1. The booking state machine

One table decides what may follow what: `src/lib/bookings/transitions.ts`.
The business's buttons, the customer's links and the API all read it.

| Status | Means | Holds its time | Who moves it out |
|---|---|---|---|
| `PENDING_PAYMENT` | waiting for the deposit | yes | the webhook (paid → `CONFIRMED`; declined → `FAILED_PAYMENT`), cash at the counter (→ `CONFIRMED`/`PENDING`), the reaper after 2 h of silence (→ `FAILED_PAYMENT`), the customer or business cancelling |
| `PENDING` | waiting for the business | yes | business → `CONFIRMED`/`CANCELLED`; customer → `CANCELLED` |
| `CONFIRMED` | the appointment stands | yes | business → `ARRIVED`/`IN_PROGRESS`/`COMPLETED`/`NO_SHOW`/`CANCELLED`; customer → `CANCELLED` (≥ 2 h before) |
| `ARRIVED`, `IN_PROGRESS` | day-of | yes | business only |
| `COMPLETED`, `CANCELLED`, `NO_SHOW` | final | no | nobody |
| `FAILED_PAYMENT` | deposit never arrived; time released | no | the webhook alone, to `CONFIRMED`, if money lands late and the time is still free |

Every move is written as `UPDATE … WHERE id = ? AND status = <the status
it was decided from>`. A move that finds the row already changed is
refused with HTTP 409 `{ code: "changed" }` and the screen is told to
refresh. So two people acting at once cannot both apply, and a webhook
cannot be overwritten by a stale screen.

Cancelling a booking, or releasing a hold whose deposit never arrived, also does the following in the same transaction (completing or marking a no-show does not):

- closes any Paymob payment page still open for it (`Payment.status = ABANDONED`),
- hands back a discount it redeemed (the redemption row is deleted and the
  offer's count decremented),
- writes an `AuditLog` row `booking.released_with_money` when money had
  already landed — **cancelling never refunds by itself** (see the payments
  runbook).

## 2. "The customer says they booked and the business has nothing"

```sql
SELECT id, reference, status, date, "startTime", "endTime", "staffMemberId", "resourceId",
       "customerPhone", "customerEmail", "idempotencyKey", "createdAt"
  FROM "Booking"
 WHERE "customerPhoneE164" = '2010XXXXXXXX'          -- digits, country code, no plus
 ORDER BY "createdAt" DESC LIMIT 10;
```

- Nothing at all: the request never created a row. Check the server log
  for `[booking POST]` at that time, and whether the number was throttled
  (five bookings per number per business per hour, or the per-address
  limit in `src/lib/rate-limit.ts`).
- `FAILED_PAYMENT`: the deposit was declined or never paid; the customer
  saw "payment did not complete". They have to book again.
- `PENDING_PAYMENT` older than 2 hours: the reaper (hourly, inside
  `/api/cron/reminders`) should have released it. If it did not, the cron
  is not running — check Vercel → Cron Jobs → last run.
- `CANCELLED` by the customer: `AuditLog` has no row for a plain cancel,
  but `NotificationDelivery` has the `booking.cancelled:…:customer` key.

## 3. Double bookings

They should be impossible; three database exclusion constraints hold
under any race (`booking_no_overlap`, `booking_no_overlap_resource`,
`booking_no_overlap_staff`). If a business reports one:

```sql
SELECT a.id, b.id, a."businessId", a."staffMemberId", a."resourceId", a."startsAt", a."endsAt"
  FROM "Booking" a JOIN "Booking" b
    ON a."businessId" = b."businessId" AND a.id < b.id
   AND (a."resourceId" = b."resourceId" OR a."staffMemberId" = b."staffMemberId")
   AND tsrange(a."startsAt", a."endsAt", '[)') && tsrange(b."startsAt", b."endsAt", '[)')
 WHERE a.status IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS')
   AND b.status IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS');
```

Rows here mean a constraint is missing (check
`SELECT conname FROM pg_constraint WHERE conname LIKE 'booking_no_overlap%'`;
`prisma/migrations/phase17_booking_integrity.sql` adds the two newer ones
and prints a NOTICE if existing data stops it). Bookings with **no**
staff member and **no** resource at a business that has staff are the
other cause: they are "owed" to the team by the engine, but the
constraint cannot see them. Give them a person from the dashboard.

## 4. Restaurant tables and party size

- A booking that names a table must fit it: `partySize ≤ Resource.capacity`
  (`capacity NULL` seats anyone). Otherwise HTTP 422 `party-too-large`.
- A booking that names no table at a business that has tables is given
  the smallest free one that fits (`Booking.resourceId` is never null
  there). A party bigger than every table gets `party-too-large` and the
  slots endpoint returns `reason: "party-too-large"`.
- Tables are resources: `Resource` where `kind = 'TABLE'`. The old
  `Table` model is unused.

## 5. Time, zones and the clock change

- `Booking.date` is UTC midnight of the business day; `startTime`/`endTime`
  are the business's wall clock as text; `startsAt`/`endsAt` are the same
  wall-clock reading written as if it were UTC (the overlap constraints
  run on them). **Never compare `startsAt` with `now()`**; compare with
  `cairoWallClock(now)` (`src/lib/bookings/instants.ts`), as every job does.
- The zone is `Africa/Cairo` (`DEFAULT_TZ`). No offset is hard-coded:
  `zoneOffsetMinutes`, `wallToInstant`, `zonedDayStart/End` ask Intl for
  the rule in force at that instant. The day the clocks go back is 25 hours
  long and the day they go forward 23; the tests in
  `src/lib/bookings/instants.dst.test.ts` pin both for 2026 (24 April,
  29 October).
- A venue trading past midnight (`closeTime ≤ openTime`, e.g. 20:00–02:00)
  stores its 01:00 table as `startTime = '25:00'` under the evening's
  date, with `startsAt` on the next calendar day. Screens show it as
  `01:00 +1` (`clock()` in `src/lib/fmt.ts`). Reports grouped by `date`
  count it with the evening it belongs to; reports on `startsAt` count it
  with the morning.
- If the platform's zone data were ever wrong, the symptom is every
  "today" list and reminder being off by one hour after a change date.
  Node's ICU (`node -e "console.log(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',timeZoneName:'longOffset'}).format(new Date()))"`)
  should print `GMT+02:00` in winter and `GMT+03:00` in summer.

## 6. Staff absence and holidays after bookings exist

Adding a `TimeBlock` (vacation, holiday, closure) does **not** cancel or
move existing bookings; it stops new ones and makes a move into that day
impossible. To find what is affected:

```sql
SELECT b.id, b.reference, b.status, b.date, b."startTime", b."customerName", b."customerPhone"
  FROM "Booking" b
  JOIN "TimeBlock" t ON t."businessId" = b."businessId"
   AND (t."staffMemberId" IS NULL OR t."staffMemberId" = b."staffMemberId")
   AND t."startsOn" IS NOT NULL
   AND b.date BETWEEN t."startsOn" AND COALESCE(t."endsOn", t."startsOn")
 WHERE t.id = '<block id>'
   AND b.status IN ('PENDING','CONFIRMED','PENDING_PAYMENT');
```

The business reschedules or cancels each from its dashboard (the customer
is notified by the dispatcher, with a push). Moving one to another member
is "reschedule" with that member selected.

## 7. Reschedules

- Customer: `POST /api/booking/{token}/reschedule`. Allowed from
  `PENDING`/`CONFIRMED`, more than 2 hours ahead. The new time is checked
  by the same engine that offered it, with the booking itself excluded.
  Afterwards the booking is `PENDING` again unless the business
  auto-confirms, in which case it keeps its status.
- Business: `POST /api/business/bookings/{id}/reschedule`. Keeps the
  status. Both writes are conditional on the status read, and the overlap
  constraint catches a race (`409 slot-taken`).
- `customerReminderSentAt` is cleared by a move; the reminder for the
  new time is a new ledger key (it carries `startsAt`), so it goes out
  again, once.

## 8. Tenant boundaries

Every business booking query is built on `bookingScope()`
(`src/lib/business-access.ts`): the whole business for an owner or
manager, only their own bookings for a provider. Another business's
booking id is simply "not found" (404), never 403. The customer's side
is the access token in the booking link; the app exchanges a booking id
for it only over a signed-in connection whose verified phone matches
(`/api/account/bookings/{id}`).

## 9. Jobs that must be running

| Job | Schedule | Does | If it stops |
|---|---|---|---|
| `/api/cron/reminders` | hourly | reminders, "starting soon", review requests, **and the payment reaper** | abandoned deposits hold their times for good; no reminders |
| `/api/cron/notifications` | every 10 min | re-sends failed/stalled notifications (§ payments runbook, part 4) | a provider blip loses messages until it runs |
| `/api/cron/subscriptions` | daily 05:00 | expires and reminds subscriptions | plans run past their end |

All three need `CRON_SECRET` set in Vercel; without it they refuse to run
(HTTP 503) and say so in the log. Check Vercel → project → Cron Jobs for
the last status; invoke by hand with
`curl -H "Authorization: Bearer $CRON_SECRET" https://www.maw3ed.net/api/cron/notifications`.

## 10. Smoke test after a deploy

1. `GET /api/version` reports the new commit.
2. On a QA business with a deposit: book, pay, confirm (the fake checkout
   is local only; on production use a Paymob test card on a 1 EGP
   service, then refund it from `/admin/payments`).
3. `/admin/notifications`: the booking's rows are `SENT`/`SKIPPED`, none
   `PENDING` after a minute.
4. The owner's dashboard shows the booking under Today or the right day.
