# Phase 21 report: business onboarding and SaaS maturity

Date: 2026-10-30. Branch `phase-21-saas`, on `main` after PR #37.
Migration: `prisma/migrations/phase21_saas.sql` — **run it on production
before this code deploys.**

## How this phase was run

1. The onboarding wizard, dashboard, plan matrix, booking routes,
   verification code, admin panel and notification paths were read
   before anything was changed (inventory below).
2. Server-side rules came first, as pure functions with unit tests
   (readiness, CSV parsing, entitlements view, funnel, demo engine),
   then the database code with a Postgres test, then the screens.
3. Verified with the full Vitest suite, a Postgres suite for this
   phase, a production build, and an HTTP script that walks a brand-new
   owner from sign-up to a published page against that build. The
   earlier phases' QA scripts were rerun against the same build.
4. An independent code review of the whole diff; its findings and what
   was done about each are at the end.

## Existing functionality discovered (verified, kept)

- A five-step onboarding wizard (`src/app/onboarding`) whose progress
  lived only in the browser's localStorage.
- A business was published on creation once the owner's email was
  confirmed; there was no way to review the page first or to unpublish.
- The "موثّق / Verified" badge was awarded automatically once the
  owner confirmed an email and a phone and completed the page — contact
  verification presented to customers as identity verification.
- One plan matrix in `src/lib/plans.ts`, enforced at creation time for
  staff and branches and at booking time for deposits; downgrades
  already keep existing records (`wouldExceed` is asked only on create).
- Minimum notice, advance window, buffer and same-day cut-off existed
  on the business row but no screen could change them; the customer
  cancellation window was a fixed 2 hours in code.
- Reports, billing history, QR/booking links, CRM, staff and services
  pages already existed and were kept as they were.
- Support contacts in `src/lib/support.ts`; an FAQ page; no help
  articles, demo, import or onboarding measurement.

## Changes implemented

**A. Onboarding.** The wizard saves to the server as the owner types
(`/api/onboarding/draft`, 64 KB cap, unsent image data stays in the
browser) and resumes on any device; the browser copy remains as an
offline fallback. A business is now created private. The success
screen sends the owner to the setup page.

**B. Verification states.** Email, phone/WhatsApp, ownership and venue
are reported separately (`getVerificationStates`). The badge now means
an administrator checked ownership: verifying requires a written note
of what was checked, stored with who and when
(`identityVerifiedAt/ById/Note`). The migration carries over earlier
admin verifications from the audit log; badges earned only by contact
confirmation are removed. The homepage, admin verification page and
search filter hint now say what the badge means.

**C. Readiness.** `src/lib/business/readiness.ts` computes the
checklist from the business's rows: required items (category, phone,
confirmed email, address, hours long enough for the shortest service,
a bookable service with a valid duration, sane prices and deposits
coherent with the plan, reviewed policies) and recommended items
(map pin, WhatsApp, logo and description, team for barbershops,
tables for restaurants, a way to be notified, a test booking).
Publishing (`POST /api/business/publish`) refuses with the missing list;
when only the email is missing the request is kept and the confirmation
link completes it. Unpublishing hides the page and keeps bookings. A
suspended or rejected business is never published from here. The
setup page (`/dashboard/setup`) shows the checklist, the four
verification states, the policies form, the test-booking panel and
the publish switch; the dashboard home shows progress until the page
is live, and the nav puts Setup first until then.

**Owner preview and test bookings.** The owner, and only the owner
(session, not a URL parameter), can open the private page, see slots
and book. Those bookings are `isTest`: same engine and constraints, no
customer record, no deposit, no discount, no notification, no reminder,
not counted toward the plan, excluded from KPIs, reports, analytics and
the admin reports, labelled "Test booking" in the lists, and deleted
when the page is published.

**Policies.** Auto-confirm, minimum notice, advance window, buffer,
same-day cut-off and the cancellation window are editable together;
saving with `reviewed: true` marks them reviewed. The cancellation
window is now per business and used by the cancel and reschedule
routes, the booking page, the profile, the customer account and the
booking emails.

