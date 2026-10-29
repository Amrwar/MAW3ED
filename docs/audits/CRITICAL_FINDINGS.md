# Phase 17 findings

Severity:

- **P0**: harms customers, money or trust now, or is a false production
  claim about money, reviews or counts.
- **P1**: serious, but limited in reach or needing unusual conditions.
- **P2**: should be fixed soon.
- **P3**: hardening and polish.

Status is FIXED (on the Phase 17 branch, with tests), OPEN, or OWNER
(needs the owner or an outside party).

**None of the fixes are in production yet.** They reach it when the
Phase 17 PR is merged, *after* `prisma/migrations/phase17_booking_integrity.sql`
is run on the production database.

## P0

### P17-01: "Any available" double-books a staff member. FIXED

- **Evidence:** `src/lib/bookings/availability.ts`, the collision
  filter. With no staff member requested, bookings that had one were
  ignored. The database constraint (`add_resources_part2.sql`, the
  `COALESCE(staffMemberId,'-')` pair) has the same gap. "Any
  available" is the **default** choice in `BookingWidget.tsx`
  (`selectedStaff` starts null), and the copy promises "whoever is free
  at the time you pick", but nothing assigned anyone. Owner-entered
  bookings (no staff) were likewise invisible to named-staff slots.
- **Reproduce (old code):** a barbershop with one barber. Book him at
  14:00, then book 14:00 again without choosing anyone. Both are
  accepted. `src/lib/bookings/create.db.test.ts` reproduces it against
  Postgres; it fails on the old code and passes on the new.
- **Root cause:** a booking with no staff member was treated as its own
  lane, not as "one of the team".
- **Affected:** every customer and business with staff. This is the
  core booking promise.
- **Fix:**
  - `computeStaffedAvailability`: "anyone" is offered a time only when
    more eligible staff are free than there are unassigned bookings
    overlapping it. A named member must also leave enough of the team
    for those.
  - `loadAvailability` loads the eligible team (active, and listed for
    the service or for nothing).
  - `createBooking` stores the assigned member.
  - Cards' "next free" (`next-free.ts`) use the same rule.
- **Tests:**
  - `availability.test.ts` (team suite)
  - `next-free.test.ts` (staffed business)
  - `create.db.test.ts` (one barber; a three-way race for two barbers)
  - End to end against the QA database: the third concurrent "anyone"
    booking is refused, and the two accepted ones went to different
    staff.

### P17-02: Premium sold with features that do not exist. FIXED

- **Evidence:** `src/lib/plans.ts` gave PREMIUM `advancedAnalytics`,
  `marketing`, `api`, `prioritySupport` and `customBranding`. A search
  of `src` finds nothing outside `plans.ts` that reads any of them. Live
  `/pricing` showed them ticked at 499 EGP/month, and the homepage plan
  preview (`i18n.ts`) listed three.
- **Reproduce:** open `/pricing`, then search the code for any check of
  those keys.
- **Root cause:** an aspirational matrix rendered as fact.
- **Affected:** any business deciding to pay for Premium. No payment
  has ever succeeded (`docs/payments-verification.md`), so nobody has
  paid for them yet.
- **Fix:** the five keys are removed from the matrix, labels and copy.
  Premium now lists what is enforced: multiple branches and an
  unlimited team.
- **Test:** `plans.test.ts` → "everything the pricing page sells is
  enforced". It scans the source and fails for any plan row that no
  code checks. End to end: none of the eight phrases appear on `/`,
  `/en`, `/pricing` or `/en/pricing`.

### P17-03: Anyone can redirect a customer's booking emails and manage links. FIXED

- **Evidence:** `src/app/api/public/[slug]/bookings/route.ts` fills
  `Customer.email` from the first anonymous booking for a phone number.
  `dispatch.ts` sent every booking email to `customer.email`, as did
  the pay and payments routes (Paymob billing email). The email
  templates link to `/booking/<accessToken>`, which can view, cancel
  and reschedule. Phone proof (`BOOKING_PHONE_VERIFICATION`) is not set
  in production.
- **Reproduce (old code):** book anything at business X with the
  victim's phone and your own email. Every later booking the victim
  makes at X emails you its details and its manage link.
