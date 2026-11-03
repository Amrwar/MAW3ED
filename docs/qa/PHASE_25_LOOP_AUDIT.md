# Phase 25 — loop audit

Date: 2026-11-03.

Scope: everything Phase 25 added or changed in the app (`mobile/`), and
the offline-QR work merged into this branch:

* session restore and the online re-check;
* pass polling;
* organizations and venues screens;
* links;
* the data export;
* the token store;
* the local web server.

Earlier app code (booking flow, payments, discovery) was not re-read line
by line. It was re-run through its unit tests and the app E2E.

**Conclusion.** No known or reproducible unbounded loop remains in this
code. Two bounded-but-weak loops were found in review and fixed (L1, L2).
This is not a proof that no loop exists; it is what the reading and the
tests below cover.

## A. React effects and renders

| Component | Possible cycle | Termination | Tests | Result |
|---|---|---|---|---|
| `AuthProvider` cold start | Restore → state → re-run | Effect has no dependencies; runs once | Unit (`restore.test.ts`); app E2E cold start | PASS |
| `AuthProvider` online re-check (`recheckSession`) | Effect on `unverified`; the check sets `unverified` false | Ends when the server answers. A refusal signs out. A failure that is not a refusal is retried after 5 s, 30 s and 120 s (`RECHECK_MS`), then only when the connection returns. A sign-in or sign-out in between makes the check stale, and it stops | Unit: bounded retries (1 + 3 calls), stale answers dropped, offline wait, clean stop. App E2E: back online, exactly one answer, then no request in a 6 s quiet window | PASS |
| `OrgScreen` visit count | Effect on `[q.data, src]` | A ref allows one count per opening | App E2E: QR visit counted once | PASS |
| `AccessSection` polling (`useBookingAccess`) | `refetchInterval` while a pass waits | `nextPoll`: only while something waits, at most `POLL_MAX` (10) attempts **including failures** since the customer's last action, then "check again". Offline, TanStack pauses fetches, so they do not count | Unit (`logic.test.ts`); app E2E: a pass never confirmed is asked at most 11 times, then never again | PASS |
| Places lists and directory filters | `useMemo` on data and filters | Pure | Unit (`places/logic.test.ts`) | PASS |

## B. Request loops

| Surface | Retry or poll | Bound | Evidence |
|---|---|---|---|
| `/api/auth/mobile/me` re-check | Retries on failure | 3 timed retries, then connection-driven only | Unit; app E2E |
| Booking access payload | Poll | 10 attempts, then a button | Unit; app E2E |
| Booking flow | Idempotent retries (existing) | Existing bound | `flow.test.ts` 23/23 |
| Data export | None; one request per press; server rate limit | — | App E2E |
| Service worker (offline QR) | Network-first with a 3.5 s timeout, serial cache operations, max 10 pages | Bounded | `qa-offline-qr` 31/31 |

## C. Navigation and links

| Surface | Possible cycle | Termination | Evidence |
|---|---|---|---|
| `routeFor` (deep links) | A link that routes to itself | Pure mapping to app routes. An invalid slug or token goes to `/places` or a not-found screen, never back to a link | Unit (hostile input) |
| Not-found screens | Redirect loop | `router.replace("/places")` only when the user presses it | App E2E: not found ends cleanly |
| `app-web-serve` fallback | `index.html` for every unknown path | A single read; no redirect | Path-traversal probe returns `index.html` |

## D. Storage

| Store | Possible issue | Mechanism | Evidence |
|---|---|---|---|
| Token store | Interleaved clear/set across sign-out and sign-in | One operation at a time, in call order (`serial`) | Review round 2; unit tests of the re-check |
| Export cache | Files accumulating | The previous export is removed before a new one, and all of them on sign-out | `export.test.ts` |

## Defects of this kind found and fixed

| # | Defect | Fix |
|---|---|---|
| L1 | Pass polling counted only successful answers: a server failing every time was asked forever (review 1, finding 2) | Counts failures too |
| L2 | The online re-check gave up after one failure that was not a refusal, until the connection changed again (review 1, finding 6). Without a bound it would have been a loop | Three timed retries, then connection-driven |
