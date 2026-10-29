# Phase 19 report: production booking and payment reliability

Date: 2026-10-29. Branch `phase-19-reliability`, on `main` after
PRs #32–#34 were merged (2026-10-29). Read with
`docs/runbooks/BOOKING_OPERATIONS.md`, `docs/runbooks/PAYMENT_OPERATIONS.md`
and `docs/audits/CRITICAL_FINDINGS.md` (Phase 19 section).

## How this phase was run

1. Phases 17 and 18 were verified on the merged `main` before anything
   changed: 978 unit tests passing, CI green on all three merge commits.
2. The booking, availability, payment and notification code was read
   end to end (state writes, locks, constraints, the webhook, the
   ledger, the reaper, the dispatcher, the crons) and every place a
   guarantee depended on luck was listed.
3. Fixes were made in the smallest form that holds under a race, each
   with a test that fails on the old code where a test can express it.
4. The guarantees were then exercised three ways: pure unit tests, tests
   on a real Postgres with the exclusion constraints in place, and an
   HTTP script against a production build with the fake Paymob page
   standing in for the hosted checkout (the webhook, its HMAC check, the
   ledger and the booking moves are the real ones).
5. A code review of the diff, with its findings applied, before this
   report (see the end).

## Existing functionality discovered (and kept)

- **Payments were already in good shape**: a signed webhook with a
  constant-time HMAC check; a per-transaction claim table that makes a
  replay a no-op and releases the claim when the handler throws;
  `settlePayment` that moves a payment out of PENDING once, inside the
  same transaction as the booking move; refunds that reserve their
  amount with a conditional UPDATE before Paymob is asked; a reaper for
  abandoned checkouts and orphaned holds; receipts from a sequence.
- **Concurrency on the booking row was already held by three exclusion
  constraints** (Phase 17) and an idempotency key on the booking.
- **Notifications already had a deduplication ledger** keyed by event,
  subject, recipient and channel, consent switches per customer and per
  business, and a staff audience.
- **Time** already kept bookings as wall-clock strings with a
  wall-clock `startsAt` frame, and every job compared against
  `cairoWallClock(now)` (Phase 17).

So this phase did not replace any of it. It closed the gaps the audit
had left open (P17-11, P17-16, P17-17) and the ones found reading the
code with a race in mind (P19-01 … P19-07).

## Changes implemented

### Part A — booking domain

- One transition table, `src/lib/bookings/transitions.ts`, for the
  business, the customer and the system; the dashboard's buttons, the
  API's checks and the existing cross-codebase test read it. Terminal
  states never move; `PENDING_PAYMENT` cannot be confirmed by hand (the
  money or cash at the counter does it); a released hold is revived only
  by the system and only if its time is still free.
- `src/lib/bookings/state.ts` — `moveBooking`: the UPDATE names the
  status the decision was made from, so a losing move is refused
  (409 `changed`) instead of overwriting. A cancellation or a released hold closes
  any open payment page, hands a redeemed discount back and writes an
  audit entry when money had already landed (refunds stay a person's
  decision); completing or marking a no-show does none of that.
- The owner's status PATCH, the customer's cancel, both reschedule
  routes, the webhook's decline path, the reaper and the subscription
  cron all write conditionally now.
- Customer reschedule keeps the booking's status when the business
  auto-confirms; otherwise it waits for the business again, as before.

### Part B — availability and concurrency

- Restaurant tables: a named table must seat the party (422
  `party-too-large`); with no table named, the smallest free one that
  fits is assigned (`resourceAssignments`), or the request is refused;
  the slots endpoint takes `partySize`. A booking with no table at a
  business that has tables used to hold nothing.
- `createBooking` re-derives an auto-assigned table on an exclusion
  violation, as it already did for staff.
