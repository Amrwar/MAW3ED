# Phase 23 — infinite-loop audit

Scope: everything Phase 23 added or changed (booking check-in QR, the
check-in desk and its camera, visitor passes, the provider-neutral access
layer, its job runner, cron, callbacks and the venue security desk), and
the shared systems it runs through (booking state machine, reschedule
routes, the login flow it returns through, the admin business actions it
now hooks into). Date: 2026-10-31. Environment: local QA only — Docker
Postgres `maw3ed-qa` with every migration applied, production build
(`next start`) on :3101 with `ACCESS_SANDBOX=1`, Chromium via Playwright,
Node 22. **Nothing was run against production.**

**What this audit can and cannot claim.** It does not prove that no
infinite loop exists anywhere. It states which loop risks were reviewed,
what bounds each one, which test demonstrates the bound, and that **no
known or reproducible unbounded loop remains** in the reviewed scope.
Three loop-class defects were found and fixed: a scan loop that could
run twice (U4), a job that could be reclaimed forever (A7), and a
cron round-robin that a failing booking could stall (A6). The camera
streams that stayed on (U1, U2) are leaks rather than loops, and
are listed under H.

Watchdogs: every new DB test has its own Vitest timeout (30–120 s), and
every browser check waits with an explicit timeout. A real loop fails
the test; it cannot hang the suite.

Limits chosen per subsystem, each with its reason:

| Subsystem | Limit | Why this number |
|---|---|---|
| Customer pass re-check | 10 polls × 4 s, then a button | A sandbox or real provider confirms in seconds; 40 s covers a slow one without polling a page left open all day |
| Camera scan | 1 frame / 300 ms, one loop per session | A QR reads in well under a second; faster gains nothing on a phone |
| Provider call | 8 s timeout | Gate APIs answer in < 1 s; 8 s tolerates a slow network and stays far inside the 60 s lease |
| Provider job | 6 attempts, backoff 30 s × 2ⁿ (cap 1 h), then DEAD with a visible outcome | About 30 minutes of trying covers a provider restart; longer belongs to a person (escalation) |
| Withdrawal not confirmed | hourly, 24 rounds, then closed with an escalation | A day of asking; a pass still valid after that needs a human at the gate system |
| Pending never confirmed | asked every 10 min, failed after 24 h | Same reasoning |
| Re-issue per pass | 5 unhealthy ends | Stops a misbehaving provider from re-issuing endlessly; booking/venue changes do not count |
| Cron batch | 50 bookings, 20 stale, 20 stuck, 10 providers; 30 s budget in a 60 s function | The slowest single item (status + replay) is 16 s; 30 + 16 + health checks stays inside 60 s |
| Bulk re-decision (venue or business change) | 200 bookings, after the response | The cron reaches the rest at 50 a run |

## A. React / Next.js

| Reviewed | Potential cycle | Termination mechanism | Test | Result | Residual risk |
|---|---|---|---|---|---|
| `AccessPanel` initial load | `load` in deps → refetch loop | `fetchPayload`/`apply` stable (`[base]`, `[]`); `live` flag on unmount | `qa-phase23-loops` I (`/booking/<token>` idle 10 simulated min: 0 requests) | PASS | — |
| `AccessPanel` pending poll | A pass the provider never confirms polled forever; a re-render resetting the count | `POLL_MAX` = 10; `polls` reset only by a user action; timer cleared on unmount and deps change; stops once nothing is pending | `qa-phase23-loops` P1 (sandbox `NO_CONFIRM`: 11 GETs, then 0 more over a simulated hour), P2 ("check again" → one more bounded round of 11); `qa-phase23-browser` (stops once active) | PASS (also on the pre-audit build: this bound was already right) | — |
| `CheckInDesk` camera scan loop | **U4 — found:** closing and reopening within 300 ms left the old loop running beside the new one (its only exit test was "is there a stream"); each extra loop sent its own verify | A session counter: every start and stop bumps it; a loop runs only while its session is current | `qa-phase23-loops` C3: pre-audit build **18 reads in 3 s (two loops) — FAIL**; fixed build 9 reads — PASS | PASS | — |
| `CheckInDesk` verify effect / requests | Out-of-order answers; a stale answer replacing a newer one | Request counter: only the newest answer is shown; `live` flag on unmount | `qa-phase23-loops` C4 (one verify per read) | PASS | — |
| `AccessDesk` (security desk) | Date change → refetch loop; failed refresh hidden | Effect deps `[fetchDesk, apply]`; `fetchDesk` depends on `[base, day]` only; failures now shown | `qa-phase23-loops` I (idle 0 requests), S1 | PASS | — |
| `/c/<code>`, `/pass/<token>` | — | Server-rendered; the desk on `/c` makes one verify | `qa-phase23-loops` I (`/c/<code>` idle: 0) | PASS | — |
| `VenueConsole` policy additions | — | Form state only | code review | PASS | — |

