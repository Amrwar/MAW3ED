# Baseline report (before programme Phase 17)

Date: 2026-10-28. Repository: `main` @ `77c8649`.

Scope: inspect the repository, establish a factual baseline, and set up
the roadmap and verification documents, without changing production
behaviour.

## Existing functionality discovered

See `docs/roadmap/FEATURE_INVENTORY.md` for the full list with evidence.
In short:

- **Built and verified locally:** discovery and search (including
  Arabic synonyms), business profiles, the booking flow, self-service
  booking links, reviews, customer accounts, the business dashboard
  (services, staff, bookings, calendar, CRM, reports, offers,
  resources), admin RBAC and audit, Arabic/English with `/en` URLs.
- **Built but incomplete:** multi-branch (services, staff and hours are
  business-wide), restaurant tables (no table-assignment tests),
  waitlist (no "it's listed now" email), the mobile apps (not in either
  store).
- **Blocked on an outside party:** real Paymob payments and refunds (no
  real payment has ever succeeded), WhatsApp and email delivery in
  production, push on a physical device, SMS (no provider), and any
  Emaar / Eterna Mall gate integration.
- **Missing:** venues and malls, compound visitor authorization,
  enterprise multi-venue admin, Google sign-in, automated accessibility
  checks.

The git history already uses phase numbers 17–34. How these documents
keep them apart from the programme's 17–28 is explained in
`docs/roadmap/MASTER_ROADMAP.md`.

## Features implemented or corrected

| Change | Why |
|---|---|
| `.github/workflows/ci.yml`: the minimum-test-count step reads the report from `vitest-report.json` | Vitest 5 (from PR #28) writes its JSON report to `.vitest/json/output.json`, not stdout. The step counted 0, failed every run on `main` from #28 to #31, and so the CI build step never ran |
| `.gitignore`: `.vitest/`, `vitest-report.json` | Vitest 5 output |

No application code changed.

## Files and migrations changed

- Added: `docs/roadmap/MASTER_ROADMAP.md`, `FEATURE_INVENTORY.md`,
  `PHASE_STATUS.md`, `TEST_MATRIX.md`,
  `docs/architecture/ARCHITECTURE_OVERVIEW.md`, this report.
- Changed: `.github/workflows/ci.yml`, `.gitignore`.
- Migrations: none.

## Architectural decisions

None taken. Two were noted for the owner (`MASTER_ROADMAP.md` →
Dependencies):

- Venues, malls and multi-venue admin need a level above `Business`,
  which should come before any feature that depends on it.
- Migrations are applied by hand with no record in the database. A
  ledger or a pre-deploy check would lower the risk of deploying code
  ahead of its migration.

## Security implications

None from this change. Observations at baseline:

- Authorization is enforced in route handlers and covered by unit tests
  (`permissions.test.ts`, `business-access.test.ts`,
  `api-bearer-coverage.test.ts`). The cross-tenant checks in
  `scripts/qa-security.mjs` are manual, not in CI.
- CSP uses a per-request nonce; one-time links store only hashes; the
  logger redacts personal data.
- Medical privacy: bookings link the service booked and store the customer's
  free-text notes. The baseline did not audit who can see notes for
  clinic bookings. **To be checked before any clinic-specific phase.**

## Automated test results (actual commands, 2026-10-28)

| Command | Result |
|---|---|
| `npx tsc --noEmit` (web) | exit 0 |
| `npx eslint` (web) | exit 0, 0 errors, 6 warnings |
| `npx vitest run` (web) | 79 files passed, 1 skipped; **934 passed**, 34 skipped |
| `PHONE_SQL_DATABASE_URL=… npx vitest run src/lib/phone-sql.test.ts` (local QA Postgres) | **34 passed** |
| `npx vitest run --reporter=json --outputFile=vitest-report.json` + count | 968 tests collected (the fixed CI step, run locally) |
| `cd mobile && npx tsc --noEmit` | exit 0 |
| `cd mobile && npx eslint .` | exit 0 |
| `cd mobile && npx vitest run` | 17 files passed, 1 skipped; **199 passed**, 10 skipped |

Not run: mobile backend integration test (needs a running API), Maestro
E2E (needs an APK and an emulator; the last GitHub run on `main` failed
on 2026-10-17), Playwright QA scripts, prettier, accessibility (no
automated check exists).

## Manual checks

Read-only, on production, 2026-10-28:

- `https://www.maw3ed.net/api/version` → commit `77c8649`.
- `/en/faq`, `/en/pricing` (which shows the Yearly option), `/waitlist`
  and `/categories` → HTTP 200.

Nothing that writes data was exercised in production.

## Unresolved issues

1. **`add_audit_followups.sql` on production is unconfirmed.** #31 is
   live. If the migration has not run, plan payments and the waitlist
   form fail. Owner action.
2. The Maestro E2E run on `main` (2026-10-17) failed; not investigated.
3. No real Paymob payment has succeeded yet.
4. No staging environment, so "staging verified" cannot be reported.
5. Mobile tests and Playwright QA are not in CI.
6. `axe-core` is installed but unused.

## Deployment considerations

The CI change affects only GitHub Actions. Merging it deploys the same
application code that is already live.

## Acceptance criteria

| Criterion | Status |
|---|---|
| Repository inspected; factual baseline written | MET |
| Roadmap and verification documents initialised (the five required files) | MET |
| Production behaviour unchanged | MET — no application code changed |
| Test results reported from real runs only | MET |

## Final verdict

**PASS** for the baseline. This is not a verdict on the product's
release readiness; see the unresolved issues above.
