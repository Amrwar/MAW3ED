# Phase 24 — regression results

Environment: Windows 11, 24 cores, 32 GB. The QA server is a production
build (`next build`, then `next start -p 3101`) with `ACCESS_SANDBOX=1`,
using the QA Postgres in Docker (`maw3ed-qa`). The commands that need
secrets read them from local files and never print them.

Three builds are referred to:

* **B1:** `ec7b9ef`, the Phase 24 code before review.
* **B2:** `1bf09bc` and `8f83482`, after review round 1, plus the audit
  tests. Built and served during the audit.
* **B3:** `6ea7a05`, after review round 2. Typechecked, linted and
  unit/DB-tested. **Not served:** the QA server was stopped for low
  memory before B3 could be built (see "Not run").

## Static checks and suites (on B3, the final code)

| Test | Command | Result | Status |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors | PASS |
| ESLint | `npx eslint .` | 0 errors, 6 warnings (the same 6 as `main`) | PASS |
| Unit, integration and DB | `BOOKING_DB_TEST_URL=… npx vitest run --maxWorkers=4` | **1311 passed**, 34 skipped, 0 failed (120 files) | PASS |
| Phase 24 DB suite | `… vitest run src/lib/organizations/phase24.db.test.ts` | 10/10 (4 phase tests and 6 audit tests) | PASS |
| Environment declarations | `src/lib/env-coverage.test.ts` | PASS, after the load script's knobs became `--tenants` and `--seconds` (it had caught two undeclared variables) | PASS |
| Mobile | `cd mobile && npx vitest run`; `npx tsc --noEmit` | 206 passed, 10 skipped; 0 type errors | PASS |
| Production build | `npx next build` | Compiled (B1 and B2). Not rebuilt for B3 (memory) | PASS (B2) |
| Dependency audit, web | `npm audit --omit=dev` | 5 moderate (Sentry build tooling), unchanged since Phase 22 (O3) | Known |
| Dependency audit, mobile | `cd mobile && npm audit --omit=dev` | 30 (2 low, 22 moderate, 6 high), unchanged since Phase 22 (O2) | Known |

## QA scripts against the running build

| Script | Scope | B1 | B2 (audit) | Status |
|---|---|---|---|---|
| `qa-phase24.mjs` | Organization journeys, customer journey, exceptions, security | 144/144 | **147/147** (3 audit checks added) | PASS |
| `qa-phase24-browser.mjs` | Journey ar/en, offline, 40-load sweep, failure and retry | 21/21 | **22/22** | PASS on B2; the round-2 checks are **not run** |
| `qa-phase24-load.mjs` | Part 5 | 13/13 | Run 1: **10/13**. Run 2: **13/13** | See "Performance variance" in the post audit |
| `qa-booking-e2e.mjs` | Booking widget ar/en | 22/22 | 22/22 | PASS |
| `qa-phase23.mjs` | Check-in, passes | 48/48 | 48/48 | PASS |
| `qa-phase23-loops.mjs` | Loop audit (Phase 23) | 15/15 | 15/15 | PASS |
| `qa-security.mjs` | Security regression | 32/32 | 32/32 | PASS |
| `qa-phase23-browser.mjs` | Phase 23 screens | 49/49 | 49/49 | PASS |
| `qa-loops-browser.mjs` | Browser loop audit | 9/9 | not reached | PASS (B1) |
| `qa-venue-console.mjs`, `qa-venue-page.mjs` | Venue screens | clean, clean | not reached | PASS (B1) |
| `qa-phase22c.mjs` | Relationships and delegation | 59/59 | not reached | PASS (B1) |
| `qa-phase22b.mjs` | Organizations | 83/83 | not reached | PASS (B1) |
| `qa-phase22.mjs` | Venues | 68/68 | not reached | PASS (B1) |
| `qa-phase21.mjs`, `qa-phase19.mjs`, `qa-phase17.mjs` | SaaS, reliability, booking integrity | 44/44, 21/21, 13/13 | not reached | PASS (B1) |
| `qa-phase18.mjs` | Site-wide accessibility and responsive sweep | stopped (memory) | stopped (memory) | **NOT RUN** |

"Not reached": the audit's battery was stopped for low memory after
`qa-phase23-browser`. These scripts passed on B1. Between B1 and B3,
Phase 24 changed only the portfolio, the console and tests, and nothing
these scripts exercise. They still have to be rerun on B3 before merge.

## Not run, and why

| Test | Blocker | Next action |
|---|---|---|
| Build and serve B3; rerun `qa-phase24`, `qa-phase24-browser` (the round-2 checks) and the "not reached" scripts | The QA server was stopped by Claude Code's low-memory reaper (about 2.7 GB free; Chrome holds about 19 GB) | The owner approves restarting the server, ideally with Chrome windows closed. Then: `bash qa24-server.sh` and `bash qa24-regress.sh`, both in the scratchpad |
| `qa-phase18` site-wide accessibility sweep | Stopped twice for low memory | Same |
| Production verification | Nothing may be created on production without the owner's go-ahead; this phase used fictional data on QA only | Owner decision (`PHASE_24_REPORT.md`, "Release") |
| A real gate provider | External: no partner (`docs/eterna/PARTNER_INTEGRATION_STATUS.md`) | Partner milestone |

## Diff inspection (`3c3cd4a..6ea7a05`)

| Check | Result |
|---|---|
| Accidental deletions | None. The resources routes swapped their guard; the console replaced its portfolio fetch |
| Temporary debugging | The debug script `qa-phase24-debug.mjs` was deleted before commit. The load script's setup diagnostics print only when a setup step fails |
| Hard-coded credentials | None. Test accounts use the QA fixture password already used by every QA script. `AUTH_SECRET` is read from the local file and never printed |
| Disabled or weakened tests | None. One QA placeholder check (`check(..., true)`) was replaced with a real check. Clock-dependent checks were made clock-independent without loosening what they assert |
| TODOs | None added |
| Migration assumptions | One additive enum value, idempotent, run twice in the tests. The previous code is unaffected |
| Untracked changes | Docs (this audit) are committed with the report |