- The public booking route's customer upsert raced under identical
  phone numbers (Prisma's upsert is not one statement) and returned 500
  before the idempotency check could answer; the loser now reads the
  winner's row. Found by the end-to-end script, not by reading.
- Everything else (slot re-derivation, Serializable insert, three
  exclusion constraints, idempotency key, hold expiry) was verified
  rather than changed; see the tests.

### Part C — time

- No hard-coded offsets: `zoneOffsetMinutes`, `wallToInstant`,
  `zonedDayStart/End` read the zone's rule for the instant from Intl.
  `cairoDayEnd` is the next day's start, not "+24 h" (the change days
  are 23 and 25 hours). All functions take a zone, defaulting to
  `Africa/Cairo`; a per-business zone would be a column and an
  argument, not a rewrite.
- Overnight hours: `20:00–02:00` is read as 20:00–26:00 on the day it
  opens; slots after midnight are stored as `24:00 … 25:30` under the
  evening's date with `startsAt` on the next calendar day; the clock
  helpers show them as `01:00 +1`; the ICS file, notification copy and
  every raw time on the web screens go through them. Staff shifts and
  breaks that cross midnight read the same way; an all-day block covers
  the late hours too.
- A legacy row whose `endTime` wrapped past midnight is read by its
  duration rather than as ending before it started.

### Part D — payments

- A `pending` callback (wallets, kiosks) releases its claim so the
  final callback under the same transaction id is processed; before, a
  wallet payment could never confirm.
- An admin refund whose provider call timed out or got a 5xx keeps its
  reservation and stays PENDING ("uncertain") instead of being released
  for a retry to refund twice; Paymob's own callback for it attaches and
  settles the row, and the runbook says how to settle it by hand.
- Nothing else in the ledger changed. Signed webhooks, replay
  protection, idempotent settlement, amount/currency checks, deposit
  accounting, provider-side reversals and reconciliation were verified
  on Postgres (`route.db.test.ts`) and over HTTP (`qa-phase19.mjs`).

### Part E — notifications

- The ledger is an outbox: claimed `PENDING` with the event stored on
  the row; `SENT`/`SKIPPED`/`FAILED` when the provider answers; retried
  with backoff (2 m, 10 m, 30 m, 2 h); `DEAD` after five attempts, on a
  permanent refusal (4xx, unusable address) or when the message went
  stale (a reminder after the appointment began). Take-overs of due rows
  are conditional updates, so two re-drivers cannot both win a row.
- `/api/cron/notifications` every ten minutes (`vercel.json`) hands due
  rows to the dispatcher, whose claim logic re-sends only those.
- Routes send with `after()` (`notifyLater`) so the serverless function
  is kept alive until the send returns; the 17 `void notify()` call
  sites were replaced.
- `/admin/notifications` shows attempts, next retry, "retrying" and
  "dead" counts. The customer-facing summary hides in-flight rows and
  reads DEAD as failed; the mobile API contract is unchanged.
- Deduplication and consent were already there and are covered by the
  new tests.

### Part F — business experience

- Statuses are one table shared by the API and the dashboard; the
  customer page, dashboard and mobile labels already covered all nine
  states and were verified consistent. The owner's status change
  response now carries `refundNeededCents` when money was already
  taken; the customer's cancel response carries `paidCents`.
- Past-midnight times read as `01:00 +1` everywhere on the web.

### Part G — tests (see "Tests executed")

### Documentation

`docs/runbooks/BOOKING_OPERATIONS.md`, `docs/runbooks/PAYMENT_OPERATIONS.md`
(payments and the outbox, with the reconciliation queries), the
architecture overview, the findings log, the feature inventory, the
roadmap, this report, the test matrix and the phase status.

## Database changes

`prisma/migrations/phase19_reliability.sql` — **run on production before
this PR deploys** (the dispatcher writes the new columns on every send):

- `DeliveryStatus` gains `PENDING` and `DEAD`.
- `NotificationDelivery` gains `attempts`, `nextAttemptAt`,
  `lastAttemptAt`, `event` (jsonb) and an index on
  `(status, nextAttemptAt)`; existing rows get `attempts = 1`.

Idempotent; run as a script, not inside one transaction (`ALTER TYPE …
ADD VALUE`). Applied to the local QA database for every test below.

## Tests executed

