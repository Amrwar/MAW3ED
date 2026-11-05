# Phase 28 report: enterprise multi-organization and multi-venue platform

Date: 2026-11-05. Branch `phase-28`, from `main` at `c371e47`.

## Reports from earlier phases, re-read

Phases 17–27 were re-read against the code before building (organizations 22/22b/22c,
access 23, the organization pilot 24, discovery 26, operations 27). What they claimed
still holds; one test fixture was wrong (below). The enterprise foundation already in place:
independent organizations (self-registration, platform review), OWNED/HOSTED/MANAGED
associations with business-granted scopes and branch limits, one business in several
organizations, delegated management, venue and venue roles, a 3-level hierarchy with a cycle
trigger, per-venue access-provider choice with a sandbox, and the portfolio report.

Phase 28 adds what an enterprise needs on top, without rebuilding anything.

## What was built

| Part | Built | Code |
|---|---|---|
| 1 Multi-organization | Unchanged model, re-verified with two fresh organizations; a business holding HOSTED (A) and MANAGED (B) at once | `docs/enterprise/ARCHITECTURE.md` |
| 2 Registration | Brand colour (`#RRGGBB`, DB CHECK) on the profile and the public directory; onboarding documented end to end | `ONBOARDING.md` |
| 3 Management console | Organization console → **Integrations**: contract, API usage, keys, webhooks with delivery history, visitor-access status per venue (provider health, credential, failed jobs), plans of owned brands that share FINANCE | `org-admin/[id]/integrations` |
| 4 Access providers | Per-venue credential (`VenueAccessCredential`, sealed under its own key purpose); carried on every provider call for that venue; revoking/rotating one venue never touches another; revocations of passes are never blocked by it | `lib/access/venue-credentials.ts`, `sync.ts` |
| 5 Enterprise API | `/api/v1` (organization, businesses, venues, bookings, reports): hashed scoped keys, rotation with grace, revocation, contract-bound, per-key rate limit and daily usage, cursor pagination, no customer data; signed webhooks from a bounded change feed with leased, bounded retries, auto-disable, SSRF guard, secret rotation; every change in the organization's audit trail | `lib/enterprise/*`, `INTEGRATION_GUIDE.md` |
| 6 Billing | Organization contracts (limits only — **no prices invented**; the signed agreement is referenced); usage accounting; payment reconciliation (refund sums, status, over-refund, missing receipts, held-but-paid deposits). Business subscriptions unchanged | `lib/payments/reconcile.ts` |
| 7 Performance | Profiled at 600 businesses / 30,000 bookings; one bottleneck found and fixed (below) | `scripts/qa-phase28-perf.mjs` |
| 8 Reliability | Every cron run recorded (`CronRun`); `/api/health` (anonymous: one query; with the cron secret: job freshness and queue depths); feature flags (`FEATURE_FLAGS_OFF`); admin **Operations** page; backup/restore drilled; rollback procedure; runbook | `lib/ops/*`, `OPERATIONS_RUNBOOK.md` |
| 9 Loops | Audit below | |
| 10 Second organization | Two fictional organizations provisioned through the product, 46/46 boundary checks | `scripts/qa-phase28.mjs` |

## Defects found and fixed

During the build:

1. The webhook feed labelled a booking changed within two seconds of creation as "created"
   (heuristic on timestamps). Replaced (see 6 below).
2. The scale profile found the public directory embedding **every** member in its JSON-LD on
   every page (237 KB at 600 members, growing without bound). Now the page's members only:
   88 KB.
3. The reminders job read every booking in a 72-hour window and the subscriptions job every
   overdue business, unbounded per run. Bounded, nearest first, and progressing (see 10).
4. A pre-existing test fixture (`phase24.db.test.ts`) took "today" from the UTC date while
   the report uses Cairo's day: it failed every evening between 22:00 and 24:00 UTC. Fixed.

From the post-phase code review (`/code-review high c371e47..HEAD`, 10 findings, all fixed):

5. **Visibility merged association rows**: a HOSTED whole-business row and a MANAGED
   one-branch row with RESERVATIONS combined into bookings of every branch. Each row's grant
   now stays its own; bookings only through a row that is itself OWNED/MANAGED with
   RESERVATIONS, limited to that row's branches.
6. **Webhook feed and commit order**: updatedAt is stamped before commit, so a slow
   transaction could land behind the cursor and be missed. Changes now settle two minutes
   before the feed reads them; "created" means the first time the endpoint hears of the booking.
7. **A delivery interrupted on its last attempt** stayed in the queue for ever (and 50 of them
   would stall it). Spent deliveries are excluded and closed as DEAD.
8. **Queued deliveries outlived a contract** (or a suspension, or a withdrawn RESERVATIONS
   grant). Re-checked at send time; such deliveries are closed, not sent.
9. **Venue credentials**: a credential kept for the venue's previous provider blocked every
   call, and a revoked credential blocked revoking visitors' passes. Another provider's
   credential now falls back to platform configuration; revocations always proceed.
10. **API key rotation** could extend a key already in its grace and multiply live keys
    beyond the contract. A rotated key cannot be rotated again; rotation respects the limit.
