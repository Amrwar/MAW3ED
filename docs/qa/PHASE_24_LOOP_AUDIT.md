# Phase 24 — loop audit

Date: 2026-11-03.

Scope: everything Phase 24 added or changed, and what it depends on:

* the organization portfolio (library, route, console);
* the `RESOURCES` scope (business-access rules, delegation, resources API
  and page, delegate navigation, acting paths, dashboard layout);
* the scope validator;
* organization metrics;
* the Phase 24 QA scripts.

Earlier subsystems that Phase 24 only calls were not re-audited line by
line: bookings, payments, notifications, cron, the access sandbox and
realtime. They were re-run through their existing loop suites; see
"Regression".

**Conclusion.** No known or reproducible unbounded loop remains in the
Phase 24 code. This is not a proof that no loop exists. It is what the
reading and the tests below cover.

## A. React / Next.js

| Component | Possible cycle | Termination mechanism | Tests | Result | Residual risk |
|---|---|---|---|---|---|
| `OrgConsole` main `load` (`useCallback` on `[base, assocPage]`, effect on `[load]`) | `load` sets state that is not among its dependencies | Dependencies are a string and a number; state written by `load` never feeds back | Browser: console opens, 40-load sweep with console errors counted (0) | No re-render loop seen | — |
| `OrgConsole` portfolio (effect on `[base]`, `loadPortfolio` after a successful action, "Try again") | Before the audit, read on every `load()`: every page change and action (review 1, finding 8). After review 1 it was never re-read (review 2, finding 1) | Read once when the console opens, once per successful action, once per "Try again" press. Never from `load()` or a page change | Browser on the final build: two actions give exactly 2 reads, and the page state is restored. A failing portfolio is read ≤ 2 times in 15 s, says so, and Try again adds exactly one | PASS (final build) | Requests have no client timeout. A hung request ends when the platform's function limit closes it (300 s). The page stays usable, because the section is optional |
| `PortfolioSection` | Render-only, no state | — | — | — | — |
| `ResourcesClient` (now reachable by delegates) | No effects, no polling; fetches only on button press | User-driven | HTTP: list, edit, add, cross-business 404 | No loop | — |
| Delegate navigation (`buildDelegateNav`) | Pure function | — | Unit test: `delegation.test.ts` "tables and rooms…" | PASS | — |
| Dashboard layout (`hasResources` for delegates) | Server component, one read | — | Browser: delegate menu shows the tables link | PASS | — |

## B. API request loops

| Surface | Retry or poll | Bound | Evidence |
|---|---|---|---|
| Console fetch helper `api()` | No retry | One request per call | Browser part 4: ≤ 2 requests in 15 s with the portfolio failing; with everything failing, ≤ 6 in 15 s, a "Could not load" notice and one Try again |
| Booking page access panel (Phase 23, re-checked in the Phase 24 journey) | Bounded retry with backoff | ≤ 6 requests in 30 s, then stops, with no spinner left | Browser part 4 |
| Booking page while offline | Same | ≤ 6 attempts in 20 s offline | Browser part 2 |
| Portfolio route | Single query set; no retry; no calls to other routes | — | Code reading |

## C. Routing and redirect loops

| Route | Possible loop | Termination |
|---|---|---|
| `/dashboard/resources` for a delegate without RESOURCES | → `/dashboard` | `/dashboard` is a delegate page (acting paths). Terminal |
| `/dashboard/resources` for staff or someone with no business | `requireDashboardAccess` → `noBusinessDestination` | `/org-admin`, `/account?notice=…` or `/onboarding`, none of which is a dashboard page. Terminal |
| Acting proxy (`actingRedirect`) with `/dashboard/resources` | Allow-listed | Unit test: `actingRedirect("/dashboard/resources", true) === null` |
| `/en/...` variants | Same rules, with the prefix kept | Existing Phase 22 tests |

## D. Database and hierarchy

| Item | Risk | Mechanism | Test |
|---|---|---|---|
| Portfolio over many relationships | Unbounded read | At most 500 **businesses** per report (`take: limit + 1`, a `truncated` flag shown in the console). Every relationship of a listed business is read | DB: the cap says so; a listed business keeps all its relationships (review 2, finding 3) |
| Portfolio counting | Nested scans | One grouped query for the window and one for upcoming; results indexed by business in a `Map` (review 1, finding 9) | DB, and load 5.7: 40 businesses and 20,000 bookings, p95 43 ms |
| Hierarchy (parents) | Cycles | Unchanged: the database trigger and depth limit from Phase 22 | `qa-phase22c` (part of the regression battery) |
| `RESOURCES` on invalid rows | Inconsistent grants | The Phase 22 CHECK constraints already cover it (branch rows are reservations only; hosted rows have no scopes) | DB: both inserts refused by the database |
| Migration | Re-run | `ADD VALUE IF NOT EXISTS` | DB: run twice, one value, placed after STAFF |

## E–F. Jobs, cron, webhooks and events

Phase 24 added no job, cron, webhook or event. It exercised the existing
ones under load and failure:

* The provider queue issued 60 passes in one run. A provider outage left
  requests pending, and they were issued after recovery (bounded attempts
  and dead-lettering as in Phase 23).
* Callbacks delivered three times each were recorded once (60/60
  entries), at 283–305 calls a second.
* The reminders job, run twice, sent one review request.

Re-run suites: `qa-phase23-loops` 15/15. `qa-loops-browser` passed in the
first battery (9/9); the audit's rerun was cut short (see "Regression").

## G. Mobile

Unchanged by Phase 24; the mobile app has no acting context (Phase 22,
O7). Mobile test suite: 206 passed, 10 skipped. Typecheck: 0 errors.

## H. Performance and memory

| Item | Finding |
|---|---|
| In-memory caches | None added. Delegation lookups stay request-scoped (`cache`) |
| Unbounded arrays | Portfolio rows at most 500 businesses; QA scripts accumulate only per run |
| Timers | The console's "copied" 2 s timer is pre-existing and one-shot |
| Load | `ORGANIZATION_TEST_RESULTS.md`, Part 5. See "Performance variance" in the post audit for the directory page |
| The QA machine | Low memory stopped background jobs three times during this audit. The cause is this PC (≈19 GB held by Chrome), not the app: the server's own process used ≈320 MB |

## Tests added by this audit

| Test | Proves | Watchdog |
|---|---|---|
| DB `audit: … RESOURCES refused by the database …` | Invalid grants cannot be stored | Vitest default timeout |
| DB `audit: the migration can run twice …` | Idempotent migration | Same |
| DB `audit: tables open … close on the next lookup …` | Immediate revocation | Same |
| DB `audit: a portfolio past its row limit says so …` | Bounded read, visible truncation | Same |
| DB `audit (review 2): the row limit counts businesses …` | Truncation never hides a sharing relationship | Same |
| DB `audit (review 2): … without startsAt counts as upcoming …` | Same rule as the business report | Same |
| HTTP: cross-business table edit or delete is 404; signed out refused; staff token 403 | Authorization on the newly delegable API | Script-level: every request is awaited and the script exits |
| Browser: reads per console action; failing-portfolio notice and Try again | Bounded requests | Playwright timeouts (30–90 s per step) |
