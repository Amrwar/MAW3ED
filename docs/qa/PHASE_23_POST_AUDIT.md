# Phase 23 — mandatory post-phase audit

**Phase:** 23, booking QR, visitor passes and provider-neutral access. Branch `phase-23`, PR #48.

**Date:** 2026-10-31 → 2026-11-01.

**Environment:** local QA only:
* Docker Postgres `maw3ed-qa` with every migration applied.
* A production build (`next start`) on :3101 with `ACCESS_SANDBOX=1`.
* Chromium via Playwright, Node 22.

**Nothing in this audit was run against production.**

**Commits.** The audit started from `54bacc9`, the phase as reported:
* `9278bfe` fixes this audit's findings.
* `1055dbb` fixes what the review of `9278bfe` found.
* The docs commit adds these reports and a guard in one QA script.

The audit did not trust the phase report. It re-read the requirements, the code and the tests, and ran everything again.
* Two independent read-only reviewers, one for client code and one for server code, were given the code and not the report's conclusions.
* Their findings were checked against the code before anything was fixed.

It found **24 defects** (13 server, 11 client; none P0, nine P2). One of them (A3) is fixed only in part. An independent review of the fix commit then found **10 issues** in those fixes. Nine were fixed and one was dismissed with a reason.

Other reports:
* Loop audit: `PHASE_23_LOOP_AUDIT.md`.
* Every test run: `PHASE_23_REGRESSION_RESULTS.md`.
* What remains: `PHASE_23_OPEN_ISSUES.md`.

## 1. Requirement checklist (the Phase 23 brief)

| Requirement | Status | Evidence |
|---|---|---|
| A. Directory QR (type A), unchanged from 22b, kept apart from the others | PASS | `qa-phase23` "1/A"; `qa-phase22b` 83/83 |
| B. Booking check-in QR (type B): opaque code, only for confirmed bookings, a time window, follows the booking's state, can be replaced | PASS | Unit "2", "2/13"; DB "2/3/25", "6/13", "4/12/14"; `qa-phase23` |
| B. Business check-in: scoped to the caller's diary, idempotent, audited, through the state machine | PASS | DB "2/3/25", "15"; `qa-phase23` "3", "4"; `qa-phase23-loops` C4, C5 (the check-in button now acts on the booking on screen: U5) |
| B. Scanning with a phone camera → `/c/<code>` → sign in → the desk | PASS (after U6) | `qa-phase23-loops` L1. It failed before the audit: the code was lost at sign-in |
| C. Visitor passes (type C): separate entitlement and credential; ACTIVE only on the provider's confirmation; holder and named guests with separate credentials; guest limit | PASS (sandbox) | DB "5/10/11", "6", "23"; `qa-phase23` "10/11" |
| C. Eligibility: booking state, time, business status, venue membership, switch, provider, policy, identity, gates, late entry and no-show cut-offs, notices | PASS | Unit "5", "6", "11"; DB; A5 (a business suspension now reaches the passes at once) |
| C. Cancellation → immediate local revocation; the provider's acknowledgement completes it | PASS (sandbox) | DB "7/8/25"; A1 (a confirmation racing a withdrawal can no longer revive the pass) |
| C. Rescheduling moves the pass | PASS | DB "9", "R5"; A11 (a reschedule after the old window had passed used to expire the pass for good) |
| C. Provider outage, timeout and inconsistent results; retries; idempotency; no provider | PASS (sandbox) | DB "17/24/25", "18", "19", "21", "22"; A2, A7, A9, A13-review |
| D. Provider-neutral adapter and sandbox; the sandbox refused on Vercel and in production without `ACCESS_SANDBOX=1` | PASS | Unit "20/22"; `qa-phase23` "20" |
| E. Real external gate integration | **BLOCKED (external)** | No agreement, specification, credentials or approved integration test. Nothing here is live-provider validation |
| Customer UX (booking page section, guest page) | PASS, Arabic only | `qa-phase23-browser` 18/18. Arabic only, like the booking page (P23-A1) |
| Business UX (check-in desk, sidebar entry) | PASS, Arabic only | `qa-phase23-browser`, `qa-phase23-loops`. English: P23-A1 |
| Venue UX (security desk, policy fields, VENUE_SECURITY role) | PASS, desk Arabic only | `qa-phase23` "20", "25"; `qa-phase23-loops` S1, L2; P23-A1 |
| Security (signatures, freshness, dedupe, least privilege, data minimisation, rate limits) | PASS | §4 |
| Resilience (bounded retries, dead letters, escalation, reconcile) | PASS | `PHASE_23_LOOP_AUDIT.md` |
| Tests 1–26 | PASS (26 with the O4 note) | `docs/testing/ACCESS_ACCEPTANCE_MATRIX.md`; re-run in this audit |
| Required documents (report, 2 architecture, threat model, matrix) | PASS | `docs/phases`, `docs/architecture`, `docs/security`, `docs/testing` |
| Production verification | NOT TESTED | Not deployed (P23-G1) |