| Suite | Result |
|---|---|
| Web typecheck | PASS |
| Web lint | PASS — 0 errors, 6 pre-existing warnings |
| Mobile typecheck | PASS |
| Unit + route tests (`npm run test:run`) | see the final line below |
| `src/lib/bookings/reliability.db.test.ts` (Postgres) | PASS — 13/13: 50 simultaneous requests for one table → 1 booking, 49 `slot-taken`; "any table" fills 4 tables once under 30 simultaneous requests; two customers for the final slot; 20 identical idempotency keys → one booking, every answer the same id; 12 different keys for one resource → one winner and the losers' keys not burned; capacity and smallest-fitting-table assignment; confirm vs. cancel racing → exactly one applies; a stale-status move refused; cancel releases time, abandons the payment page, hands the discount back, flags paid money; staff vacation after a booking exists; holiday boundary; reschedule into a taken time refused; tenant and provider scope |
| `src/app/api/webhooks/paymob/route.db.test.ts` (Postgres, signed callbacks) | PASS — 9/9: unsigned refused; settle once with a receipt and a no-op replay; 5 simultaneous deliveries of one callback → one settlement; a failure after a success ignored; pending→final under one transaction id; decline releases then a late payment revives; cancel mid-payment then money lands (recorded, flagged, booking stays cancelled); amount mismatch fails and releases; refund reserved once under contention and the provider's callback attached to the pending admin refund, replay a no-op |
| `src/lib/notifications/outbox.db.test.ts` (Postgres) | PASS — 8/8: claim PENDING → SENT with the event stored; provider outage → FAILED with a retry time, re-driven once, never twice; permanent refusal → DEAD; fifth failure → DEAD; a PENDING claim left by a dead process picked up and its attempt counted; a claim that hung through every attempt closed, not re-sent; a due row whose booking is gone closed instead of clogging the batch; a reminder sent once for two cron passes and a stale one dropped |
| `src/lib/bookings/create.db.test.ts` (Phase 17, Postgres) | PASS — 5/5, still |
| `src/lib/bookings/instants.dst.test.ts` | PASS — 15: offsets from zone data; 24 April 2026 (23 h, skipped hour, 14:00 at +3); 29 October 2026 (25 h, repeated hour, next morning at +2); cross-midnight instants; another zone |
| `src/lib/bookings/availability.overnight.test.ts` | PASS — 8 |
| `src/lib/bookings/transitions.test.ts`, `src/lib/notifications/outbox.test.ts`, cron route tests, fake-gate tests | PASS |
| `scripts/qa-phase19.mjs` — HTTP against the production build + QA DB + fake Paymob | **see below** |

E2E (`scripts/qa-phase19.mjs`): PASS — 21/21 on the final build, twice in a row (2026-10-29 02:40Z). Two earlier runs on earlier builds failed E1/G1 and found P19-13 (customer upsert race → 500) and P19-14 (pool-start timeout → 500), both fixed

Final unit run: PASS — 1024 passed, 69 skipped (1093; 94 files) — 2026-10-29

### Tests NOT RUN / BLOCKED

- A real Paymob payment, refund or webhook on production or a Paymob
  sandbox: no sandbox credentials in this environment, and the
  instruction forbids charging real customers. The webhook was exercised
  only with locally signed callbacks that follow Paymob's documented
  field order.
- Live delivery of email, WhatsApp or push (providers not configured
  locally; `WHATSAPP_ACCESS_TOKEN` was deliberately blanked for the E2E
  server so no real message could leave).
- A staging environment: none exists.
- Maestro mobile E2E (unchanged, still failing on `main` as recorded).

## Regression results

Every previously passing suite still passes: 978 → see the final unit
count; Phase 17's database tests 5/5; Phase 18's E2E scripts were not
re-run (no UI flow changed except time labels).

## Security findings

- P19-01 was a correctness hole with a money consequence (a paid
  wallet booking left unconfirmed), not an exposure.
- P19-05: a refund could be sent twice after a timeout; fixed.
- The fake Paymob gate is now "not on Vercel and served from
  localhost", stricter in deployments than the `NODE_ENV` check it
  replaces (it no longer trusts an environment variable that a
  misconfigured preview could carry).