**D. Entitlements.** `GET /api/business/entitlements` returns plan,
effective plan, status, limits (null = unlimited), live usage, features
and the cheapest upgrade per missing feature, all from `plans.ts`. The
audit found two places where the server did not apply the rule the
screen did: the analytics API returned data to free plans (only the
page was gated) and deposits could be switched on by a free plan. Both
are now refused server-side (403, `plan-required`). Live prices on
maw3ed.net/pricing (299 / 499 EGP) match the code (read-only check,
2026-10-30). No trial is granted anywhere today; the help text does not
promise one.

**E. Daily operations.** Pending requests get a direct link from the
dashboard home to the filtered list (`/dashboard/bookings?status=PENDING`);
settings tabs can be linked (`?tab=hours`, `?tab=notifications`). Other
operations screens were reviewed and left as they were.

**F. Demo.** `/demo`: a fictional salon in the browser only — calendar
with status changes, a booking flow on the real availability engine,
customers, reports counted the real way, team allocation, reset. A
banner says it is fictional and nothing is saved. A unit test fails if
any demo file imports the database, the API helpers, the session or
calls `fetch`.

**G. CSV import.** Customers and services, Arabic or English headers,
BOM, CRLF, quoted cells, semicolon files, Arabic-Indic digits;
1 MB / 2,000 rows. Preview shows ready rows, duplicates (in the file
and against existing records, phones compared in normalised form) and
every error by line; nothing is written until commit, which re-runs
the validation on the server and writes rows plus an `ImportBatch` in
one transaction. Rollback removes what the batch created except
records that have had a booking since, and is scoped to the caller's
business (another business's batch is a 404). A row with more cells
than headers is refused, because an unquoted "1,250" would otherwise
import a price of 1.

**H. Help and lifecycle.** `/help` with six ar/en articles (setup and
publishing, test bookings, verification, import, plans and limits,
why a booking fails) built from the same constants as the rules they
describe, linked from the setup and import pages and the dashboard
nav. Lifecycle milestones (registered, onboarding started, profile
completed, published, first real booking, first completed booking,
first paid subscription) are recorded once per account
(`LifecycleEvent`), never block the action they mark, contain no
customer or visitor data, and are listed in the privacy policy draft.
`/admin/onboarding` shows the funnel as a cohort.

## Database changes

`prisma/migrations/phase21_saas.sql` (idempotent; applied twice to the
QA database with identical results):

- `Business`: `publishRequestedAt`, `policiesReviewedAt`,
  `cancellationCutoffHours` (default 2), `identityVerifiedAt`,
  `identityVerifiedById`, `identityVerificationNote`.
- `Booking.isTest` (default false).
- New tables `OnboardingDraft`, `ImportBatch`, `LifecycleEvent` and
  enums `ImportKind`, `LifecycleEventKind`.
- Backfills: every existing business gets `publishRequestedAt =
  createdAt`; identity verification from the last un-reversed
  `business.verify` audit entry, and `isVerified` follows it;
  lifecycle events from existing businesses, bookings and payments.

## Tests executed

All on 2026-10-30, on the final code, against the local QA database
(`maw3ed-qa`, migration applied) and a production build on :3101.

| Suite | Result |
|---|---|
| Web typecheck | PASS |
| Web lint | PASS — 0 errors, 6 warnings (same 6 as `main`) |
| Mobile typecheck (no mobile file changed; it reads the per-business cancellation window from the API) | PASS |
| Production build (`next build`) | PASS — `/demo`, `/help`, `/help/[slug]`, `/dashboard/setup`, `/dashboard/import`, `/admin/onboarding` built |
| Unit + route tests (`npx vitest run`) | PASS — 1059 passed, 79 skipped (1138; 105 files). Phase 20: 1038 |
| Same with Postgres (`BOOKING_DB_TEST_URL=… --no-file-parallelism`) | PASS — 1104 passed, 34 skipped |
| New unit tests: `readiness.test.ts` (8), `csv.test.ts` (10), `entitlements.test.ts` (2), `funnel.test.ts` (2), `workspace.test.ts` (4, incl. demo isolation), confirm-route test (+1) | PASS |
| `src/lib/business/phase21.db.test.ts` (Postgres, 9): publish refused with the missing list; email completes a requested publish; no publish without a request; suspended never published; test booking not counted, no customer, no notification, not in the number owner's account, deleted on publish, refused once public; unpublish keeps bookings and forgets the request; customer import with existing-duplicate skip, cross-tenant rollback refused, rollback keeps a customer with a booking, second rollback refused; service import and rollback; lapsed PRO keeps three staff, effective FREE refuses a fourth | PASS — 9/9 |
| `scripts/qa-phase21.mjs` (HTTP, real browser session): sign-up → server draft → resume elsewhere → oversized/anonymous draft refused → private business → readiness → publish refused → policies (and out-of-range refused) → owner preview 200 / anonymous 404 → owner slots / anonymous 404 → owner test booking through the real route / anonymous refused → stored as test, no customer, labelled, not counted, nothing queued → publish waits for email → publishes, test booking removed → public → unpublish hides → import preview (2 ready, 1 error, 1 duplicate) writes nothing → commit → rival 404 / anonymous 401 on rollback → owner rollback → entitlements → free plan refused analytics data and deposits, deposits off allowed → demo, help ar/en, unknown article 404, setup/import/dashboard render, setup needs a session | PASS — 44/44 (three runs, the last on the final build) |
| Migration applied twice to QA | PASS — second run changes nothing; markers set |

### Tests NOT RUN / BLOCKED

- Production and staging: no staging environment; the migration has
  not been run on production (owner action).
- Live email/WhatsApp delivery (unchanged from earlier phases; test
  bookings are now proven to queue nothing).
- Paid upgrade/downgrade through Paymob: BLOCKED as before (no live
  Paymob). Downgrade preservation was tested by changing the
  subscription state directly (DB test).
- Mobile E2E (Maestro): not run; no mobile change.

## Regression results

Every earlier QA script was rerun against this phase's production
build:

| Script | Result |
|---|---|
| `qa-phase17.mjs` | 13/13 |
| `qa-phase18.mjs` (now also covering `/demo`, `/help`, `/help/test-booking`, `/dashboard/setup`, `/dashboard/import`, `/admin/onboarding`, `/admin/verification`) | 376 page loads: 0 overflow, 0 serious/critical axe violations; only the deliberate 404 page logs its 404, as in Phase 18. An earlier run caught a contrast failure on the new demo button (fixed) |
| `qa-phase19.mjs` | 21/21 (a first run reported J1 as failing because the server was started with a different `CRON_SECRET` from the one the script documents; rerun with the documented secret) |
| `qa-phase20.mjs` | 19/19 |
| `qa-security.mjs` | 32/32 |
| `qa-booking-e2e.mjs` | 19/19 after two fixes, below |

The booking journey failed twice on the evening of 2026-10-30 and both
were investigated rather than retried away:

1. **A real widget bug, older than this phase:** choosing a two-seat
   table and then raising the party size to three left the table
   selected, so every day showed "No available times" with no reason.
   Raising the party size now deselects a table that no longer fits
   (`BookingWidget.tsx`); checked in a browser (T1 deselected and
   disabled). The script now sets the party size before choosing, as a
   customer does.
2. **The clock, not the code:** at 20:30 Cairo the only times left
   today were inside the two-hour cancellation window, so no cancel
   button was shown — correct behaviour. Booking for tomorrow through
   the API showed the button and cancelled. The journey now books
   tomorrow so it does not depend on the hour it runs.

Behaviour an existing user can notice is listed under Known limitations
(badge change; publish-on-confirmation now needs the checklist).

## Security findings

Found and fixed in this phase (none reached production):

- **Plan rules applied only in the UI:** the analytics API served free
  plans, and deposits could be switched on by a free plan. Now refused
  server-side.
- **Test bookings as a message relay** (review finding 1): a test
  booking skips phone proof, and later confirm/cancel/reschedule
  notifications still went to whatever number the owner typed. The
  notification dispatcher now refuses every event for a test booking.
- **Test bookings in a stranger's account** (finding 2): matched by
  phone, they appeared in that person's "my bookings", and the number's
  last test booking could name a new account. Both now exclude them.
- **Contact checks shown as identity verification:** the badge now
  requires an administrator and a written note.
- Tenant isolation of the new routes was checked by the reviewer and by
  the HTTP script (another business's import batch is a 404; all new
  routes are owner-only; drafts are keyed by account). The route-guard
  test covers every new API route.

No open security finding from this phase.

## Performance findings

- The readiness checklist is one query with counts; the dashboard home
  runs it only while the business is unpublished.
- Import duplicate detection loads the business's existing phones or
  service names once per request; fine at the 2,000-row cap and
  current business sizes.
- The funnel page loads the events of accounts that started in the
  window; at current volumes this is a few hundred rows.
- No measurements were taken beyond the QA runs; nothing here runs on
  a public hot path except the owner-preview check, which only
  executes for unpublished businesses.

## Known limitations

- **Behaviour change for existing listings:** businesses whose badge
  came only from contact confirmation lose it when the migration runs.
  Existing businesses that were waiting on email confirmation will now
  publish on confirmation only if they also pass the checklist; they
  must review their policies first (the setup page tells them).
- **Between running the migration and the deploy** the old code is
  still live: it can re-award the badge for contact checks (running the
  file again after the deploy removes those), and businesses created in
  that window get no publish request, so their email confirmation will
  not publish them — their owners publish from the setup page. Keep the
  window short.
- An existing published business shows "policies" as not done on its
  checklist until the owner saves them; it stays published.
- The help articles and demo are static; there is no in-product search
  of help.
- Venue verification is shown as "not offered"; there is no venue
  model yet (Phase 22+).
- Lifecycle backfill cannot recover "onboarding started" or "profile
  completed" for businesses created before this phase.
- Import covers customers and services; staff, bookings and opening
  hours are not imported.

## Remaining work

- Owner: run `prisma/migrations/phase21_saas.sql` on production
  immediately before the deploy, and once more right after it.
- Owner/admin: re-verify, with evidence, any business that should keep
  the badge (the migration keeps only those an admin verified before).
- Not built in this phase: in-product help search, import of staff,
  bookings and hours, venue verification, a trial (no trial is granted
  today; whether to offer one is a business decision).

## Release readiness

Ready to merge and deploy **after** the migration is run on production.
Locally verified end to end; not verified on staging (none exists) or
production. Deploying without the migration would break onboarding,
publishing and booking reads of the new columns.

## Next phase dependencies

- Run `phase21_saas.sql` on production before deploying.
- An administrator should re-verify, with evidence, any business that
  should keep the badge.
- Venue verification needs the venue/mall model.

## Code review of this phase's changes

An independent review of `git diff main...HEAD` reported seven items;
each was confirmed in the code and fixed, with tests where they could
be written:

| # | Finding | Fix |
|---|---|---|
| 1 | Test bookings still triggered notifications after creation (confirm, cancel, reschedule), to an unproved number | `loadBooking` in the dispatcher returns nothing for a test booking, so no channel sends; DB test asserts it |
| 2 | Test bookings appeared in real customers' accounts (matched by phone) | `ownedWhere` excludes them; a new phone account is no longer named from one; DB test |
| 3 | A review on a test booking left a phantom rating after publish; a manual payment on one survived publish | Reviews and payments on test bookings refused (409); publish recomputes the rating when it deletes test bookings |
| 4 | The email-confirmation page said "your page is live" when it was not, and promised the badge for a WhatsApp check | The route reports `success` only when the page is public, otherwise a new `setup` result that sends the owner to the checklist; copy corrected; unit test |
| 5 | Re-running the migration after deploy would re-mark publish requests | One-time backfills are guarded by a marker on their column; the badge resync stays unconditional so a rerun after deploy removes badges the old code re-awarded in between; applied twice to QA |
| 6 | Races: a test booking in flight during publish; a suspension between the check and the publish | Publish locks the business row and re-reads its status; test-booking creation takes a share lock and stops if the page is public (`business-published`); DB test |
| 7 | The completed-booking milestone was written outside its transaction; attribution and the mobile overview counted test bookings; a draft save racing business creation could survive it | Milestone written through the transaction; filters added; the draft route re-checks after writing |

Also found by this phase's own QA: the new "Try the demo" button on
`/for-business` failed colour contrast (2.81:1) on the dark hero; it now
uses the outline style that passes.