## 2. Implementation verification

**End to end.** Each flow was verified from the UI through the API to the database and on to the next request, not component by component:
* Customer: page → `/api/booking/<token>/access/*` → entitlement, credential and job rows → the sandbox → the callback → the page.
* Business desk: scan or paste → `/api/business/check-in` → state machine → audit log.
* Security desk: view, then hold or restore → event log.

**Permissions** are enforced on the server for every route and were attacked directly (§4), never inferred from hidden buttons.

**States:**
* Empty, loading and error states exist on all four screens.
* The audit added two the security desk lacked: a failed refresh shown while rows are on screen (U7), and network errors on actions (U8).
* The customer panel's polling ends (P1).

**Other checks:**
* No dead controls were found.
* The two one-click high-impact actions now ask first: switching passes off for a venue, and replacing a check-in code (U11).
* No fabricated production data: every fixture is a tagged QA row, removed after its run.
* The sandbox is labelled on every screen it reaches.

**Mobile layout.** The customer page and desks were checked at 390 px:
* `qa-phase23-browser` and `qa-phase23-loops` use phone viewports for the customer;
* `qa-phase18` (544 loads, 4 widths) found 0 overflow or axe issues.

**RTL/LTR.** All Phase 23 screens are RTL Arabic. English is an open item (P23-A1).

**Notifications** are unchanged by Phase 23 (regression: booking E2E, phases 17–22c).

**Payments:** Phase 23 adds none. The booking engine's payment paths are covered by `qa-booking-e2e` with the fake gateway.

## 3. Defects found by this audit

Server (independent server reviewer, confirmed in code):

