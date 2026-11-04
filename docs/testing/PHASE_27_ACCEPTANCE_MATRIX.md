# Phase 27 acceptance matrix

Status: PASS = built and proved by the named test; PARTIAL = built with a stated limit;
INCOMPLETE = not built (reason given); OUT = out of scope by decision.

Test files: **U** `src/lib/loyalty/rules.test.ts`, **R** `src/lib/reports/operations.test.ts`,
**D1** `src/lib/phase27.db.test.ts`, **D2** `src/lib/phase27-ops.db.test.ts`,
**Q** `scripts/qa-phase27.mjs` (HTTP, running server), **G** `src/lib/security/route-guards.test.ts`.

## A — Advanced bookings

| Requirement | Status | Proof |
|---|---|---|
| Recurring appointments, bounded | PASS | D2 series (skip taken week, retry adds nothing, 13 refused, DB refuses 50), R `seriesDates`, Q series |
| Group reservations (one booking, party size, capacity) | PASS | D2 table (two parties one table → one; party bigger than any table refused) |
| Group classes (separate bookings sharing capacity) | INCOMPLETE | needs a shared-capacity constraint design; documented in ADVANCED_BOOKING_RULES |
| Multiple services in one booking | INCOMPLETE | all-or-nothing booking groups not built; separate bookings work |
| Staff/resource combinations | PASS | existing engine + desk now takes both (validated to the business); D2 table, `create.db.test.ts` |
| Booking buffers | PASS | unchanged engine (`bufferMinutes`) |
| Waitlist (slot) | PASS | D2 duplicate entry, FIFO offer, two passes offer once, two taps book once, 3 offers then expired; Q join/offer/accept |
| Cancellation slot recovery | PASS | release → offer after commit + cron sweep; D2, Q |
| Flexible cancellation rules | PASS | existing cutoff + transitions; release returns points/sessions/discounts |
| Rebooking | PASS | `rebookHref` (R), account/booking page/automations |
| No-show policy | PASS | Q (BLOCK_ONLINE refuses), U `noShowTriggered` |
| Deposits | PASS | unchanged; on reduced total; none on a 0 total; forced by REQUIRE_DEPOSIT |
| Booking packages | PASS | see C |
| Walk-ins | PASS | Q (ARRIVED now) |

## B — Loyalty

| Requirement | Status | Proof |
|---|---|---|
| Points per visit / spend | PASS | U, D1 earn (10 + 5/100 EGP) |
| Redemption rules (units, % cap, balance) | PASS | U, Q (100 pts → 50 EGP off) |
| Expiration | PASS | D1 expire once, expired lot not spendable |
| Refund reversal (proportional, never negative) | PASS | D1 refund half twice, spent-before-refund shortfall |
| Fraud: daily cap, owner's own number, test bookings, proven number to spend | PASS | D1 cap/self, Q guest refused |
| No double redemption | PASS | D1 three bookings racing one balance → one |
| No duplicate rewards | PASS | D1 racing completions, replayed earn |
| Auditable ledger, owner corrections with reason | PASS | ledger entries, Q double-submitted correction once |
| Business configuration | PASS | Q PUT program, bounds refused |
| Authorized organization programs (OWNED + accepted only) | PASS | D1 org reach, Q invited 1 of 2 |

## C — Memberships and packages

| Requirement | Status | Proof |
|---|---|---|
| Plans, allowances, prepaid packages | PASS | D1, Q |
| Expiry | PASS | D1 (appointment past expiry refused), D2 (cron) |
| Renewal (bounded, never resets) | PASS | D1, Q |
| Usage | PASS | D1, Q |
| Pause / cancel | PASS | D1 pause blocks, resume shifts; D2 cancel at period end |
| Payments | PARTIAL | desk (MANUAL) with receipt; **online purchase not built** |
| Refunds | PASS | refused while booked, then allowed (D1, Q) |
| No negative balances / double consumption | PASS | CHECKs; D1 four bookings racing two sessions |
| Business deletion with sales | PASS | D2 |

## D/E/F — Verticals

| Requirement | Status | Proof |
|---|---|---|
| Salon: staff, chairs, walk-ins, packages, memberships, commissions, daily ops report | PASS | R (commission), Q |
| Restaurant: tables, sections, party sizes, capacity, deposits, waitlist, no-show, turnover | PASS | R (guests, turns, sections), D2 table |
| Restaurant: guest invitations | PARTIAL | existing visitor passes (Phase 23) where access is enabled; no separate invitation flow |
| Restaurant: check-in | PASS | existing (Phase 23) |
| Clinic: providers, categories, rooms, recurring, reminders, cancellation, companions | PASS | R groups, series, companions |
| Clinic: privacy-safe reports, no EMR | PASS / OUT | R (no names or numbers); EMR out of scope |

## G/H — Retention and automations

| Requirement | Status | Proof |
|---|---|---|
| Saved businesses | PASS | existing favorites |
| Loyalty and membership status for the customer | PASS | `/account/wallet`, Q wallet |
| Repeat prompts, rebook | PASS | rebook nudges (marketing), rebook links |
| Review invitations | PASS | existing reminders cron |
| Referrals where permitted | PASS | existing business referral program; no customer referral rewards (would need a fraud model) |
| Consent-controlled marketing | PASS | D2 no consent → skipped, cap, transactional uncapped; Q consent saved |
| Idempotency, rate limits, bounded retries | PASS | D2 duplicate key, DEAD after 5; cron bounded per run |
| Waitlist notifications, renewals, loyalty notices, follow-ups | PASS | `lib/automations/run.ts`; Q cron runs clean |

## I — Organizations

| Requirement | Status | Proof |
|---|---|---|
| Central loyalty for owned brands | PASS | D1, Q |
| Cross-brand promotions, per-business participation | PASS | D2 (owned only, off until the brand switches it on), Q |
| Aggregated package reporting | PASS | Q (REPORTS scope only) |
| Hosted malls gain no loyalty/customer/payment control | PASS | D1, D2, Q |

## K — Tests (requested list)

| # | Test | Where |
|---|---|---|
| 1 | Booking concurrency | `create.db.test.ts`, D1, D2 |
| 2 | Recurrence termination | D2, R |
| 3 | Waitlist priority / duplicates | D2 |
| 4 | Duplicate loyalty events | D1 |
| 5 | Loyalty reversal | D1 |
| 6 | Redemption concurrency | D1 |
| 7 | Membership expiry / cancel | D2 |
| 8 | Package double consumption | D1 |
| 9 | Table overlap | D2 |
| 10 | Group capacity | D2 |
| 11 | Staff/resource conflicts | `create.db.test.ts` |
| 12 | Clinic isolation | R (no personal data), Q |
| 13 | Automation consent | D2 |
| 14 | Automation retry termination | D2 |
| 15 | Duplicate payment events | existing webhook tests; desk sales are explicit separate sales |
| 16 | Org permissions | D1, D2, Q, G |
| 17 | Job failure recovery | `runOperations` isolates each job; redrive of stale/failed rows (D2) |
| 18 | No recursive rewards | earn on amount charged; nothing reacts to ledger entries (LOYALTY_LEDGER.md) |
| 19 | No unbounded recurrence | D2 (DB CHECK) |
| 20 | Regression | full unit suite, DB suites, QA battery (see report) |
