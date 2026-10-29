# Phase 17 report: production audit and remediation

Date: 2026-10-28. Branch `phase-17-audit`, on top of PR #32 (baseline
docs and CI fix). Base: `main` @ `77c8649`, which is what production
serves.

Companion documents:

- `docs/audits/PHASE_17_AUDIT.md`: inventory, website and architecture
  audit, external systems not tested.
- `docs/audits/CRITICAL_FINDINGS.md`: every finding, with severity,
  evidence, reproduction, root cause, fix and tests.

## Existing functionality discovered

Counted on 2026-10-28: 77 pages, 96 route handlers (124 HTTP methods),
41 Prisma models, 23 enums, 28 SQL migrations, 80 web test files, 45
mobile screens, 18 mobile test files, 19 Maestro flows. Versions and
the area-by-area state are in the audit. The architecture is unchanged
from `docs/architecture/ARCHITECTURE_OVERVIEW.md`.

What the audit confirmed sound: tenant isolation on every id-taking
route, server-side authorization, the Paymob webhook (HMAC, amount and
currency checks, de-duplication), the refund reservation, the
cancellation cutoff, review eligibility, security headers, SEO basics,
and every internal link and sitemap URL (all 200).

## Features implemented or corrected

Three P0 defects and five P1 defects were fixed; nine problems that a
code review found in the first version of those fixes were fixed too.

| ID | Defect | Change |
|---|---|---|
| P17-01 (P0) | "Any available", the booking widget's default, double-booked staff | `computeStaffedAvailability`: a time is offered to "anyone" only when a member who does the service is free, and the booking is given to the least-loaded free member. Unassigned bookings count against the team. Cards' and profiles' "next free" use the same rule |
| P17-02 (P0) | Premium sold five features nothing implements | Removed from the plan matrix, labels and copy. A test now fails for any plan row no code checks |
| P17-03 (P0) | Anyone could redirect a customer's booking emails and manage links | New `Booking.customerEmail`; every customer email, and Paymob billing data, reads it. `Customer.email` is now only the owner's contact card |
| P17-04 (P1) | A shared room or table double-booked across staff | Resource collision checked first; two new DB exclusion constraints |
| P17-05 (P1) | Public booking trusted staff, resource and branch ids | Refused unless an active row of this business; a booking's own member still counts when moving it |
| P17-06 (P1) | Reminders and the owner's Today list used the real clock against wall-clock `startsAt` | `cairoWallClock` / `cairoWallDay` in the cron, dashboard queries, KPI tally and customer stats |
| P17-07 (P1) | Serialization failures reported as "slot taken" | Availability re-derived and the insert retried |
| P17-08 (P1) | JSON-LD `"priceRange":"0 EGP"` | Unpriced services excluded |
| P17-09 (P1) | Homepage: "Verified businesses" with none verified, "completely free" beside deposits, "instant confirmation" | Copy says what is true |
| R1–R9 | From the code review of the fixes (see `CRITICAL_FINDINGS.md`) | Manual-booking email field; reschedule with a delisted member; KPI frame; service-aware "next free"; retry re-derivation; load spreading; one clock read; a safe backfill |

No broad redesign. No application behaviour changed beyond the defects
listed.

## Files and migrations changed

- **Migration (new, must run before deploy):**
  `prisma/migrations/phase17_booking_integrity.sql`: adds
  `Booking."customerEmail"`, backfills it only from accounts that
  verified both the phone and the email, and adds
  `booking_no_overlap_resource` and `booking_no_overlap_staff`, each
  only when existing data satisfies it (a NOTICE and a query are
  printed otherwise). Idempotent; applied twice to the QA database.
- **Schema:** `prisma/schema.prisma` (`Booking.customerEmail`).
- **Booking engine:** `src/lib/bookings/availability.ts`,
  `schedule.ts`, `create.ts`, `instants.ts`.
- **Discovery:** `src/lib/discovery/next-free.ts`, `profile.ts`,
  `search.ts`, `src/app/company/[slug]/page.tsx`.
- **Routes:** `src/app/api/public/[slug]/bookings/route.ts`,
  `api/business/bookings/route.ts`, `api/cron/reminders/route.ts`,
  `api/booking/[token]/reschedule/route.ts`,
  `api/public/booking/[token]/pay/route.ts`,
  `api/business/bookings/[id]/payments/route.ts`.
- **Dashboard:** `src/app/dashboard/page.tsx`,
  `src/lib/dashboard/queries.ts`, `stats.ts`,
  `src/features/dashboard/ManualBookingPanel.tsx`.
- **Notifications:** `src/lib/notifications/dispatch.ts`.
- **Plans and copy:** `src/lib/plans.ts`, `src/lib/i18n.ts`,
  `src/lib/jsonld.ts`.
- **Tests (new):** `src/lib/bookings/create.db.test.ts`,
  `src/app/api/cron/reminders/route.test.ts`,
  `scripts/qa-phase17.mjs`. **Tests (extended):** `availability.test.ts`,
  `next-free.test.ts`, `instants.test.ts`, `plans.test.ts`,
  `jsonld.test.ts`, `stats.test.ts`.
- **Docs:** `docs/audits/PHASE_17_AUDIT.md`, `CRITICAL_FINDINGS.md`,
  `docs/roadmap/FEATURE_INVENTORY.md`, `TEST_MATRIX.md`,
  `PHASE_STATUS.md`, `MASTER_ROADMAP.md`, this report.

## Architectural decisions

- **A booking's email lives on the booking.** Where a message goes is a
  fact about that booking, given by the person who made it. The
  Customer record is the owner's, and an anonymous request may create
  it; it must never decide where a stranger's confirmations go.
