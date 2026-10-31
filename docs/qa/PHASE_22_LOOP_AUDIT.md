# Phase 22 — infinite-loop audit

Scope: the dependency graph Phase 22 (organizations, relationships,
delegated management) touched, plus the shared systems it runs through
(dashboard shell, live booking stream, auth and acting context, mobile
request client, jobs and webhooks the organization activity feeds).
Date: 2026-10-31. Environment: local QA (Docker Postgres `maw3ed-qa`,
production build `next start` on :3101, Chromium via Playwright).

**What this audit can and cannot claim.** It does not prove that no
infinite loop exists anywhere. It states which loop risks were reviewed,
what bounds each, which tests demonstrate the bound, and that **no known
or reproducible unbounded loop remains** in the reviewed scope. Two were
found and fixed (A1, A2), and the independent re-review found holes in
the first fixes, which were fixed too (see "Second review").

Every new test runs under a per-test watchdog timeout (Vitest `timeout`,
`timeout` wrappers on scripts), so a real loop fails the test instead of
hanging the suite — demonstrated: the hung-refresh test, run against the
pre-fix mobile client, failed at its 5 s watchdog.

## A. React / Next.js

| Reviewed | Potential cycle | Termination mechanism | Test | Result | Residual risk |
|---|---|---|---|---|---|
| `useRealtimeBookings` (header + bookings page) | **A1 — found:** a permanently failing stream (signed out, access withdrawn) was retried every 30 s for as long as the tab stayed open; an accepted-then-dropped stream would reset the counter and churn forever | `lib/realtime/booking-stream.ts`: backoff 2→30 s, stop after 8 consecutive failures; a session counts as good only after 10 s open; revival only on events (online, tab visible, new subscriber) — never a timer | `booking-stream.test.ts` (11, fake timers); `qa-loops-browser` #2 (Playwright clock) | PASS; old hook FAILED the same browser check (80 attempts in 40 simulated minutes) | Low: after stopping, live updates resume on the next online/visible/navigation event, not automatically — by design |
| Same | **A2 — found:** two subscriptions → two EventSources per bookings tab (double server polling) | One ref-counted connection per tab; close deferred one tick so StrictMode/page swaps keep it | `booking-stream.test.ts`; `qa-loops-browser` #1 | PASS; old hook FAILED (2 streams) | None known |
| Same | A throwing subscriber or a `null` payload could abort delivery to the others (introduced by the first A2 fix, caught by the re-review) | Per-listener try/catch; objects-only payloads | `booking-stream.test.ts` "delivery" | PASS | None known |
| `ActingBanner` self-heal (new) | Clearing a stale cookie could re-render into another attempt; a per-mount guard in a persistent layout would never retry | One attempt per page (pathname); refresh only after success; re-armed when the state leaves "ended" | `qa-loops-browser` #3 (DELETE forced to fail → exactly 1 request in 8 s) | PASS | None known |
| `OrgConsole` load effect | `load` in deps → refetch loop | `useCallback([base, assocPage])`; effect deps `[load]`; state updates do not change deps | `qa-loops-browser` #4 (org page idle: 0 requests) | PASS | — |
| `OrgMembershipClient`, `ScopePicker`, `ManageBusinessButton`, `DelegateHome` | effects/derived state | No effect writes its own deps; actions are user-driven | `qa-loops-browser` #4 | PASS | — |
| `DashboardHeader` 30 s tick, `useMinuteTick` | timers | Fixed interval, cleared on unmount | code review | PASS | Legitimate scheduled activity |
| Whole dashboard idle | render/refetch cascades | — | `qa-loops-browser` #4: `/dashboard`, `/dashboard/organizations`, `/dashboard/settings`, `/groups` — 0 requests in 15 s | PASS | — |

## B. API request loops

| Reviewed | Potential cycle | Termination | Test | Result |
|---|---|---|---|---|
| Mobile `apiFetch` refresh | parallel 401s → refresh storm; refresh of a refresh | Single-flight refresh; one retry (`_retried`) | `mobile/lib/api/client.test.ts` (7): 10 parallel 401s → 1 refresh, 20 requests | PASS |
| Mobile refresh | **A3 — found by re-review:** a hung refresh never settled, freezing every later request | 15 s abort timeout on the refresh (and its body) | "a refresh that hangs…" — FAILED (watchdog) on the old client, PASS on the fix | PASS |
| Mobile query retry | unbounded/unclassified retries | 401/4xx: 0; network: 3; other: 2; backoff capped 8 s | client.test.ts "query retry rule" | PASS |
| Mobile request timeout | spinner forever | 15 s AbortController | client.test.ts | PASS |
| Web: route handlers calling routes | recursion | None call each other over HTTP (grep) | code review | PASS |

