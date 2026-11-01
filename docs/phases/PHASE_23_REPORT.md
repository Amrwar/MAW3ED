# Phase 23 report: booking QR, visitor passes and provider-neutral access

Date: 2026-10-31. Branch `phase-23`, on `main` at `312facd` (Phase 22 final, live).

Migrations:
* `prisma/migrations/phase23_access_enums.sql`, then `prisma/migrations/phase23_access.sql`.
* **Not yet applied to production.** They must be applied **before** this code deploys (see "Deploying").
* They are additive: no venue is switched on, no provider is created, no existing row changes meaning.

## Status

| | Area | Status | Basis |
|---|---|---|---|
| A | Booking QR (check-in code) | **PASS** | Unit, DB and HTTP tests; browser check of the customer page |
| B | Business check-in | **PASS** | DB and HTTP tests (authorised, unauthorised, duplicate, wrong business, forged); browser check of the desk |
| C | Visitor pass system | **PASS (sandbox)** | Full lifecycle against the sandbox provider: DB, HTTP and browser |
| D | Sandbox provider | **PASS** | Every failure mode exercised; refused on Vercel and in production builds without `ACCESS_SANDBOX=1` |
| E | Real external gate integration | **BLOCKED** | No partner agreement, API specification, credentials or approved integration test exist. No operator is named, and no endpoint or credential is invented anywhere |

"PASS (sandbox)": the provider side was exercised against the sandbox. Nothing here claims compatibility with any real gate system.

## Phase 22 foundations confirmed on this branch

* Organization relationships, delegation and venue membership pass, both as DB suites (`phase22b.db.test.ts`, `phase22c.db.test.ts`, `venues/phase22.db.test.ts`) and as QA scripts (`qa-phase22` 68/68, `qa-phase22b` 83/83, `qa-phase22c` 59/59).
* Booking attribution and server-side permissions (`bookingScope`, delegate scopes) are reused unchanged by the check-in API.
* Phase 22's production migrations (`phase22c_*`) were applied and verified on 2026-10-31.

## What was built

The three QR kinds are kept apart in payload, issuer, verifier and wording. See `docs/architecture/QR_CREDENTIAL_LIFECYCLE.md`.

### A. Directory QR

Unchanged from 22b. It was re-tested.

### B. Booking check-in code

`lib/access/check-in.ts`, model `BookingCheckIn`.

* The code is `HMAC(key, bookingId.nonce)`. Only the nonce and the code's hash are stored.
* The QR holds `https://<site>/c/<code>` and nothing else.
* It is shown only for confirmed bookings. It is valid from 30 minutes before the start to 30 minutes after the end.
* Whether a code is good is decided at the scan, from the booking itself, so it follows cancellation, no-show, completion and reschedule with nothing pushed.
* The customer can replace a code they think leaked; the old one dies at once.

Staff check-in:
* `POST /api/business/check-in` verifies or checks in, scoped to the caller's own diary.
* Checking in goes `CONFIRMED → ARRIVED` through the existing state machine, idempotently, and is audited (`booking.check_in`).
* Screens: `/dashboard/check-in` (camera via BarcodeDetector where supported, or paste), and `/c/<code>`. A scan with a phone camera lands there; it shows the desk to the business's own staff and nothing to anyone else.

The booking engine is not replaced. Check-in is the existing `ARRIVED` move, and the manual "arrived" button remains the documented fallback.

### C. Visitor passes

`lib/access/{eligibility,passes,sync,events,reconcile,hooks}.ts`.