- No new permission changes. Tenant scope verified on Postgres.

## Performance findings

- `loadAvailability` now runs the engine once per fitting resource when
  no resource is named (tables × staff); for the fixture sizes this is
  milliseconds. Prisma logs every expected exclusion-constraint loss at
  `error` level (151 lines for the 80-request concurrency runs) — noise,
  not cost; noted as debt.
- The `(status, nextAttemptAt)` index keeps the re-drive query cheap.

## Known limitations

- The owner's manual booking route bypasses `createBooking` (P19-08):
  no party/table validation or idempotency key; the constraints still
  prevent a double booking.
- Mobile shows a past-midnight time raw (P19-09).
- `after()` keeps a function alive on Vercel; elsewhere the send runs
  inline (P19-10).
- Re-drive cadence is ten minutes; a confirmation that failed on first
  send can arrive up to ~12 minutes late.
- One zone for the platform; the functions take a zone but no business
  carries one yet.

## Remaining work

- Owner: run `phase19_reliability.sql` before deploying; confirm the
  Phase 17/18 migrations ran (both were required by the merges on
  2026-10-29); set `CRON_SECRET` if not already; check Vercel → Cron Jobs
  shows the new ten-minute job after deploy.
- P19-08, P19-09, the Prisma error-log noise, and the open items from
  Phase 17 (P17-14, P17-24, P17-26, P17-27, owner items).
- A Paymob sandbox run of `scripts/verify-payment-webhook.mjs` against a
  Preview deployment once credentials exist.

## Release readiness

Ready to merge and deploy once the migration has run. Nothing here
changes a public URL or a mobile API contract.

## Next phase dependencies

None technical.

## Code review of this phase's changes

A review of the whole diff ran before this report (`/code-review`,
high effort, 19 tool uses). Ten findings; all addressed, two of them
would have shipped real defects:

| # | Finding | What was done |
|---|---|---|
| 1 | `releasesTime()` was true for → COMPLETED/NO_SHOW too, so completing a deposit-paid booking with a discount deleted the redemption, decremented the offer and flagged a refund | `releasesTime` now means CANCELLED or FAILED_PAYMENT only; test updated to pin COMPLETED/NO_SHOW as not releasing |
| 2 | A due outbox row the dispatcher could no longer deliver (booking deleted, recipient opted out) stayed due for ever and, oldest first, would eventually fill the 200-row batch | After each re-drive the rows still due are closed DEAD "no longer deliverable"; test added |
| 3 | The widget never sent `partySize` to `/slots`, and to `/bookings` only when a specific table was chosen, so the new capacity rules could not fire from the web | Sent on both requests whenever the business's resources count seats |
| 4 | Both reschedule routes computed availability across table lanes but wrote `resourceId: null`, so a moved table-less booking held no table; `partySize` not passed | Both routes persist the engine's staff and resource assignment at the new time and pass the party size; the reschedule slots endpoints pass it too |
| 5 | `process.env.VERCEL` undeclared: `env-coverage.test.ts` red | Added to the platform-provided list |
| 6 | `attempts` was written after the send, so a send that never returned (provider hang, function killed) could be taken over for ever without reaching the cap | The attempt is counted on the claim (insert `attempts: 1`, take-over `increment`); a stale claim at the cap is closed DEAD; two tests added |
| 7 | Past-midnight slots were stored under the previous day, but that day was "past" once the clock passed 00:00, so the 01:00 table could not be offered at 00:20 | The engine treats yesterday as still open while its window runs past now; notice is applied from the right minute; test added. The widget's date picker does not yet offer "last night" (P19-11) |
| 8 | `/slots` runs the engine once per fitting table (× staff) | Accepted for this phase; noted as P19-12 with the cheaper shape |
| 9 | `endTime` still rendered raw in two dashboard lists (`26:00`) | Wrapped through `clock()` |
| 10 | `canReschedule` kept a hard-coded status list beside the shared table | Reads `CUSTOMER_MOVABLE` |

After the fixes: typecheck clean, lint 0 errors, 1024 unit tests, 35 database tests, and the end-to-end script re-run on a fresh build (results above).
