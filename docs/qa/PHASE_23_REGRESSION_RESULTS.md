# Phase 23 — regression results (post-phase audit)

**Date:** 2026-10-31 → 2026-11-01. **Code:** branch `phase-23` after the
audit (`1055dbb` plus the docs commit; fixes in `9278bfe` and `1055dbb`).
**Environment:** local QA only.
* Docker Postgres `maw3ed-qa` (:5450), every migration applied, including
  the audit's re-run of `phase23_access.sql`.
* Production build (`next build`, then `next start` on :3101) with
  `ACCESS_SANDBOX=1`, `PAYMOB_FAKE=1`, `CRON_SECRET=p19-local-cron`, and
  outbound messaging keys blanked.
* Chromium via Playwright, Node 22.16.

Nothing ran against production. Every number below is from a run in this
audit; logs are in the session scratchpad (`battery/`, `battery2/`,
`final-*.log`).

How to reproduce the token-based scripts: `next start` also loads
`.env.production.local`, so scripts that mint session tokens need **that
file's** `AUTH_SECRET` in their environment. Loaded without printing it:

```
AUTH_SECRET="$(grep '^AUTH_SECRET=' .env.production.local | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//')" \
CRON_SECRET=p19-local-cron DATABASE_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa \
node scripts/<script>.mjs http://localhost:3101
```

## Static checks and build

