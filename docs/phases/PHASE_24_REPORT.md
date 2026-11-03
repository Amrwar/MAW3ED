# Phase 24 report: organization platform, venue configuration and pilot validation

Date: 2026-11-03. Branch `phase-24`, on `main` at `3c3cd4a` (Phase 23 and
its follow-ups, live).

## Scope as run

The owner's Phase 24 prompt, with the owner's standing decision of
2026-11-03 that **Eterna is a concept only**. "Use Eterna Mall as a
representative venue configuration" was therefore done with a clearly
labelled fictional mall: "Nile Gate Mall (fictional test data)". No real
operator data was used, and nothing was created on production.
Everything ran on a production build against the QA database.

## Phase 22 and 23 completion, verified first

| Phase | Report | State found |
|---|---|---|
| 22, 22b, 22 final | `PHASE_22_REPORT.md`, `PHASE_22B_REPORT.md` | Merged and live. Migrations applied and verified on production. Signed-in organization flows never exercised on production, because no organization exists there |
| 23 (+ follow-ups #49) | `PHASE_23_REPORT.md`, `docs/qa/PHASE_23_*` | Merged and live (`3c3cd4a`). Discreet migration applied and verified 2026-11-03. Signed-in check (QR, check-in) partly done on production 2026-11-03; the final check-in was due at 09:20 Cairo. E (real gate) BLOCKED |

Phase 24 builds on both without changing their contracts.

## Gaps found by inspection and testing, and fixed

| # | Gap | Fix |
|---|---|---|
| G1 | **Aggregated reporting for groups was missing.** Organization metrics were page visits and bookings that started on the organization's page. A restaurant group had no view across its brands | `lib/organizations/portfolio.ts`, `GET /api/organizations/:id/portfolio`, and a "Businesses" section in the organization console. It covers OWNED and MANAGED businesses, each with what it shares: counts with REPORTS, revenue with FINANCE, otherwise "not shared". Never hosted tenants, never a customer, test bookings excluded, a business counted once in totals. Paused, expired and branch-only relationships share nothing. A suspended organization sees nothing. DB test 4/4 |
| G2 | **Tables and rooms could not be delegated.** Resources were owner-only and no scope covered them, so a restaurant group could never manage its brands' tables | A new scope, `RESOURCES` ("Tables and rooms" / "الترابيزات والغرف"). It is its own scope so that no existing grant widened. Business-wide, so not on branch relationships. The resources API and page now check `resources.read` / `resources.manage`; delegate navigation and acting paths include the page. Migration `phase24_resources_scope.sql` |
| G3 | The scope validator kept its own copy of the scope list, so G2 was refused (422) until it read the shared list | `rules.ts` derives the list from `DELEGATION_SCOPES` |
| G4 | The console's per-business visit counts showed Arabic names in English, and merged two businesses with the same Arabic name | Names in both languages, grouped by business |

## Findings recorded, not fixed (`docs/eterna/LAUNCH_READINESS.md`)

* **F1 (P2, pilot).** Reloading the booking page with no connection
  shows the offline notice, not the QR. There is a documented staff
  fallback, and two product options.
* **F2 (info).** The free plan's monthly allowance holds extra online
  bookings for confirmation. This is by design; pilot tenants need the
  right plan.

## Database changes

`prisma/migrations/phase24_resources_scope.sql`:
`ALTER TYPE "DelegationScope" ADD VALUE IF NOT EXISTS 'RESOURCES' AFTER 'STAFF'`.

* Additive and idempotent; grants nothing.
* Applied on QA.
* **Must be applied to production before this PR deploys.** Helper:
  `migrate-phase24.sh` in the session scratchpad, verify included.
* The previous code runs unchanged on the migrated schema.

## Tests

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 6 warnings (the same six as `main`) |
| `npx next build` | compiled |
| `BOOKING_DB_TEST_URL=… npx vitest run` | 1311 passed, 0 failed (after the audit) |
| `node scripts/qa-phase24.mjs` | **144/144** (parts 1, 2, 3, 4, 6) |
| `node scripts/qa-phase24-browser.mjs` | **21/21** (journey ar/en, offline, 40 page loads swept, failure and retry) |
| `node scripts/qa-phase24-load.mjs` | **13/13** (part 5) |
| Regression QA scripts | 15 earlier scripts pass (`docs/qa/PHASE_24_REGRESSION_RESULTS.md`, with what did not run) |

Details, numbers and what was simulated:
`docs/eterna/ORGANIZATION_TEST_RESULTS.md`.

## Verdicts (the owner's nine items, rated separately)

| # | Item | Verdict | Basis |
|---|---|---|---|
| 1 | Owned organization journeys | **PASS (local)** | Restaurant group A 25/25; clinic group C 12/12; G1 and G2 fixed |
| 2 | Hosted organization journeys | **PASS (local)** | Mall B 25/25: invitations, approval, join request, venue places, directory, privacy-safe reporting, no tenant access |
| 3 | Delegated management journeys | **PASS (local)** | D 12/12: scoped, immediate revocation, no escalation, audit |
| 4 | Organization public directories | **PASS (local)** | Directory, categories, search, ar/en, QR byte-exact; browser sweep clean; load p95 369 ms page, 128 ms API |
| 5 | Booking through organizations | **PASS (local)** | Part 3 (HTTP and real widget): attribution kept, ownership unchanged; 0 double bookings under contention |
| 6 | Booking QR and check-in | **PASS (local)**; production partly verified in Phase 23 | Parts 3 and 4: early, on time, late, expired, no-show, unauthorized, invalid, rescheduled, cancelled. Offline reload is the F1 finding |
| 7 | Optional visitor access | **PASS (sandbox)** | Policy, guests, gates, revocation on cancel, no-show, removal, reschedule; discreet clinics at the desk |
| 8 | Sandbox provider integration | **PASS (sandbox)** | Issued, gate events, signed callbacks deduplicated 3×, provider down and recovery, cross-venue refusal; load 60 passes in one queue run |
| 9 | Real Emaar partner integration | **BLOCKED (external)** | No agreement, documentation, credentials or test gate (`PARTNER_INTEGRATION_STATUS.md`) |

**Generic organization readiness: PASS (locally verified).**
**Real pilot: NOT LIVE.** It needs:

* a real operator's written authorization;
* the privacy decision (Phase 22, O6);
* production configuration and verification with that operator;
* for gate passes, the partner milestone.

## Release

1. Run `migrate-phase24.sh` on production. Expect `applied`, then
   `VERIFIED`.
2. Merge the Phase 24 PR.
3. Optionally, with the owner's go-ahead, run a signed-in production
   check. It creates public pages, so the owner chooses names, and the
   pages can be hidden afterwards.

## Post-phase audit (2026-11-03)

`docs/qa/PHASE_24_POST_AUDIT.md`, with the loop audit, regression results
and open issues beside it in `docs/qa/`.

* Two independent code reviews: 18 findings, 16 fixed, 2 kept by decision.
* Six DB tests and four HTTP or browser checks added.
* **Verdict: PARTIAL.** The final build's browser checks, the site-wide
  sweep and part of the battery could not run, because the QA machine ran
  out of memory. One load run missed latency targets. The offline-reload
  finding stays open. No P0 or P1 is open.

Phase 25 is not started.