## B. API request loops

| Reviewed | Potential cycle | Termination | Test | Result |
|---|---|---|---|---|
| Customer actions (`act`) | Retry loops; busy never cleared | One request per click; `finally` clears busy; poll count reset only here | code review; `qa-phase23-browser` | PASS |
| Desk `post`/`call` | Unbounded retries | None: one request per action; errors shown | code review; `qa-phase23-loops` S1 | PASS |
| Provider calls | Hang forever; retry storm | `withTimeout` 8 s with abort; job backoff; 6 attempts | DB "18" (abandoned at the timeout, retried later), "17/24/25" | PASS |
| Provider callback route | Unknown credential → provider retries forever | 503 + `Retry-After: 30`; the provider bounds its retries; logged so a never-known reference is visible | DB "R2b" | PASS (bounded by the provider) |
| Route handlers calling routes | — | None call each other | code review | — |

## C. Routing and redirect loops

| Reviewed | Potential cycle | Termination | Test | Result |
|---|---|---|---|---|
| `/venue-admin/<id>` ↔ `/access` for VENUE_SECURITY | console → desk → console | Only the console redirects (security → desk); the desk never redirects back | `qa-phase23` (security), code review | PASS |
| `/login?next=…` (changed by this audit) | A return path that sends a signed-in person back to `/login` | Only `/dashboard…` (with a business), `/venue-admin…`, `/org-admin…`, `/c/<code>`; none redirects a signed-in user to `/login`; other sites, protocol-relative, backslash and `javascript:` paths refused | `login-destination.test.ts` (6); `qa-phase23-loops` L1, L2 | PASS |
| `/c/<code>` signed out | — | Shows a sign-in link, no redirect | `qa-phase23-loops` L1 | PASS |
| Locale | `/en/...` rewrite | Unchanged by Phase 23 | `qa-redirects` (see regression results) | PASS |

## D. Database and hierarchy

| Reviewed | Potential cycle | Termination | Test | Result |
|---|---|---|---|---|
| Venue choice for a booking | Two covering venues chosen alternately run to run, suspending and re-issuing passes | `orderBy createdAt, id` (stable) | code review (was unordered) | FIXED |
| Booking ↔ guests ↔ entitlements ↔ credentials | Recursive loads | Flat, sequential queries; no recursion; no self-relations | code review | PASS |
| Advisory lock | Deadlock or endless wait | One lock per booking, `lock_timeout` 3 s inside the transaction | DB "23" (8 concurrent → one credential) | PASS |
| Pagination | — | Bounded `take` everywhere; no cursor loops | code review | PASS |

## E. Background jobs and cron