| # | Sev. | Defect | Root cause | Fix | Regression test |
|---|---|---|---|---|---|
| A1 | P2 (security) | A provider confirmation racing a cancellation could turn the withdrawn pass back to ACTIVE. The revoke job then skipped the provider, so a cancelled booking kept gate access | `activate()` read the status, then updated with no condition | Conditional `updateMany`, re-checked by Postgres under the row lock | DB "A1" (fails on old code) |
| A2 | P2 (security) | A provider refusing an UPDATE marked the pass FAILED and left the old pass valid at the gate. A retry then issued a second live pass | `applyIssue` treated every refusal as a failed first issue | A refused update withdraws (REVOKE); a refused first issue still fails | DB "A2" (fails on old code) |
| A3 | P3 | A provision that timed out on its last attempt was marked FAILED, though the provider may have created the pass | Give-up assumed nothing reached the provider | Partly fixed, in the review round: timed-out and interrupted provisions are withdrawn; the REVOKE replays the original call to find the pass and revokes it. Remainder: P23-A2 | DB "A7" (interrupted case) |
| A4 | P2 | A retry racing a cancellation could issue a pass for a cancelled booking, which nothing ever withdrew | The entitlement was read before the lock and not again | Re-read under the lock; issue only if still ELIGIBLE | DB "A4" (fails on old code) |
| A5 | P2 | A business suspended by the platform kept its visitors' passes until the cron's round-robin reached them: hours with thousands of passes. The report promised "within one cron interval" | No hook on business status changes | `accessAfterBusinessChange` (one relational query, after the response); docs corrected | DB "A5" (fails on old code) |
| A6 | P3 (loop) | A booking whose re-decision kept failing stayed at the front of the cron's queue; 50 such bookings would stall it permanently | Touched only on success; ended windows unordered | Touched either way; ordered | Code review (no deterministic fixture) |
| A7 | P2 (loop) | A job whose processing threw outside the provider path aborted the whole run and stayed first in line every run. A job killed on its last attempt was reclaimed forever | No per-job catch; the claim never checked the cap | Per-job isolation with backoff, then DEAD through `giveUp`; past the cap it is given up without another call | DB "A7" (fails on old code) |
| A8 | P3 | The cron started one `after()` job runner per re-decided booking (up to 50), all killed at 60 s; the 45 s budget plus one slow item could overrun `maxDuration` | Kick inside the cron's own syncs; budget too close to the limit | `kick: false` in bulk paths; 30 s budget | Code review |
| A9 | P3 | An UPDATE waiting for a provider reference that ran out of attempts died silently, with the pass shown as "updating" forever | `retryLater` dead-lettered without `giveUp` | Ends through `giveUp` (withdrawal plus a PROVIDER_ERROR event) | DB "A9" (fails on old code) |
| A10 | P3 (perf) | Every sync counted gate entries without an index; cron and job queries had none | Missing indexes | 4 indexes in `phase23_access.sql` (not yet applied to production) and the schema; the verifier requires them | Verifier on QA |
| A11 | P3 | A reschedule made after the old window had passed expired the pass for good | The expiry check ran before the new decision | Expire only if the new window has also passed | DB "A11" (fails on old code) |
| A12 | P3 | A changed name or phone never reached the provider | No version bump | Bump when what the provider is sent changes (first name, phone) | DB "A12" (fails on old code) |
| A13 | P3 | A business in two venues could be assigned to either one, run to run | Unordered query | Ordered by `createdAt, id` | Code review |

Client (independent client reviewer, confirmed in code):

| # | Sev. | Defect | Root cause | Fix | Regression test |
|---|---|---|---|---|---|
| U1 | P2 | A double click on "scan" opened two camera streams; closing stopped one, so the camera stayed on | No "starting" state; one stream reference | Scan sessions; older streams stopped | `qa-phase23-loops` C1 (old: 2 live after close) |
| U2 | P2 | Leaving the page while the browser was still opening the camera left a live camera nobody could stop | The stream arrived after unmount | A stream from a stale session is stopped on arrival | C2 (old: 1 live) |
| U3 | P3 | An error after the stream opened (`play()`, the detector) left it running behind "camera not available"; a refusal disabled the button until reload | The catch did not stop the stream | Stopped in every path; a refusal can be retried; opening can be cancelled | Code review, C1/C2 |
| U4 | P3 (loop) | A quick close/reopen ran two scan loops (duplicate verifies) | The loop's exit test was "any stream" | Session check | C3 (old: 18 reads in 3 s) |
| U5 | P2 | "Check in" sent whatever was typed in the field, not the booking on screen, so a different booking could be marked arrived | The button read the input | It acts on the verified code; only the newest answer is shown | C5 (old: the typed booking ARRIVED) |
| U6 | P2 | Signing in from a scanned code lost the code; venue security landed on onboarding, not their desk | The login read only `callbackUrl` into `/dashboard` | `loginDestination`: `next`/`callbackUrl` into `/dashboard`, `/venue-admin`, `/org-admin`, `/c/<code>`; same-site only, dot segments resolved | `login-destination.test.ts` (6); L1, L2 (old: `/dashboard`, `/onboarding`) |
| U7 | P3 | The security desk hid a failed refresh, and showed another day's rows as current | `failure` was shown only before the first load | Banner; rows for another day marked; stale answers dropped | S1 (old: FAIL) |
| U8 | P3 | Desk actions showed nothing when offline (unhandled rejection) | No catch | Message: "nothing changed, try again" | S1 |
| U9 | P3 | Raw English reason codes appeared in the Arabic desk | The code was shown, not its text | `reasonText` in the payload | Code review |
| U10 | P3 | "Copy pass link" did nothing without a clipboard API (in-app browsers) | Optional chaining skipped the fallback | Shows the link | Code review |
| U11 | P3 | One click switched off every visitor pass at a venue, or killed a check-in code | No confirmation | An inline confirm step (no browser dialog) | Code review |

