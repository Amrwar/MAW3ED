# Phase 22 — regression results (post-phase audit)

**Environment (every row unless stated):** Windows 11, Node 22.16, local
Docker Postgres `maw3ed-qa` (all migrations applied, QA fixtures),
production build `next start -p 3101` with `PAYMOB_FAKE=1` (payments
mocked — **not** live provider validation), Chromium via Playwright.
**Date:** 2026-10-31. **Code:** branch `phase-22-final` after the audit
fixes (final build). Every number below is copied from the run output.

## Static checks and build

| Test | Scope | Command | Actual result | Status |
|---|---|---|---|---|
| TypeScript | whole web app | `npx tsc --noEmit` | 0 errors | PASS |
| ESLint | whole repo | `npx eslint .` | 0 errors, 6 warnings — the same six as `main` (unused test var, `<img>` ×4, an RHF compiler note) | PASS |
| Production build | web | `npx next build` | Compiled successfully | PASS |
| Dependency audit (web) | prod deps | `npm audit --omit=dev` | 5 moderate (glob/minimatch via Sentry build tooling) | PARTIAL — O3 |
| Dependency audit (mobile) | prod deps | `cd mobile && npm audit --omit=dev` | 30 (2 low, 22 moderate, 6 high); fixes need a major Expo upgrade | PARTIAL — O2 |

## Unit, integration and database tests

| Test | Scope | Command | Actual result | Status |
|---|---|---|---|---|
| Web suite incl. DB tests | all web unit + route + Postgres tests | `BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run` | 114 files passed, 1 skipped; **1215 passed**, 34 skipped (1249) | PASS |
| Mobile suite | app logic incl. the new request-client tests | `cd mobile && npx vitest run` | 18 files passed, 1 skipped; **206 passed**, 10 skipped (216) | PASS |
| Live stream (new) | bounded reconnect, sharing, revival, isolation | `npx vitest run src/lib/realtime` | 11 passed | PASS |
| Mobile request client (new) | refresh single-flight, one retry, hung refresh, timeouts, finite query retries | `cd mobile && npx vitest run lib/api/client.test.ts` | 7 passed; the hung-refresh test **fails at its 5 s watchdog on the pre-fix client** | PASS |
| Organization DB suite | relationships, delegation, hierarchy incl. a pre-existing cycle | `… npx vitest run src/lib/organizations/phase22c.db.test.ts` | 13 passed | PASS |

## End-to-end, security and accessibility (server on :3101)

| Test | Scope | Command | Actual result | Status |
|---|---|---|---|---|
| Phase 22 final E2E | relationships, delegation (HTTP + browser), review regressions, **rescheduling** (added) | `AUTH_SECRET=<server's> node scripts/qa-phase22c.mjs` | **59/59** | PASS |
| Phase 22b E2E | organization platform | `node scripts/qa-phase22b.mjs` | 83/83 | PASS |
| Phase 22 venues | venues, tenancy, isolation, closures | `node scripts/qa-phase22.mjs` | 68/68 | PASS |
| Regression 17 / 19 / 20 / 21 | integrity, reliability (fake Paymob), security hardening, onboarding/SaaS | `node scripts/qa-phase{17,19,20,21}.mjs` | 13/13 · 21/21 · 19/19 · 44/44 | PASS |
| Booking journeys | ar/en, phone/desktop, keyboard, cancel, `?org=` attribution | `node scripts/qa-booking-e2e.mjs` | 22/22 | PASS |
| Venue console / page | browser, axe, overflow | `node scripts/qa-venue-{console,page}.mjs` | all clean | PASS |
| Security | auth, tenancy, admin, bearer | `node scripts/qa-security.mjs http://localhost:3101` | 32 passed, 0 failed | PASS |
| Redirect loops (new) | 6 identities × 18 URLs, hops followed by hand | `node scripts/qa-redirects.mjs` | **108/108**, longest chain 3 | PASS |
| Browser loops (new) | one stream per tab, bounded reconnect, self-heal once, idle quiet ×4, heap, event delivery | `node scripts/qa-loops-browser.mjs` | **9/9**; on the pre-fix hook checks 1 and 2 **fail** (2 streams; 80 attempts in 40 simulated minutes) | PASS |
| Accessibility + overflow | anonymous, owner, admin, delegate × ar/en × 375/768/1024/1440 | `node scripts/qa-phase18.mjs` | **544 page loads, 0 flagged**, 0 serious/critical | PASS |
| Delegate performance | owner vs delegate, median of 5 warm requests | `node scripts/qa-perf-delegate.mjs` | run 1: −11…+4 ms; run 2: −1…+17 ms across 6 routes (run-to-run noise of the same order) | PASS |
| Migration preservation | both 22c files re-run over legacy rows | `scratchpad/migration-preservation.sh` | counts identical across 10 tables; TENANT→HOSTED, FRANCHISE→MANAGED; no scopes granted | PASS |

## Failures seen during the audit, and what they were

| What failed | Cause | Outcome |
|---|---|---|
| `qa-phase22c` printed no result in one battery run | the audit's own edit to the script: a duplicate `svcId` declaration (syntax error), then a fixture that takes deposits (a public booking there is correctly not movable) | test fixed; product unchanged; 59/59 |
| `reliability.db.test.ts` (3 tests, 60 s timeouts) in two earlier full runs | intermittent under full-suite load; not reproduced in a 6-run A/B or any later run | O4 |

## Not run

| Test | Why |
|---|---|
| Production checks | nothing of PR #46 is deployed (O1) |
| Live payment provider | QA uses the fake Paymob; live validation is external |
| Mobile E2E (Maestro, Android emulator) | not run in this environment; last recorded run is in `docs/roadmap/TEST_MATRIX.md` |
| Visitor-pass and check-in journeys | Phase 23 |