- **Staff capacity is a team question.** "Anyone available" is resolved
  by the server to a specific member at booking time, and bookings with
  nobody on them are owed by the team. The database holds both rules
  with per-resource and per-staff exclusion constraints, so a race
  cannot undo them.
- **`startsAt` is Cairo wall-clock stored as UTC.** That was already the
  convention; this phase makes every comparison obey it and adds
  `cairoWallDay` for day ranges. Converting the column to real instants
  would be the cleaner long-term design and is noted for a later phase.
- **The plan matrix only lists what code enforces**, and a test keeps it
  that way.

## Security implications

- P17-03 closed an unauthenticated way to receive another person's
  booking details and manage links (view, cancel, reschedule),
  including at clinics.
- P17-05 closed a way to attach another tenant's staff, resource or
  branch to a booking.
- **Still open and serious:** P17-10, an unverified email change that
  lets an attacker claim an owner's address before the owner registers
  and end up owning the business. Not fixed here because it is not
  related to a P0 correction and it changes the account flow;
  **recommended as the first item of Phase 18.**
- Also open: notifications claimed SENT before sending (P17-11),
  deleted accounts reachable by a recycled number (P17-14), Sentry off
  in production (P17-12), secrets stored as plain Config with Paymob
  keys shared with preview deployments (P17-25).

## Automated test results (actual commands, 2026-10-28)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` | 0 errors, 6 warnings (the baseline's 6) |
| `npx vitest run` | 80 files passed, 2 skipped; **960 passed**, 39 skipped (999). Baseline was 934 |
| `BOOKING_DB_TEST_URL=… npx vitest run src/lib/bookings/create.db.test.ts` (local Postgres) | **5/5**, five consecutive runs. The original 4 tests, run against the pre-Phase-17 code with the fixes stashed: **4/4 FAIL** |
| `npx vitest run src/app/api/cron/reminders/route.test.ts` against the old route | 3/3 FAIL; against the new route 3/3 pass |
| `PHONE_SQL_DATABASE_URL=… npx vitest run src/lib/phone-sql.test.ts` | 34/34 |
| `npm run build` (production) | exit 0 |
| `node scripts/qa-phase17.mjs` against `next start -p 3101` and the QA DB | **13/13** (twice: before and after the review fixes) |

Regression tests exist for every fixed defect; the mapping is in
`CRITICAL_FINDINGS.md`.

## Manual tests completed

- Production, read-only: `/api/version` = `77c8649`; TTFB on ten public
  URLs (0.06–0.21 s); security headers; `robots.txt`, `sitemap.xml`,
  75 internal links and 50 sitemap URLs (all 200); `/api/dev/paymob/checkout`
  returns 404; Vercel production variable names listed (no values).
- Local production build against the QA database (`scripts/qa-phase17.mjs`):
  three concurrent "anyone" bookings at a two-member business → two
  accepted, to different members, third refused, slot withdrawn; typed
  email stored on the booking; manual booking stores the owner's email;
  a 22:30 booking appears in the owner's Today list (signed in through
  the browser); no unbuilt Premium feature, overstated claim or
  "0 EGP" on `/`, `/en`, `/pricing`, `/en/pricing` or a business page.
  All test data removed and confirmed gone.

## Unresolved issues

Prioritised list: `CRITICAL_FINDINGS.md`. In order of urgency:

1. P17-15 (owner): confirm `add_audit_followups.sql` ran on production.
2. P17-10: unverified email change / account takeover.
3. P17-11: fire-and-forget notifications.
4. P17-12 (owner): set `SENTRY_DSN` in production.
5. P17-13 (owner): terms covering deposits, refunds, cancellation, plans.
6. P17-14: anonymise on account deletion.
7. P17-16, P17-17: status-write races; discount release and phone-keyed customers.
8. P17-25 (owner): secrets as sensitive; restrict Paymob keys to production.
9. Everything else in the P2/P3 lists.

## Deployment considerations

1. Merge PR #32, then the Phase 17 PR.
2. **Before the Phase 17 deploy**, run
   `prisma/migrations/phase17_booking_integrity.sql` on production. The
   code writes `Booking.customerEmail` on every booking; without the
   column every booking fails. Read the output: if either constraint
   was not added, the NOTICE says how many overlapping pairs exist and
   the file has the query to list them.
3. Rollback: revert the merge. The new column and constraints are
   harmless to the old code.
4. After deploy: make one "any available" booking at a business with
   staff and confirm the dashboard shows a member on it; check Vercel
   logs for `[createBooking]`.

## Acceptance criteria

| Criterion | Status |
|---|---|
| Full current architecture mapped | MET (`PHASE_17_AUDIT.md`, `ARCHITECTURE_OVERVIEW.md`) |
| Feature inventory based on real code | MET (`FEATURE_INVENTORY.md`, updated) |
| Every P0 finding resolved or explicitly blocking release | MET in code: P17-01, 02, 03 fixed with tests. **Not yet in production** |
| Regression tests added for repaired defects | MET |
| Build and applicable tests passing | MET |
| Remaining P1/P2/P3 prioritised | MET |
| No fabricated production content | MET |
| No destructive production changes | MET (nothing written to production) |
| Phase 18 can begin from a stable baseline | MET once the PR is merged and the migration run |

## Final verdict

**PARTIAL.** Code complete and verified locally; the three P0 defects
are still live on maw3ed.net until the Phase 17 PR is merged with its
migration applied. It becomes PASS when the owner confirms the
migration ran and the deploy is up. Staging: NOT RUN (none exists).
Partner verification: n/a for this phase.