11. **Health was blind to a missing `CRON_SECRET`** (every job 503, run rows deleted, status
    "ok"). Refusals are no longer recorded as runs, but a missing secret is recorded as a
    failed run, which health reports; anonymous calls cost no writes.
12. `/api/v1/bookings` paged on a nullable column; now `(date, startTime, id)`.
13. Anonymous `/api/health` ran ~21 queries; now one.
14. The new reminder bounds re-read handled rows; reminded and already-requested bookings are
    now skipped so each run progresses.

## Performance (local, QA database; 600 businesses, 30,000 bookings)

| Measure | Before fixes | After |
|---|---|---|
| Directory page, 600 members | 197 ms, 237 KB | 145 ms, 88 KB |
| `/v1/businesses`, walk all 601 (7 pages) | 163 ms | 117 ms |
| `/v1/bookings`, first page of 100 | 25 ms | 16 ms |
| `/v1/bookings`, walk 9,300 rows (93 pages) | 2.9 s | 1.6 s |
| `/v1/reports/portfolio?days=90` | 38 ms | 25 ms |
| Webhook feed query, 200 of 30k | 0.18 ms (index `Booking_businessId_updatedAt_id_idx`) | 0.10 ms |
| `/api/health` anonymous | 36 ms | 5 ms |

Connection pool: unchanged (`pg` default 10 locally, Neon pooled in production); no job holds
a connection across network calls. Caching: none added — the directory and API are fast
uncached at this size and the data changes often. Watch item: the directory loads all of an
organization's associations to filter and page in memory — fine at hundreds, revisit at many
thousands.

## J — Loop and recursion audit

| Area | Bound |
|---|---|
| Organization hierarchy | DB trigger refuses cycles and > 3 levels; tested (`phase22c.db.test.ts`), and `qa-phase28` tries a two-organization cycle through the API |
| Permission resolution | Flat, per request: one association query per organization; no recursion |
| Association traversal / reporting | Single queries with `take`; portfolio capped (`PORTFOLIO_LIMIT`) |
| API pagination | `limit` ≤ 100; stable cursors; a forged cursor is ignored, never trusted |
| Webhook feed | 200 bookings per endpoint, 500 endpoints, 20 s per run; cursor always advances |
| Webhook delivery | lease + attempt counted at claim; 8 attempts then DEAD; spent rows closed; 50 per run, 25 s |
| Endpoint failure | auto-disable after 20 in a row; nothing sent to a disabled endpoint |
| Provider reconnection | access jobs: 6 attempts, backoff ≤ 1 h, DEAD; a revoked venue credential stops only that venue |
| Malformed provider responses | `parseEvent` returns null on any bad input (existing tests); `qa-phase28` and DB tests cover refusal paths |
| Scheduled jobs | every job bounded per run; reminders/subscriptions newly bounded; runs recorded |
| Cache invalidation | no new caches |
| React effects | console sections load once per action, no polling (agent-built; reviewed) |

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit`, `eslint` | clean |
| Unit tests | 117 files, 1,243 tests passed |
| Database tests (enterprise, access incl. P28 isolation, organizations, venues, Phase 27, bookings, notifications, webhooks) | 473 passed (40 files). One run showed a cross-file timing failure in `outbox.db.test.ts` on the shared QA database; it passes alone and on rerun — recorded as a test-isolation flake |
| `qa-phase28.mjs` (two organizations, over HTTP, production build) | **46/46** |
| `qa-phase27.mjs` | 66/66 |
| Regression battery (20 earlier QA scripts, production build) | all passed: qa-phase24 147/147, phase24-browser 23/23, redirects 108/108, offline-qr 31/31, responsive 380 loads clean, booking-e2e 22/22, phase23 48/48, phase23-loops 15/15, security 32/32, phase23-browser 49/49, loops-browser 9/9, venue console/page clean, phase22c 59/59, phase22b 84/84, phase22 68/68, phase21 44/44, phase19 21/21, phase17 13/13, phase18 544 loads 0 flagged |
| Backup → restore drill (QA) | 92 tables' row counts, 229 constraints, triggers, 333 indexes identical; search function works; 3 s |
| Rollback rehearsal (staging) | Staging migrated (`migrate-staging28.sh`: VERIFIED), Phase 28 deployed (`/api/health` 200, `/api/v1/organization` 401). `vercel rollback` to the previous build (`c371e47`) took 5 s: the new endpoints answered 404 (uncached; the edge kept the old answer for a few seconds) and the old build ran on the migrated database (the schema change is additive), home and sign-in 200. `vercel promote` back took 5 s; endpoints present again |

## Readiness (separately, as asked)

1. **Enterprise code readiness — READY (local).**
2. **Second test organization readiness — READY (fictional, QA).**
3. **Production deployment readiness — READY.** The migration (`phase28_enterprise.sql`) was
   applied and verified on production and staging on 2026-11-05; rollback rehearsed on staging.
   Still to do after the deploy: point an uptime monitor at `/api/health`.
4. **Real partner validation — NOT DONE.** No real organization, contract, API consumer or
   access-provider partner has been exercised. Not claimed.

Details: `docs/enterprise/RELEASE_READINESS.md`.