| Reviewed | Potential cycle | Termination | Test | Result | Residual risk |
|---|---|---|---|---|---|
| `runAccessJobs` | A job re-run forever | 6 attempts → DEAD; claims are conditional (no double execution); bounded by `limit` and budget | DB "17/24/25", "24", "23" | PASS | — |
| Same | **A7 — found:** a job whose processing threw outside the provider path (a bad row, a database error) aborted the whole run and stayed first in line, every run; a job killed mid-call on its last attempt was reclaimed forever (the claim never checked the cap) | Per-job try/catch (backoff, then DEAD); a claim past the cap is given up without another provider call | DB "A7" (FAILS on the pre-audit code) | PASS | — |
| Same | **A9 — found:** a job waiting (for a reference, or for an in-flight provision) that ran out of attempts died silently; the pass showed "updating" forever | Ends through `giveUp` (withdrawal / escalation) | DB "A9" (FAILS on the pre-audit code) | PASS | — |
| `reconcileAccess` step 1 | **A6 — found:** a booking whose re-decision kept failing was never touched, so it stayed at the front of the round-robin; 50 of them would stall it for good | Touched whether it succeeds or fails; ended windows ordered too | code review (no deterministic failing booking to fixture) | FIXED | Low |
| Same | Steady state re-queues work every run | — | DB "loops: the cron converges" (3 more runs: no new job, no new event) | PASS | — |
| Step 3 (withdrawals) | Rounds forever | 24 rounds, then closed with an escalation | DB "R4", "R4b" | PASS | — |
| `kickAccessJobs` | **A8 — found:** the cron's re-decisions each registered an `after()` job runner (up to 50, all starting at the end of a run and killed at 60 s) | `kick: false` inside reconcile and bulk re-decisions; one run at the end | code review | FIXED | — |
| Cron duration | A run overrunning `maxDuration` and being killed mid-call | 30 s budget, checked before each item; the slowest item is 16 s | code review | FIXED | Low |
| Overlapping cron runs | Two runs on one job | Conditional claim with a 60 s lease; idempotency keys | DB "23" (two workers, one call) | PASS | — |

## F. Webhooks and events

| Reviewed | Potential cycle | Termination | Test | Result |
|---|---|---|---|---|
| Provider callbacks | Duplicates applied twice | Unique `(providerId, providerEventId)` | DB "14/16" (3 concurrent → 1) | PASS |
| Event → sync → event | A callback triggering a sync that calls the provider that calls back | Events never call `syncBookingAccess`; jobs never enqueue from `applyIssue` | code review | PASS (no cycle exists) |
| Out of order | An old confirmation replacing a newer one; a confirmation reviving a withdrawal | Version check; **A1 — found:** the check was a plain read, so a withdrawal committing in between was overwritten | Conditional `updateMany` re-checked under the row lock | DB "A1" (FAILS on the pre-audit code), "19" | PASS |
| Booking move → access → booking move | — | The access step never moves a booking | code review | PASS |

## G. Mobile

Phase 23 does not touch `mobile/` (`git diff 312facd..HEAD -- mobile` is
empty). The app has no QR, camera or pass code yet (P23-O2). Its existing
polling (booking queries, business 60 s, notifications 120 s) and the
refresh single-flight were audited in Phase 22 and are unchanged.

## H. Performance and memory

| Reviewed | Risk | Result |
|---|---|---|
| Camera streams | **U1, U2 — found:** a double click opened two streams and closing stopped one (the camera light stayed on); leaving the page while the browser was still opening the camera left a live stream nobody could stop | Fixed (sessions; a late stream is stopped). `qa-phase23-loops` C1: pre-audit **2 live after close — FAIL**, fixed 0; C2: pre-audit **1 live — FAIL**, fixed 0 |
| Booking page heap | Growth across visits | `qa-phase23-loops` H: 15 reloads, 9.5 MB → 9.5 MB — PASS |
| Repeated DB queries | Every sync counted gate entries with no index; cron queries had none | **A10 — found and fixed:** indexes on `AccessEvent(entitlementId, kind)`, `AccessSyncJob(credentialId)`, `AccessEntitlement(status, validUntil)` and `(status, updatedAt)` |
| Table growth | `AccessSyncJob` (DONE/DEAD) and `AccessEvent` are never purged | Open (P23-A3): bounded per booking, grows with use; not a loop |
| Timers | Poll and scan timers | Cleared on unmount / session change |

## Second review (bounded: one round)

An independent code review of the fix commit (`54bacc9..9278bfe`) ran
once. Its result and what was done about it are in
`PHASE_23_POST_AUDIT.md` §9. No further audit rounds were run.