## C. Routing and redirect loops

| Reviewed | Termination | Test | Result |
|---|---|---|---|
| Proxy acting allowlist, locale routing, dashboard guards (`requireBusinessPage`, `requireDashboardAccess`), `noBusinessDestination`, org/venue consoles, unknown/inactive org slugs, login | Each redirect lands on a page that renders for that identity; delegate home has no further guard | `scripts/qa-redirects.mjs`: 6 identities (anonymous, owner, active delegate, owner + stale cookie, no-business + stale cookie, org member) × 18 URLs, redirects followed by hand (max 10) | **108/108**, longest chain 3, no URL revisited |

## D. Database and hierarchy

| Reviewed | Potential cycle | Termination | Test | Result |
|---|---|---|---|---|
| Parent trigger | cycle creation | Walk with a step limit (10) + recursive CTE capped at depth 10, serialized by advisory lock | phase22c "23/25"; SQL probe | PASS |
| Same, on already-corrupted data | infinite walk over an existing A⇄B cycle | step limit raises `organization hierarchy too deep` | phase22c "loop audit: a cycle that got into the data anyway" (cycle inserted with triggers suspended for that session only) | PASS (terminates, refuses) |
| Public page hierarchy | recursive rendering | one level each way, `take: 50` | phase22c "23/25" (grandchild never appears) | PASS |
| Delegation resolution | recursion through hierarchy | none: one flat query, cached per request | code review; phase22c | PASS |
| Pagination (console) | repeated cursor | page clamped to [1, pages]; offset paging | phase22c "24" (120 rows, page 99 → 3, no duplicates) | PASS |
| Transactions | retry forever | no retry loops; conditional updates fail fast (`invalid-transition`) | phase22c concurrency tests | PASS |

## E. Background jobs and cron

| Job | Bound | Evidence (existing tests, run in this audit) | Result |
|---|---|---|---|
| Notification outbox (`/api/cron/notifications`, every 10 min) | `MAX_ATTEMPTS = 5` then `DEAD`; stale or undeliverable → `DEAD`; hung claims closed, not taken over forever | `outbox.db.test.ts`: "gives up after the last allowed attempt", "closes a claim that hung through every attempt…", "does not retry a refusal that cannot improve" | PASS |
| Reminders (hourly) | each send claims a unique ledger key first → overlapping runs dedupe | `outbox.db.test.ts` "…SENT by the re-drive, once"; `reminders/route.test.ts` | PASS |
| Subscriptions (daily), payment reaper | batches `take: 200/500`, advisory lock per booking | `reap.test.ts`, `reap-orphans.test.ts`, `subscriptions/route.test.ts` | PASS |
| Visitor-pass provisioning / revocation, provider sync | not built (Phase 23) | — | NOT APPLICABLE |

## F. Webhooks and events

| Reviewed | Bound | Evidence | Result |
|---|---|---|---|
| Paymob webhook | idempotent settlement; out-of-order failure ignored | `route.db.test.ts` "…a replay is a no-op", "ignores a failure that arrives after the success" | PASS |
| Organization events | audit writes only; no event triggers another | code review (`audit()` writes one row, no listeners) | PASS |
| Booking attribution | `createMany … skipDuplicates`; never fails the booking | 22b DB "O" | PASS |

## G. Mobile

Reviewed: request client, refresh, query retry/refetch (focus/reconnect
refetch only when stale), connectivity listener. Bounded and tested as in
B. Push/deep-link handlers were not changed in Phase 22 and were not
re-audited beyond the request client they use. Mobile unit suite: 205
passed (18 files) before the re-review fix; see the regression results
for the final run.

## H. Performance and memory

| Check | Evidence | Result |
|---|---|---|
| Heap after 35 client-side navigations | `qa-loops-browser` #5: 9.5 MB → 9.5 MB | PASS |
| Server poller per tab | A2 halves polling on the bookings page | Fixed |
| Delegate request overhead | `scripts/qa-perf-delegate.mjs`: within ±4 ms of the owner on 6 routes (median of 5) | PASS |
| In-memory caches | `cache()` is per request (React); rate limits in Postgres | No growing process memory |
| SSE server timers | cleared on abort and at the 30-min ceiling | Code review | PASS |

## Second review (bounded: one round)

An independent review of the first loop fixes found ten issues — four
real defects in them (A1's counter reset by accepted-then-dropped
connections; permanent give-up in a persistent layout; delivery not
isolated; hung mobile refresh) and test-hygiene problems (fake timers not
restored on failure, cleanup only on success, a globally disabled
trigger, a browser check that counted connections but not delivered
events). All were fixed; the delivery check was added
(`qa-loops-browser` #6). No third round was run, per the instruction to
keep the process finite.
