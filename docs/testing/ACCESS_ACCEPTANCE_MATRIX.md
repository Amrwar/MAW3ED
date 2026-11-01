# Phase 23 acceptance matrix

Every test in the Phase 23 brief (1–26), where it is tested, and the result on 2026-10-31. Results come from runs on this branch:

* **Unit:** `src/lib/access/access.test.ts`, no database.
* **DB:** `src/lib/access/phase23.db.test.ts`, Postgres with the phase23 migrations:
  `BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/access`
* **QA:** `scripts/qa-phase23.mjs` over HTTP, against a production build on the QA database with `ACCESS_SANDBOX=1`.
* **Regression:** the full unit and DB suites, plus every earlier QA script against the same build.

| # | Test | Where | Result |
|---|---|---|---|
| 1 | Public directory QR | QA "1/A" (`/api/business/qr` serves the SVG for the public page; unchanged since 22b) | PASS |
| 2 | Business booking QR | Unit "2: check-in codes…", "2/13 window"; DB "2/3/25"; QA "2" ×5 (ready, URL holds only the opaque code, checked-in state, `/c/` shows nothing to strangers) | PASS |
| 3 | Authorized business check-in | DB "2/3/25"; QA "3" ×4 (scan shows the booking, check-in → ARRIVED, the business's own staff get the desk from `/c/`) | PASS |
| 4 | Unauthorized check-in | DB "4/12/14" (another business, a provider's scope); QA "4/20", "4/12", "4" (signed out 401; rival business learns nothing and cannot check in) | PASS |
| 5 | Confirmed booking eligibility | Unit "5"; DB "5/10/11"; QA "5" (eligible, but no pass until asked) | PASS |
| 6 | Pending booking restrictions | Unit "6"; DB "6/13" (no code), "6" (no pass; phone-required guest refused) | PASS |
| 7 | Cancellation and immediate local revocation | Unit "7"; DB "7/8/25" (code REVOKED and unscannable, pass no longer shown, credential REVOKE_PENDING in the cancel's own transaction); QA "7" | PASS |
| 8 | External provider revocation acknowledgement | DB "7/8/25" (REVOKED and `AccessRevocation.confirmedAt` only after the provider's answer; the sandbox gate refuses); QA "8" ×2 | PASS (sandbox) |
| 9 | Rescheduling | DB "9" (version bump, UPDATE confirmed, sandbox window moved; a move back to pending holds the pass, and re-confirmation re-issues) | PASS |
| 10 | Guest invitation and separate credentials | DB "5/10/11" (distinct tokens, the guest link shows only that guest); QA "10" ×3 | PASS |
| 11 | Multiple guests | Unit "11"; DB "5/10/11" (limit 2, the third refused); QA "10/11" (limit 1) | PASS |
| 12 | Wrong-venue credential | DB "12" (`wrong-site`, `wrong-gate`); DB "4/12/14" (a check-in code at another business); QA "12" | PASS (sandbox) |
| 13 | Expired credential | Unit "13", "2/13"; DB "13" (cron expiry without a provider call; gate refuses); DB "6/13" (too early) | PASS |
| 14 | Forged credential | Unit "14" ×2 (signature, tamper, staleness; code shapes); DB "4/12/14" (forged and replaced codes), "14/16" (altered and stale callbacks); QA "14", "14/20" | PASS |
| 15 | Duplicate check-in | Unit "15"; DB "15" (three concurrent: one move, one audit row); QA "15/25" | PASS |
| 16 | Duplicate provider callback | DB "14/16" (three concurrent deliveries: one accepted, two duplicates, one row); QA "16" | PASS |
| 17 | Provider outage | DB "17/24/25" (backoff, not re-run early, DEAD after 6, FAILED visible, no silent re-issue, customer retry works) | PASS (sandbox) |
| 18 | Provider timeout | Unit "18" (abort at the deadline); DB "18" (abandoned at 800 ms, retried, then active) | PASS (sandbox) |
| 19 | Provider returns inconsistent results | DB "19" (late confirmation of a withdrawn pass ignored; an older version never replaces a newer one) | PASS (sandbox) |
| 20 | Unauthorized API requests | Unit "20" (security role, provider choice platform-only); QA "20" ×12 (unknown links, signed-out scan, unsigned or tampered callbacks, unknown provider, sandbox and cron without the secret, security cannot change settings, business owners cannot open or override the desk) | PASS |
| 21 | Provider retries and idempotency | Unit "21"; DB "21" (one job per change; re-provision with the same key returns the same pass); DB "23" (two workers, one call) | PASS (sandbox) |
| 22 | No configured external provider | Unit "12/22"; DB "22" (a partner without an integration: nothing offered, requests refused, the adapter refuses); API refuses enabling without a usable provider | PASS |
| 23 | Concurrent credential issuance | DB "23" (4× request + 4× sync → one holder and one live credential; two retries → one) | PASS |
| 24 | Infinite polling/retry prevention | Unit "24"; DB "17/24/25" (backoff, DEAD), "24" (bounded run, finished jobs never re-run); UI polls at most 10× (code review) | PASS |
| 25 | Accurate event and audit logs | DB "2/3/25" (check-in audit row and actor), "7/8/25" (ACTIVE and REVOKED events), "25" (overrides with actor and reason; a cancelled booking cannot be reinstated); QA "25" ×3 | PASS |
| 26 | Existing booking and notification regression | Full unit suite and all DB suites; all earlier QA scripts on the Phase 23 build; QA "26" (a booking outside any venue moves as before and creates no access rows) | see PHASE_23_REPORT.md |

## Code review findings, each with a test that fails on the old code

| # | Finding | Test | Result |
|---|---|---|---|
| R1 | A security hold was overwritten by any temporary reason and then lifted when that reason cleared | DB "R1" | FIXED, PASS |
| R2 | A pass the provider issued, whose confirmation was lost, was marked failed after 24 h | DB "R2" | FIXED, PASS |
| R3 | A callback that beat the provider reference was answered 202 and lost | DB "R2b"; route now answers 503 + Retry-After so any provider retries | FIXED, PASS |
| R4 | A dead REVOKE left the credential stuck, blocking any new pass for good | DB "R4" (a later round succeeds, then re-issue); DB "R4b" (after the last round: closed, escalated, re-issue possible) | FIXED, PASS |
| R5 | A dead UPDATE left the old pass valid at the gate on the old window | DB "R5" (withdrawn, then re-issued for the new time) | FIXED, PASS |
| R6 | An access failure inside a booking move rolled the move back | Moves that end a booking still withdraw passes in the same transaction (or fail, which is safe). Other moves run the access step in a savepoint. The access lock waits at most 3 s, so a timeout is an ordinary error and never the transaction's own timeout | FIXED (code-reviewed; no fault-injection test) |
| R7 | A cancelled booking's code read as "not-found" at the desk | DB "7/8/25" now expects `cancelled` | FIXED, PASS |
| R8 | Venue on/off cycles used up the customer's retry cap | DB "R8" | FIXED, PASS |
| R9 | `VENUE_SECURITY` could read the venue console's API and tenant list | Unit "20"; QA "least privilege: security cannot read…" | FIXED, PASS |
| R10 | A holder with no phone on file could not meet a phone requirement | Holder form offers an optional phone (the booking's own number is used otherwise) | FIXED (UI) |

A second review of the fix commit found 10 more items. All are addressed: retry rounds that could starve or never end (now ordered, and closed after the last round), a cancellation whose withdrawal could be rolled back (ending moves are no longer in a savepoint), a recovery replay that could mark a live remote pass failed (it now replays the original request, and a refusal withdraws), the callback status (503), recovery counting, the lock wait, an explicit escalation check instead of a key pattern, the re-issue bound (unhealthy withdrawals count), and duplicated replay logic (one helper).

"PASS (sandbox)" means the provider side was exercised against the sandbox provider. No real gate system has been tested (status E).