- **Root cause:** a per-booking fact (where to send) was kept on a
  shared record that an unauthenticated request could write.
- **Affected:** customers of every business. At clinics this exposes
  medical appointments.
- **Fix:**
  - New `Booking.customerEmail`, written from the address typed with
    that booking.
  - All customer emails, and Paymob billing data, read it.
  - `Customer.email` is now only the owner's contact card.
  - The migration does not copy `Customer.email`, which may be planted.
    Upcoming and recent bookings take an address only from an account
    that has verified both their phone and their email.
  - The rest of the existing bookings keep their WhatsApp, in-app and
    push notifications.
  - Owner-entered bookings take the address the owner types.
- **Test:** `create.db.test.ts` → "sends a booking's emails to the
  address typed with it, never the Customer record's". End to end: the
  typed email is stored on the booking.

## P1

| ID | Finding | Status |
|---|---|---|
| P17-04 | **A shared room or table double-books across staff.** `availability.ts` checked the resource only when neither side had staff. The DB constraint compares (staff, resource) as a pair. Repro: doctor A and doctor B both get room 1 at 10:00. Fix: resource collision checked first; migration adds `booking_no_overlap_resource` and `booking_no_overlap_staff`, each only if existing data allows (the migration prints a NOTICE otherwise). Test: `availability.test.ts` "a shared room or table" | FIXED |
| P17-05 | **The public booking route trusted staff, resource and branch ids.** An inactive or another tenant's staff member fell back to business hours; a foreign `resourceId` was stored. Fix: `loadAvailability` refuses ids that are not active rows of this business. Test: `create.db.test.ts` "refuses a staff member who is not this business's"; `availability.test.ts` "refuses a member who does not do this service" | FIXED |
| P17-06 | **Reminders and the owner's Today list used the wrong clock.** `startsAt` is Cairo wall-clock stored as UTC; the cron and dashboard compared it with real instants. A 3-hour reminder arrived about an hour before; "starting in 30 minutes" came 2–3 hours after the start; Today dropped bookings from 22:00 (21:00 in summer) and showed the previous evening's. Files: `api/cron/reminders/route.ts`, `lib/dashboard/queries.ts`, `app/dashboard/page.tsx`. Fix: `cairoWallClock` / new `cairoWallDay`. Tests: `cron/reminders/route.test.ts` (fails on the old code), `instants.test.ts`; end to end: a 22:30 booking appears in Today | FIXED |
| P17-07 | **Serialization failures reported as "someone took the slot".** `create.ts` mapped 40001 to slot-taken, and the soft-cap count makes those frequent under load. Fix: retried within the attempt loop; only the exclusion violation means taken | FIXED |
| P17-08 | **JSON-LD `"priceRange":"0 EGP"`** on live listings whose services have no price. Fix: unpriced services excluded. Test: `jsonld.test.ts` | FIXED |
| P17-09 | **Homepage claims not true for the listings.** "Verified businesses" with 0 verified; "Booking is completely free" beside deposits; "Instant confirmation" while most businesses confirm by hand. Fix: copy says what is true (no booking fees, book in seconds, what the badge requires). End to end: checked on the homepage | FIXED |
| P17-10 | **Pre-registration account takeover through an unverified email change.** `api/account/profile/route.ts` sets any address without verification, matching case-sensitively; sign-in and reset match case-insensitively with no ordering. An attacker can claim an owner's email before the owner signs up; the owner's reset link then sets a password on the attacker's row. Fix: lower-case, case-insensitive uniqueness, a pending address until a link is confirmed, a unique index on `lower(email)` | **FIXED in Phase 18**: the new address lives on the verification token and becomes the account's only when its link is followed; uniqueness is checked case-insensitively and a unique index on `lower(email)` is added (`phase18_email_change.sql`). Tests: `api/account/profile/route.test.ts` (fails 4/6 on the old route), `api/auth/verify-email/confirm/route.test.ts` |
| P17-11 | **Notifications are fire-and-forget and claimed SENT before sending.** `dispatch.ts` inserts the ledger row as SENT; callers use `void notify()`; nothing re-drives a stalled send, so a suspended function can lose a confirmation silently. Fix: `after()` from `next/server`, PENDING claims, and a cron that re-drives stale rows | FIXED in Phase 19: the ledger is an outbox (claimed PENDING, SENT/SKIPPED/FAILED on the provider's answer, retried with backoff, DEAD after five tries or a permanent refusal), routes send with `after()`, and `/api/cron/notifications` re-drives every 10 minutes. Tested on Postgres: `src/lib/notifications/outbox.db.test.ts` |
| P17-12 | **Production error monitoring is off.** No `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` in Vercel production (names listed 2026-10-28). Errors exist only in Vercel logs | OWNER (configuration) |
| P17-13 | **Terms of use say nothing about money.** No deposit, cancellation, refund, subscription or payout terms; dated March 2025. Paymob merchant review normally needs a refund policy | OWNER (legal text) |
| P17-14 | **Deleted accounts stay reachable through a recycled number.** `lib/account/deletion.ts` keeps bookings, the Customer row and reviews; account history is keyed on the phone, so the next holder of the number sees the old history. Fix: anonymise on deletion | OPEN |
| P17-15 | **`add_audit_followups.sql` unconfirmed on production** while #31 is live. If missing, plan payments and the waitlist fail | OWNER |

## P2

| ID | Finding | Evidence | Status |
|---|---|---|---|
| P17-16 | Unconditional status writes race (owner cancel vs. payment webhook; customer cancel vs. owner confirm; reschedule vs. cancel; the subscription cron can downgrade a business that just paid) | `business/bookings/[id]/route.ts:157`, both reschedule routes, `cron/subscriptions/route.ts:54` | FIXED in Phase 19: one transition table (`src/lib/bookings/transitions.ts`) and every move conditional on the status it was decided from (`src/lib/bookings/state.ts`; both reschedule routes; the subscription cron). A losing move gets 409 `changed`. Tested: `reliability.db.test.ts` (confirm vs. cancel race), `cron/subscriptions/route.test.ts` |
| P17-17 | Discount redemptions never released on cancellation or failure; per-customer limit checked outside the transaction; Customer keyed on the raw phone, so `010…` and `+2010…` are two customers | `create.ts`, `discounts/resolve.ts`, booking route upsert | PARTLY FIXED in Phase 19: a booking that is cancelled or whose hold is released hands its discount back (redemption row removed, count decremented; tested). The per-customer limit's timing and the Customer phone key remain OPEN |
| P17-18 | PROVIDER staff see the owner's private customer notes in the bookings list (the detail view hides them) | `api/business/bookings/route.ts:112,141` | FIXED in Phase 18 (`can(actor, "customers.read")` gate) |
| P17-19 | Email-verification link reusable for 24 h and republishes a suspended or rejected business | `api/auth/verify-email/confirm/route.ts` | FIXED in Phase 18: a SUSPENDED or REJECTED business is not republished; the link stays idempotent for the current address (tested) |
| P17-20 | Unbacked claims: "replies within 24 hours" (home, /for-business, /contact), Pro "Most popular", a "Most booked" row on almost no data; /for-business lists analytics among free features | `WhyJoin.tsx:30`, `i18n.ts`, `app/page.tsx:141` | OPEN |
| P17-21 | Live listing data: BerryGum (web design) under Education with an unpriced service and a mixed-language tagline; a Maadi business under Cairo; an unverifiable medical superlative | `prisma/data-fixes/2026-10-27-listing-cleanup.sql` covers part | OWNER |
| P17-22 | Contact page: Canadian address and phone vs "made in Cairo"; meta promises WhatsApp it does not show; legal entity unnamed | `app/contact`, `privacy/page.tsx` VERIFY notes | OWNER |
| P17-23 | `/en` shows Arabic city names in the Location block and an Arabic loading message | `CompanyContent.tsx:179`, `businesses/loading.tsx:26` | FIXED in Phase 18 |
| P17-24 | Reviews: reported (UNDER_REVIEW) reviews count toward ratings; an owner can book, complete and review their own business | `reviews.ts:32`, `review-policy.ts:62` | OPEN (decision) |
| P17-25 | Vercel: secrets stored as plain "Config", and Paymob's production keys are also given to Development and Preview deployments | `vercel env ls` | OWNER |
| P17-26 | Badge survives changing the verified phone or email; mobile password login rate-limited per IP only | `api/business/route.ts:53`, `api/auth/mobile/login/route.ts:34` | OPEN |
| P17-27 | Maestro E2E on `main` failed (2026-10-17); mobile tests and Playwright QA are not in CI | GitHub Actions | OPEN |
| P17-28 | No backup or restore procedure documented; Neon retention unverified | — | OWNER |

## P3

- `settlePayment` and `failPayment` update without a status guard (a
  concurrent decline and success).
- Reschedule routes detect overlap by message text only.
- Missing indexes `Booking(status, startsAt)` and
  `Booking(businessId, createdAt)`.
- No check that the charged price equals the quote.
- Staff creation links foreign service ids. This is seen in the QA
  data, where `qa-dr-1` is linked to another business's service.
- The quote endpoint has no rate limit, so discount codes can be
  enumerated.
- The idempotency key is not scoped to the business.
- Image upload is open to any signed-in account, and the client chooses
  the folder.
- Review reports have no throttle.
- A password reset leaves web sessions alive.
- Some reads trust `businessId` from the JWT.
- The sitemap `lastmod` is the request time.
- The footer shows the build hash.
- There is no `global-error.tsx`.
- `axe-core` is installed but unused.
- Six lint warnings.

## Found by code review of the Phase 17 changes (all FIXED)

A review of the remediation diff, before handoff, found nine problems
in the first version of the fixes. Each is fixed and tested:

| # | Problem in the first fix | Fix | Test |
|---|---|---|---|
| R1 | Bookings the owner types in had no email, so their customers got none | Optional email field in the manual booking form, stored on the booking | E2E "manual booking stores the email the owner typed" |
| R2 | A booking whose staff member was later deactivated or delisted could not be rescheduled | When moving a booking, its own member counts with their hours | `create.db.test.ts` "still lets a booking with a since-deactivated barber be moved" |
| R3 | Dashboard "upcoming today" (`tally`) still compared with the real instant | `tally` and `customerStats` compare with `cairoWallClock` | `stats.test.ts` "reads startsAt as Cairo wall-clock" |
| R4 | Cards' "next free" counted members who do not do the service | `firstFree` takes the service id; search and profile pass the shortest service's id | `next-free.test.ts` "does not count a member listed for other services" |
| R5 | A serialization retry reused the same assignment and could report "taken" with another barber free | Availability re-derived on a serialization failure, or when an auto-assigned member is taken | `create.db.test.ts` race now requires exactly 2 of 3 (5 runs, all pass) |
| R6 | A member's own "next free" ignored unassigned bookings | `firstFree` uses the team rule for a named member too | `next-free.test.ts` "owes an unassigned booking…" |
| R7 | "Anyone" always went to the longest-serving member | Least-loaded free member that day | `availability.test.ts` "spreads 'anyone' across the team" |
| R8 | The dashboard read the clock twice for one day range | One `cairoWallDay()` | — |
| R9 | The migration backfill copied `Customer.email`, possibly the planted address this phase closes | Backfill only from an account that has verified both the booking's phone and its email | Re-applied to QA |

## Phase 18

Fixed in Phase 18: P17-10, P17-18, P17-19, P17-23 (marked above), the
"24-hour reply" and "Most popular" claims and the "Most booked" row from
P17-20, and the "Verified only" hint. A code review of the Phase 18
changes found ten further problems in the first version of the
email-change flow and the filter panel; all fixed and tested
(`docs/phases/PHASE_18_REPORT.md`, "Code review of this phase's changes").

## Defects in my own verification, for the record

The first end-to-end run expected two "anyone" bookings at
`qa-listing-0` and got one. The engine was right: one of the two staff
members is linked only to another business's service, so they cannot
take this one. The script was corrected to count eligible staff and
re-run with a second eligible member added (then removed): 12/12.

## Phase 19

Found while hardening booking, payment and notification reliability.
All fixed in the Phase 19 PR unless marked OPEN.

| ID | Sev | Finding | Status |
|---|---|---|---|
| P19-01 | P1 | **A wallet or kiosk payment could never confirm.** Paymob reports those as `pending` first and the result later under the same transaction id; the webhook claimed the id on the pending delivery, so the final one was dropped as a duplicate (`WebhookEvent` unique key). Fix: a pending verdict releases its claim. Test: `route.db.test.ts` "pending under the same id" | FIXED |
| P19-02 | P1 | **Party size and table capacity were not enforced on the server**, and a booking that named no table at a restaurant held no table at all (it collided only with other table-less bookings). Fix: a named table must seat the party (422 `party-too-large`); "any table" is given the smallest free one that fits, or refused. Tests: `reliability.db.test.ts` (50 for one table; fills every table once; capacity) | FIXED |
| P19-03 | P2 | **Hard-coded UTC offsets in `cairoDayStart` (`[3, 2]`)** and `cairoDayEnd = start + 24h`, wrong on the two days a year the clock changes (23 and 25 hours). Fix: offsets come from Intl for the instant asked about (`zoneOffsetMinutes`, `wallToInstant`, `zonedDayStart/End`), parametrised by zone. Test: `instants.dst.test.ts` pins 24 April and 29 October 2026 | FIXED |
| P19-04 | P2 | **Opening hours past midnight were cut at 24:00**, so a venue open 20:00–02:00 could not take its 01:00 tables. Fix: the day's grid runs past 24:00 (`"25:00"` stored under the evening's date, `startsAt` on the next day), shown as `01:00 +1`. Tests: `availability.overnight.test.ts`; `scripts/qa-phase19.mjs` I1–I2 | FIXED |
| P19-05 | P2 | **A refund whose provider call timed out could be sent twice.** The route released the reservation on any failure; a retry after a timeout refunded again. Fix: an uncertain outcome (timeout, network, 5xx) keeps the reservation and the row PENDING until Paymob's own callback attaches it or a person settles it (runbook). Test: `route.db.test.ts` refund contention + attach | FIXED |
| P19-06 | P2 | **Owner cancel of an unpaid booking left its payment page live**, and the customer's reschedule wrote `PENDING` unconditionally, so a booking cancelled a moment earlier came back to life at a new time. Fix: every release closes open payment pages; reschedules are conditional on the status read; with auto-confirm on, a moved booking keeps its status | FIXED |
| P19-07 | P3 | The fake Paymob checkout was gated on `NODE_ENV`, so a local production build could not exercise the payment path end to end. Gate is now "not on Vercel, and the page is served from localhost" (tested) | FIXED |
| P19-08 | P2 | **Manual (owner) bookings bypass `createBooking`**: no table/party validation, no idempotency key, no `startsAt` re-derivation beyond the constraint. The exclusion constraints still prevent a double booking | OPEN |
| P19-09 | P3 | The mobile app renders `startTime` raw; a past-midnight slot would read `25:00` there (the web shows `01:00 +1`) | OPEN |
| P19-10 | P3 | `notifyLater` relies on `after()`; on a host without it the send runs inline and the outbox still records it, so nothing is lost, but a slow provider then slows the response | NOTED |
| P19-11 | P3 | The engine now offers last night's late tables after midnight (a lounge's 01:00 table at 00:20), but the booking widget's date list starts at today, so a customer cannot reach them from the web; API clients and the owner's flow can | OPEN |
| P19-12 | P3 | `/slots` runs the availability engine once per fitting resource (and per staff member inside each) and merges by scanning; fine at fixture sizes, O(tables × staff × slots) for a large venue. Cheaper: compute the window and open pieces once and test per-lane busy sets | OPEN |
| P19-13 | P2 | **Simultaneous bookings under one phone number returned 500**: Prisma's `customer.upsert` is a read then a write, so the losers hit the unique constraint before the booking's idempotency check could answer. Found by `scripts/qa-phase19.mjs` (ten retries with one key). Fixed: the loser reads the winner's row | FIXED |
| P19-14 | P2 | Under a burst of fifty requests for one table, requests at the back of the connection-pool queue failed with Prisma P2028 ("unable to start a transaction") and a 500. Seen once in four runs; not reproduced after the fix. Fixed: the booking transaction waits up to 10 s to start, a failed start is retried with jitter, and a true timeout is a 503 `busy` with `Retry-After` | FIXED |
| P19-15 | P3 | Prisma logs every expected exclusion-constraint loss at `error` level (151 lines for 80 contended requests); noise in production logs, not a fault | OPEN |