## 4. Security and permissions

Verified directly:
* `qa-security` 32/32.
* `qa-phase23` "20" ×12 and "4", "12", "14".
* DB "4/12/14", "14/16", "R1", "A1", "A2", "A4".

Covered:
* **Authentication:** signed out → 401; forged and expired tokens.
* **Role-based authorization.** `VENUE_SECURITY` is limited to view and override; it cannot read the console API or tenants (R9). Providers are platform-only; the on/off switch is the operator's.
* **Ownership and isolation:**
  * Business ownership and delegate scopes: check-in needs `bookings.progress` and reuses `bookingScope`.
  * Cross-business isolation: another business's code reads as not-found and cannot be checked in.
  * Cross-venue: a credential is refused at the wrong site or gate.
  * Customer booking ownership: token routes are scoped by `{ id: guestId, bookingId }`; a guest token cannot act on the holder.
* **Provider callbacks:** HMAC, freshness within 300 s, constant-time comparison, dedupe, 16 KB body cap, rate-limited invalid attempts.
* **Sandbox:** refused on Vercel and in production without the flag; its route needs the cron secret.
* **Data minimisation.** The desk payload carries no phone, email, price, service, reference or payment data. Only the business name is shown: decision P23-A5.
* **Logs and secrets.** No secret is logged. The sealed pass token is stored encrypted.
* **New in this audit:**
  * the login allowlist (dot-segment bypass found by the review and fixed: RV7);
  * the pass-revival race (A1);
  * the refused-update pass (A2).

Frontend hiding is never the control.

## 5. Database integrity

**Schema and migrations** (`prisma/schema.prisma`; `phase23_access_enums.sql`, `phase23_access.sql`):
* The migrations are additive and re-runnable. The audit re-ran `phase23_access.sql` on QA: success, and the verifier passes, except its deliberate production-only check for a sandbox provider.
* The unique constraints match the code's assumptions: one live credential per entitlement, one holder per booking, provider references, event IDs, idempotency keys, check-in tokens.
* Cascades run booking → guests → entitlements → credentials → jobs/revocations. Providers are RESTRICT.
* The window CHECK constraint held: a test that broke it was rejected by the database.

**Existing data.** Nothing changes for existing rows. No venue is switched on and no provider is created.

**Concurrency** (all DB tests):
* the advisory lock per booking (DB "23");
* conditional claims (two workers);
* idempotent check-in (3 concurrent);
* deduplicated callbacks (3 concurrent);
* the activation race (A1);
* the retry race (A4).

**Indexes:** 4 were added (A10).

No production data was read or changed.

## 6. User journeys