* **Separate records.** Entitlements (Maw3ed's decision to let someone *ask*) are kept apart from credentials (what the provider issued). A pass is `ACTIVE` only on the provider's confirmation, and a confirmed booking issues nothing by itself.
* **Who asks.** The holder asks for a pass, and adds named guests within the venue limit. Each guest gets a separate credential and their own link (`/pass/<token>`).
* **Eligibility** covers:
  * booking state;
  * appointment time and window;
  * business status;
  * venue membership, by branch;
  * venue switch and provider;
  * policy (admission by booking);
  * guest limit;
  * identity requirement;
  * allowed gates;
  * late-entry and no-show cut-offs;
  * venue notices.
* **Final versus recoverable.** Only an ending booking or a removed guest revokes for good. Anything that can clear suspends, and the pass is re-issued when it clears.
* **Kept in step** with the booking in the same transaction as every status move, after both reschedule routes, after venue policy, notice, tenancy and switch changes, and by a five-minute reconcile cron.
* **Provider calls are jobs:**
  * leased;
  * 8 s timeouts;
  * exponential backoff;
  * 6 attempts, then dead-lettered into a visible state;
  * idempotency keys and correlation ids.
* **Callbacks** are HMAC-signed, fresh within 5 minutes, de-duplicated, and order-safe.

### D. Provider-neutral adapter and sandbox

`lib/access/provider.ts` and `lib/access/sandbox.ts`. Contract: `docs/architecture/ACCESS_PROVIDER_INTERFACE.md`.

* Operations: provision, update, revoke, status, parseEvent, health.
* Configuration is scoped per venue: provider and site reference (platform only), switch and policy (venue operators). No secret is stored in the database.
* The sandbox has its own store, five failure modes, a gate with site, window, cut-off, gate, anti-passback and re-entry checks, and a QA control route.

### Screens and APIs

| Who | Where |
|---|---|
| Customer | `/booking/<token>`: the check-in QR and the venue pass section. API `/api/booking/<token>/access/*`, the same JSON for the web page and the future app |
| Guest | `/pass/<token>`, `/api/pass/<token>` |
| Business | `/dashboard/check-in` (and in the sidebar for owners and delegates with `bookings.progress`); pass-state counts on the booking detail API. Gate events are the venue's and are not shown |
| Venue | `/venue-admin/<id>/access`, the security desk: today's passes (names, windows, states, gate events; no phones, services, prices or references), hold and restore with a reason, escalate, provider health. Operators also switch passes on and off; the platform picks the provider. The venue console's policy form gained identity, late-entry and no-show cut-offs and the escalation contact. New role `VENUE_SECURITY`, limited to `venue.access.view` and `venue.access.override` |
| Cron | `/api/cron/access` every five minutes (`vercel.json`) |

## Tests and results

All on this branch, against the QA database and a production build with `ACCESS_SANDBOX=1`:

| Suite | Result |
|---|---|
| Phase 23 unit (`src/lib/access/access.test.ts`) | 24/24 |
| Phase 23 DB (`src/lib/access/phase23.db.test.ts`), including 6 review-finding tests | 26/26 |
| Full suite with DB suites | 1265 passed, 34 skipped (second run). The first run had 3 timeouts in `bookings/reliability.db.test.ts`, which passes 13/13 alone and in the next full run: known flake O4, and booking creation does not touch Phase 23 code |
| Lint | 0 errors (6 warnings, all in files this phase does not touch) |
| Type check | clean |
| `scripts/qa-phase23.mjs` (HTTP) | 48/48 |
| `scripts/qa-phase23-browser.mjs` (Chromium) | 18/18, no console errors; the pending-pass check stops polling on its own |

Every test in the brief (1–26) is mapped in `docs/testing/ACCESS_ACCEPTANCE_MATRIX.md`.

### Test 26: regression on the Phase 23 build

| Script | Result |
|---|---|
| `qa-booking-e2e` | 22/22 |
| `qa-phase17` | 13/13 |
| `qa-phase19` | 21/21 |
| `qa-phase20` | 19/19 |
| `qa-phase21` | 44/44 |
| `qa-phase22` | 68/68 |
| `qa-phase22b` | 83/83 |
| `qa-phase22c` | 59/59 |
| `qa-redirects` | 108/108 |
| `qa-loops-browser` | 9/9 |
| `qa-security` | 32/32 |
| `qa-venue-console` | all clean |
| `qa-venue-page` | all clean |
| `qa-phase18` (368 page loads) | 2 flagged in one run, 3 in another: Chromium renderer crashes ("Target crashed"), on different pages each run, with those pages served 200. Browser instability over a long run, not an application failure. **PARTIAL**, recorded as open issue P23-O3 |

Notifications are unchanged. A booking outside any venue moves exactly as before and creates no access rows (QA "26").

## Defects found and fixed during the phase

| Defect | Found by |
|---|---|
| Two concurrent syncs could both issue a credential; inside a booking move that would have failed the move. Fix: a per-booking advisory lock | Writing DB test 23 |
| In-transaction reads that load sibling relations sent overlapping queries on one connection (deprecated in `pg`; breaks in `pg@9`). Fix: flat sequential queries | DB run warning, bisected |
| The QR URL was relative when `NEXT_PUBLIC_SITE_URL` was not set at build. Fix: the existing `siteUrl()` helper | HTTP QA |
| Repo guard tests: undeclared env vars, rate limits above the house maximum, open routes without reasons | Full suite |
| Ten code-review findings (security-hold bypass, lost confirmations, stuck revocations, stale passes after a failed update, booking moves exposed to access failures, unhelpful cancelled-code result, retry cap counting re-issues, an over-broad security role, holder phone). All fixed, each with a test where one is possible | Code review; see the matrix ("R1–R10") |

## Deploying

1. **Apply the migrations to production first.** They are additive, and the code needs the tables:
   * `migrate-phase23.sh` (scratchpad, run by the owner) applies `phase23_access_enums.sql`, then `phase23_access.sql`, then runs `verify-phase23.sql`. The verifier is read-only: it raises unless every enum, table, column, index and constraint is present, every venue still has passes off, and no sandbox provider exists in that database.
   * A booking move is protected even if the order slips: the access step runs in a savepoint and is logged, not fatal.
2. Optional: set `ACCESS_CREDENTIAL_KEY` (32 random bytes, base64) on Vercel. Without it, keys are derived from `AUTH_SECRET`.
3. Merge. The new cron (`/api/cron/access`) starts on deploy. With no venue switched on, it finds nothing to do.
4. Nothing changes for customers until a platform administrator assigns a provider to a venue. On production that is impossible until a real integration exists (status E), so in production Phase 23 adds the booking check-in QR only.

## Open issues and decisions

| ID | Item |
|---|---|
| P23-O1 | **[DECISION]** Guest invitation tokens are stored in plaintext, as booking manage tokens already are, so the holder can re-share the link. Alternative: hash both and re-issue on demand |
| P23-O2 | The mobile app has the API (`/api/booking/<token>/access`, `/api/business/check-in`) but no screens yet: no QR display and no scanner |
| P23-O3 | `qa-phase18` browser runs hit intermittent Chromium renderer crashes over ~370 page loads. Not reproducible per page; worth splitting that script into smaller browser sessions |
| P23-O4 | A real gate provider (E) needs, in order: an agreement, the operator's specification, credentials and an approved integration test. Then one adapter file (see the interface doc) |
| O4 (existing) | `bookings/reliability.db.test.ts` timeouts under a loaded parallel run |

Phase 24 has not been started.