| Test | Scope | Command | Result | Status |
|---|---|---|---|---|
| Type check | whole web app | `npx tsc --noEmit` | exit 0 | PASS |
| Lint | whole web app | `npx eslint` | 0 errors, 6 warnings (all in files this phase does not touch; same 6 as before the audit) | PASS |
| Production build | web | `DATABASE_URL=<qa> npx next build` | exit 0; ran 4 times (baseline, fixed, pre-fix client for comparison, final) | PASS |
| Dependency audit (web) | prod deps | `npm audit --omit=dev` | 5 moderate (glob/minimatch via Sentry's build plugin), unchanged since Phase 22 | PARTIAL (Phase 22 O3) |
| Dependency audit (mobile) | prod deps | `cd mobile && npm audit --omit=dev` | 30 (2 low, 22 moderate, 6 high), unchanged; Phase 23 does not touch `mobile/` | PARTIAL (Phase 22 O2) |

## Unit, integration and database tests

| Test | Scope | Command | Result | Status |
|---|---|---|---|---|
| Full suite, before the audit's changes | all unit + DB suites | `BOOKING_DB_TEST_URL=<qa> npx vitest run` | 1266 passed, 34 skipped | PASS (baseline) |
| Full suite, final code (run 1) | same | same | 1279 passed, **3 failed**, 34 skipped. All three in `bookings/reliability.db.test.ts` (contention timeouts) | flake O4, see below |
| `reliability.db.test.ts` alone, final code | booking contention | `npx vitest run src/lib/bookings/reliability.db.test.ts` ×2 | 13/13, 13/13 | PASS |
| Full suite, final code (run 2) | all | same as run 1 | **1282 passed, 34 skipped, 0 failed** | PASS |
| Phase 23 access (unit + DB) | `src/lib/access` | `npx vitest run src/lib/access` | 61/61: 24 unit + 37 DB, including the audit's 10 new DB tests | PASS |
| Login return paths | `src/lib/auth/login-destination.test.ts` | `npx vitest run src/lib/auth` | 6/6 (new) | PASS |
| New DB tests against the **pre-audit** code | A1, A2, A4, A5, A7, A9, A11, A12 | access sources reset to `54bacc9`, new tests kept | **8 failed**, 28 passed | Proves the tests detect the defects |

## End-to-end, security, accessibility (server on :3101)

First battery: after the first fix commit `9278bfe`. Second battery:
after the review fixes, final build `1055dbb`.

| Script | Scope | First battery | Final build | Status |
|---|---|---|---|---|
| `qa-phase23` | Phase 23 over HTTP: QR, check-in, passes, callbacks, sandbox, roles, tests 1–26 | 48/48 | 48/48 | PASS |
| `qa-phase23-browser` | Customer page, check-in desk, security desk in Chromium | 4/5 (the "pending" check raced a fast sandbox confirmation; the test now holds the sandbox unconfirmed) | 18/18 | PASS |
| `qa-phase23-loops` (new) | Polling bound, camera lifecycle, check-in target, idle pages, sign-in return, desk errors, heap | 15/15 | 15/15 | PASS |
| `qa-phase23-loops` on the **pre-audit client** | same | — | **8/15**: C1, C2, C3, C5, S1, L1, L2 FAIL | Proves the checks detect the defects |
| `qa-security` | authn/z attacks, forged tokens, cross-tenant | Not run (`AUTH_SECRET` missing) | 32/32 | PASS |
| `qa-booking-e2e` | booking end to end in a browser (incl. `?org=`) | 22/22 | 22/22 | PASS |
| `qa-phase17` | Phase 17 flows | 13/13 | — | PASS |
| `qa-phase18` | 544 page loads, ar + en, 4 widths, axe | **544 loads, 0 flagged, 0 axe serious/critical** (no renderer crashes this run) | — | PASS |
| `qa-phase19` | Phase 19 | 21/21 | — | PASS |
| `qa-phase20` | Phase 20 | 19/19 | — | PASS |
| `qa-phase21` | Phase 21 | 44/44 | — | PASS |
| `qa-phase22` | venues, venue console, roles | 66/66 (2 token checks not run without `AUTH_SECRET`) | 68/68 | PASS |
| `qa-phase22b` | organizations, directory, QR | 83/83 | 83/83 | PASS |
| `qa-phase22c` | OWNED/HOSTED/MANAGED, delegates | 58/58 (R5 not run without `AUTH_SECRET`) | 59/59 | PASS (see note) |
| `qa-redirects` | redirect and locale rules | 108/108 | 108/108 | PASS |
| `qa-loops-browser` | Phase 22 loop checks (stream, banner, idle pages, heap) | 9/9 | 9/9 | PASS |
| `qa-venue-console` | venue console sweep | all clean | — | PASS |
| `qa-venue-page` | public venue pages | all clean | — | PASS |

## Failures seen during the audit, and what they were

| Seen | Cause | Action |
|---|---|---|
| `qa-security` exit 1 in the first battery | No `AUTH_SECRET` in the script's environment | Re-run with the server's secret: 32/32 |
| `qa-security` 30/32, `qa-phase22` 29/35, `qa-phase22c` 24/52 in reruns | The audit passed the wrong secret: `.env`'s, while `next start` reads `.env.production.local` (once also with a stray carriage return) | Used the server's secret: 32/32, 68/68, 59/59 |
| `qa-phase22c` "the dashboard says whose business" failing on every rerun | The wrong-secret run above could not act for the salon, so its "PROFILE delegate saves the salon's profile" step saved the **delegate's own** business under the salon's name: QA data contamination, not a product defect (an account not acting for anyone edits its own business) | Rival fixture name restored (`صالون المنافس`); 59/59. The script now stops if acting fails before any write |
| `qa-phase23-browser` 4/5 | Test race: in NORMAL mode the sandbox confirms within milliseconds, so "pending" was not always on screen | Test holds the sandbox in NO_CONFIRM, then confirms; 18/18 |
| `qa-phase23-loops` booking overlap | The new script's bookings overlapped (`booking_no_overlap`) | Five-minute bookings at separate times |
| Two new DB tests failed on first run (A7, A11) | Test bugs: `mockRestore` clears call records; a window update that broke `AccessEntitlement_window_chk` | Fixed in the tests; 61/61 |
| 3 contention tests in the full suite | Known O4: `reliability.db.test.ts` under a fully parallel run | 13/13 alone twice; next full run 0 failures |

## Not run

| Test | Why |
|---|---|
| Production verification of Phase 23 | Not deployed; its migrations are not applied there. Production access is the owner's |
| Real gate provider | None exists (status E, BLOCKED). Everything provider-side ran against the sandbox, which is not live provider validation |
| Mobile E2E / device camera on iOS | No Phase 23 mobile code. The web camera was exercised with a fake stream and a fake `BarcodeDetector`; a real device was not used |
| Load test beyond the concurrency tests | DB concurrency tests (8 concurrent issuers, 3 concurrent check-ins, 3 concurrent callbacks, two job workers) ran; no sustained-load run |
| `qa-phase17` to `qa-phase21`, `qa-phase18`, venue sweeps on the final build | Run on the first fixed build. The review fixes after it touch only access code, the login return path and the two desks, which the final battery covers |