| Journey | Arabic | English | Evidence |
|---|---|---|---|
| Customer: discovery, booking, confirmation, rescheduling, cancellation, reviews | PASS | PASS (site pages) | `qa-booking-e2e` 22/22, `qa-phase17`–`21`, `qa-phase18` (ar+en, 544 loads) |
| Customer: booking QR and visitor pass | PASS | n/a (the booking page is Arabic only) | `qa-phase23-browser`, `qa-phase23-loops` P1/P2 |
| Business: dashboard, services, staff, bookings, customers, permissions | PASS | PASS | `qa-phase18` (dashboard in en), phases 19–22c |
| Business: check-in | PASS | Arabic only (P23-A1) | `qa-phase23-browser`, `qa-phase23-loops` C1–C5, L1 |
| Organization: registration, association, OWNED/HOSTED/MANAGED, invitations, directory, share links, QR, permissions | PASS | PASS | `qa-phase22b` 83/83, `qa-phase22c` 59/59 |
| Venue access: eligibility, pass state, revocation, provider failure | PASS (sandbox) | Arabic only | DB suite, `qa-phase23` 48/48 |
| Admin: role enforcement, tenant access, auditing, entitlements | PASS | PASS | `qa-security` 32/32, `qa-phase22` 68/68 |
| Payments | Fake gateway only | — | `qa-booking-e2e`. No live payment was made |

## 7. Infinite-loop audit

See `PHASE_23_LOOP_AUDIT.md`. Three loop-class defects were found and fixed (U4, A7, A6), with leaks U1 and U2. **No known or reproducible unbounded loop remains in the reviewed scope.** This is a coverage statement, not a proof.

## 8. Verification commands and results

See `PHASE_23_REGRESSION_RESULTS.md`.

**Final code:**
* tsc clean; lint 0 errors; build OK.
* 1282 tests passed, 34 skipped.
* QA scripts: `qa-phase23` 48/48, browser 18/18, loops 15/15, `qa-security` 32/32, `qa-phase22` 68/68, `qa-phase22b` 83/83, `qa-phase22c` 59/59, `qa-booking-e2e` 22/22, `qa-redirects` 108/108, `qa-loops-browser` 9/9.
* From the earlier battery: phases 17–21, `qa-phase18` (544/0), venue sweeps.

**Evidence that the new tests detect the defects:**
* 8 new DB tests fail on the pre-audit code.
* 7 browser checks fail on the pre-audit client.

## 9. Second review of the fixes (bounded: one round)

`/code-review` (high) on `54bacc9..9278bfe`, run once:

| # | Finding | Action |
|---|---|---|
| RV1 | The per-job catch dead-lettered a job without `giveUp`, so its credential was left half-way | Fixed: ends through `giveUp`, with a plain dead-letter only if that also fails |
| RV2 | A provision interrupted on its last attempt was marked FAILED with a possible pass at the provider | Fixed: timed-out or interrupted provisions are withdrawn (REVOKE replays the original call). DB "A7" updated |
| RV3 | The business hook took 200 bookings with no live filter, so ended bookings crowded out live ones | Fixed: one relational query of live passes only |
| RV4 | Any name edit bumped the version, even when nothing sent changes; a refusal would then withdraw a working pass | Fixed: only first-name or phone changes. DB "A12" checks both ways |
| RV5 | The new venue ordering could re-point existing entitlements on deploy | **Dismissed:** Phase 23 is not deployed and no entitlement exists in production, so the ordering is in force from the first pass. The general "business moves venue" case is P23-A7 |
| RV6 | An UPDATE waiting on a slow provision could exhaust its attempts and withdraw that provision's pass | Fixed: it waits on the provision's own bound without using its attempts. DB "A13" |
| RV7 | `?next=/venue-admin/../admin` passed the allowlist | Fixed: the path is resolved before checking. 3 more test cases |
| RV8 | A stale day's answer could overwrite the desk; the loading note stuck on failure | Fixed |
| RV9 | Two queries on the request path for the business hook | Fixed with RV3 |
| RV10 | A `play()` NotAllowedError was shown as a permission refusal; an opening camera could not be cancelled | Fixed |

After these fixes:
* the access and auth suites (80 tests);
* the final build;
* the Phase 23, security and Phase 22 scripts;
* the full suite.

were re-run, and all passed (§8). No further review round was run, by design; that is a limit of this audit.

