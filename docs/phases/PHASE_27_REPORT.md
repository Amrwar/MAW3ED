# Phase 27 report: advanced booking, business operations, loyalty and retention

Date: 2026-11-04. Branch `phase-27`, from `main` at `4671d3d` (#56).

## Principle

Everything extends what exists. Every online booking still goes through the core engine
(`lib/bookings/create.ts`: slot re-derived on the server, writes queued per business,
exclusion constraints as the final word). Every balance — points, package sessions,
membership visits — moves only by a conditional update or a locked row, with a unique key
per event and a CHECK constraint as the floor. Spending a balance happens **inside the
booking's own transaction**, and giving it back happens in `releaseBookingHold`, the one
path every cancellation, failed payment and reaper release goes through.

Design docs: `docs/architecture/ADVANCED_BOOKING_RULES.md`, `LOYALTY_LEDGER.md`,
`MEMBERSHIPS_AND_PACKAGES.md`. Acceptance: `docs/testing/PHASE_27_ACCEPTANCE_MATRIX.md`.

## What was built, by module

| Module | Built | Not built (honest) |
|---|---|---|
| A Advanced bookings | Recurring series (bounded 2–12, 1–4 weeks, DB CHECK; idempotent occurrences; request key); slot waitlist (FIFO, offers held N minutes, at most 3, no overlapping offers per staff member, accept through the engine); release → offer after commit + 10-minute sweep; no-show policy (deposit or call); walk-ins (ARRIVED now); desk staff/resource; rebook links with service and staff; companions | Multi-service single bookings; group classes sharing one capacity (needs a constraint redesign) |
| B Loyalty | Business and organization programs; earn on completion (once, daily cap, not the owner's number, not test bookings, on the amount charged); spend with a proven number inside the booking transaction; give back on release; retake on late-payment revival; proportional reversal wherever a refund settles; expiry; owner corrections with reason; customer and owner ledger views | — |
| C Memberships & packages | Plans; desk sale with receipt; use online or at the desk; per-period membership visits; renew (bounded, never resets), pause (60-day allowance, shifts paid time), cancel now / at period end; expiry; desk refunds (refused while booked; row-locked) | **Online purchase through Paymob** |
| D Salon | Staff commission (owner-only), per-staff daily report with commission, chairs, walk-ins, packages, memberships | — |
| E Restaurant | Sections (`Resource.area`), party sizes/capacity, guests and turns per table and section, deposits, waitlist, no-show, check-in (Phase 23) | A separate guest-invitation flow (Phase 23 visitor passes cover it where access is on) |
| F Clinic | Service categories, rooms, recurring visits, companions, reminders, cancellation rules, counts-only report | EMR (out of scope by decision) |
| G Retention | `/account/wallet`, marketing consent (off by default), rebook prompts, favorites/reviews/referrals (existing) | Customer referral rewards (would need a fraud model) |
| H Automations | Operations cron: waitlist, expiries, follow-ups, rebook nudges, renewal/points/package notices; idempotent keys on the notification ledger; marketing consent + 2/week cap; retries stop at 5; every job paged and bounded | WhatsApp/SMS for these messages (templates / no provider) |
| I Organizations | Central loyalty for OWNED brands (invite, each owner accepts/leaves); cross-brand promotions as switched-off offers each brand turns on; package counts for brands sharing REPORTS | — |

UI: dashboard pages Loyalty, Packages & memberships, Waitlist, Operations (settings +
report); walk-in, desk balance and repeat series in the booking form; staff commission and
service category; organization console Loyalty & promotions. Customer: wallet, consent
toggle, `/booking-waitlist/<token>`, booking widget waitlist join, balance use and
companions.

Migrations (additive, idempotent, run in order): `prisma/migrations/phase27_enums.sql`, then
`phase27_operations.sql`. Production script prepared (owner runs it): `migrate-phase27.sh`.

## Defects found and fixed during the phase

Found by the phase's own database tests and QA:

1. A replayed refund reversal (or owner correction) drew from lots before finding its entry
   already written — points taken twice. Now checked under the account lock before drawing;
   a lost insert after a draw rolls back.
2. Package expiry and membership periods (real instants) were compared with the booking's
   wall-clock `startsAt` — off by Cairo's offset. Now the appointment's real instant.
3. Two waitlist passes at once could offer one freed time to two people. Now a database key
   per start and staff member, plus overlap checks.
4. Sold packages/memberships referenced plans `ON DELETE RESTRICT`, which blocked deleting a
   business that ever sold one (RESTRICT fires mid-cascade). Now NO ACTION.
5. When a Paymob session failed to open, the booking was set FAILED_PAYMENT directly,
   skipping the release: points (and, before this phase, an offer's use) never came back.
   Now through the state machine.
6. A pause of minutes counted as a whole day (rounded up), costing allowance and pushing the
   paid date past the renewal bound. Now the nearest whole day.

Found by the post-phase code review (`/code-review high 4671d3d..HEAD`, 10 findings, all fixed):

7. A booking revived by a late payment kept the points its release had given back
   (discount + points twice). Retaken on revival; reversal is by net points held.
8. Points were reversed only on the admin route's synchronous refund success; a refund
   settled by the Paymob callback kept them. Reversal now also where the callback settles.
9. Waitlist offers keyed by start time alone: one freed hour offered as 10:00 and 10:30 to
   two people, and the same time with another barber blocked. Now overlap- and staff-aware.
10. Accepting an offer as the sweep lapsed it left a booking with the entry still waiting
    and no confirmation. The entry is now BOOKED once the booking exists.
11. Automation jobs re-read the same first 200 rows each run. Now paged by id, bounded.
12. Rebook nudges went to customers with an upcoming visit booked long ago. Fixed.
13. A double-submitted series made two series. Request key added.
14. A desk refund could pass its "no live bookings" check while a booking took a session.
    The package/membership is locked first; membership use share-locks it.
15. Schedule loads repeated per waiting entry. Cached within a pass.
16. Duplicated walk-in time formatting and points-quote logic. Shared helpers.

## J — Loop audit

| Loop | Bounded by |
|---|---|
| Recurring series | DB CHECK 2–12 occurrences; `seriesDates` caps; one engine call per occurrence |
| Waitlist offers | at most 3 per entry (CHECK), offer expiry, days that pass close entries, 50 live per day, 20 entries per pass |
| Waitlist ↔ cancellation | an offer holds nothing and accepting creates, not releases; release triggers one deferred pass; no cycle |
| Loyalty earn ↔ redeem | earn on amount charged; nothing reacts to a ledger entry; no reward triggers a reward |
| Expiry jobs | one lot / row per conditional update, bounded per run; a second run finds nothing (keys) |
| Membership pause | 60-day lifetime allowance; auto-resume when it runs out |
| Renewals | at most one period ahead |
| Automation messages | unique keys; retries 5 with backoff then DEAD; marketing 2/week; no job reacts to a message |
| Cron run | each job isolated (one failing is logged, the rest run); pages capped at 2,000 rows/job/run |
| Webhook revival | retake is keyed per revival; release → revive → release nets to the right balance (DB test) |

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint` | 0 errors (pre-existing warnings only) |
| Unit suite | 116 files, all passed (1228+ tests) |
| Phase 27 DB tests (`phase27.db.test.ts`, `phase27-ops.db.test.ts`) + engine/webhook DB tests | 44 passed on QA Postgres |
| `scripts/qa-phase27.mjs` over HTTP on a production build (incl. every new page rendering for owner, customer, organization, ar/en) | **66/66** |
| Regression battery (20 earlier QA scripts, incl. three browsers, axe, 10 devices × 2 languages) | all passed — see below |
| Production migration verify block | VERIFIED against QA |

Regression battery, on the Phase 27 production build against QA: qa-phase24 147/147,
qa-phase24-browser 23/23, qa-redirects 108/108, qa-offline-qr 31/31, qa-responsive (380 page
loads, nothing wider than its screen), qa-booking-e2e 22/22, qa-phase23 48/48,
qa-phase23-loops 15/15, qa-security 32/32, qa-phase23-browser 49/49, qa-loops-browser 9/9,
qa-venue-console and qa-venue-page clean, qa-phase22c 59/59, qa-phase22b 84/84,
qa-phase22 68/68, qa-phase21 44/44, qa-phase19 21/21, qa-phase17 13/13, qa-phase18 (544
page loads, 0 flagged, no serious/critical axe findings).

(A first pass showed failures in six scripts. They were caused by test data left behind by
two QA runs that were stopped mid-way — the QA server had been reaped for low memory —
not by Phase 27: after removing that data, all six passed unchanged.)

## Not verified / owner items

- Production migrations not yet applied (owner runs `migrate-phase27.sh` before the deploy).
- No new screen was exercised by clicking in a browser in this phase: the new pages are
  proved to render (HTTP QA, both languages) and the APIs behind them are proved over HTTP;
  interactive flows (forms, the widget's balance step, the waitlist countdown) are checked
  by type-check and lint only.
- Online purchase of packages/memberships, multi-service bookings and shared-capacity
  classes are not built (above).
- Pre-existing, not changed: a booking revived by a late payment keeps its discount though
  the offer's use was handed back on release.