## 10. Final diff inspection (`54bacc9..HEAD`)

* No `console.log` outside the QA scripts' result lines.
* No `debugger`, TODO/FIXME, `.skip` or `.only`.
* No credentials. The new browser script copies the QA owner's password hash locally, as the existing Phase 23 script does.
* No test was disabled or weakened. Two QA scripts changed:
  * `qa-phase23-browser`'s pending check holds the sandbox unconfirmed, which removes a race;
  * `qa-phase22c` now stops if acting fails before writing.
* Schema and migration changes are additive indexes in a migration not yet applied to production. Its verifier (scratchpad `verify-phase23.sql`) checks them.
* Temporary debugging copies of a QA script were deleted. `git status` was clean apart from these docs.

## 11. Release decision

| | |
|---|---|
| PHASE NUMBER | 23 |
| PHASE REQUIREMENTS STATUS | A PASS · B PASS · C PASS (sandbox) · D PASS · E **BLOCKED (external)** |
| CODE REVIEW STATUS | Phase: 2 rounds (20 findings, fixed). Audit: 2 independent reviewers (24 defects, fixed; A3 partly, remainder P23-A2) and 1 review of the fixes (10 findings: 9 fixed, 1 dismissed with a reason) |
| BUILD STATUS | PASS (production build) |
| UNIT TESTS | PASS |
| INTEGRATION TESTS | PASS: 1282 passed, 34 skipped (one earlier full run hit the known O4 flake: 3 contention tests, which passed alone and in the next full run) |
| E2E TESTS | PASS: all Phase 23, 22, 22b, 22c, booking, redirect and loop scripts; phases 17–21 and the 544-load sweep on the first fixed build |
| SECURITY TESTS | PASS: 32/32 plus Phase 23 attack checks |
| DATABASE INTEGRITY | PASS on QA (re-runnable, verified); production not applied |
| INFINITE-LOOP AUDIT | PASS: 3 found and fixed; no known or reproducible unbounded loop remains in scope |
| MEMORY LEAK REVIEW | PASS: 2 camera-stream leaks fixed; heap flat across reloads |
| PERFORMANCE REVIEW | PASS with notes: indexes added, cron budget fixed; no sustained-load test; table retention open (P23-A3) |
| REGRESSION TESTS | PASS |
| TESTS NOT RUN | Production verification; real provider; real iOS/Android camera; sustained load |
| BUGS FOUND | 24 by the audit plus 10 by the review of its fixes (one dismissed) |
| BUGS FIXED | 24 (A3 partly) plus 9 |
| UNRESOLVED BUGS | None P0, P1 or P2. P3: P23-A1 (English for the Phase 23 screens), A2 (remaining provider-orphan cases), A3, A4, A6, A7; decisions A5 and O1 |
| EXTERNAL BLOCKERS | E: real gate provider (agreement, specification, credentials, approved integration test) |
| PRODUCTION READINESS | Ready to deploy **after** the owner runs `migrate-phase23.sh` (it now creates the audit's indexes too). In production, Phase 23 adds the booking check-in QR only; visitor passes stay off until E |

**FINAL VERDICT: PARTIAL.** Everything Maw3ed controls passes, with no open P0, P1 or P2 issue. The verdict is PARTIAL because requirement E is externally BLOCKED, because Phase 23 has not been verified in production, and because the Phase 23 screens are Arabic only (P23-A1). It is not a FAIL.

**Next actions (owner):**
1. Run `migrate-phase23.sh` (scratchpad) on production; it ends with the read-only verifier.
2. Merge PR #48.
3. On production: open a confirmed booking's page, see the check-in QR, and check it in from `/dashboard/check-in`.
4. Decide P23-A5, which businesses' names the security desk shows, and P23-O1, plaintext guest tokens.
5. Choose whether P23-A1 (English for the four screens) is done before Phase 24.

Phase 24 has not been started.
