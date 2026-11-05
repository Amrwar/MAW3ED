# Final requirements matrix

Final audit, 2026-11-05. Each requirement area of the roadmap, phases 1–28,
against the code and the evidence produced in this audit. Status meanings:

- **VERIFIED (local):** automated tests plus an end-to-end QA script pass on
  the production build with the QA database.
- **VERIFIED (prod, read-only):** additionally seen working on maw3ed.net
  without signing in.
- **PARTIAL:** works for what it does; part of the requirement is missing.
- **BLOCKED:** needs something outside the repository.
- **NOT BUILT:** absent.

"Verified" never means verified with real customers, partners or money.

## Public website

| Requirement | Status | Evidence |
|---|---|---|
| Home, directory, search (Arabic-aware), categories, cities and districts | VERIFIED (prod, read-only) | 64/64 sitemap URLs 200 on production; `qa-phase26` 114/114; `qa-phase18` 544 loads, 0 flagged |
| Business profiles, services, JSON-LD | VERIFIED (local) | `jsonld.test.ts`; F-37 English JSON-LD on `/en` |
| Organization profiles and directories (`/groups`), venue directories (`/venues`) | VERIFIED (local) | `qa-phase22b` 84/84, `qa-venue-page` clean, `qa-phase24` 147/147 |
| Pricing (from `lib/plans.ts`) | VERIFIED | Pricing, help and home read one source (web audit) |
| Authentication (password, WhatsApp OTP) | PARTIAL | Password verified; OTP depends on Meta delivery (BLOCKED for live proof) |
| Policies, help, support, account deletion | PARTIAL | Pages exist and are linked (help now in the footer, F-34). **Legal text incomplete** (entity, retention, age, money terms): owner/counsel |
| Arabic RTL and English LTR | VERIFIED (local) | `qa-responsive` 380 loads × 10 devices × 2 languages, none wider than its screen; no physical-direction classes; payment and billing pages now bilingual (F-31–F-33) |
| No fake reviews, invented metrics or partner claims | VERIFIED | Web audit: removed testimonials stay removed; `aggregateRating` only when reviews exist; no Emaar/Eterna claim |

## Booking engine

| Requirement | Status | Evidence |
|---|---|---|
| Availability (staff hours, resources, capacity, party size, blocks, holidays, branches) | VERIFIED (local) | 134 booking unit tests; `create.db.test.ts`, `reliability.db.test.ts` |
| No double-booking under concurrency | VERIFIED (local) | Three database exclusion constraints; per-business advisory-lock queue; contention DB tests pass |
| Buffer minutes under a race | PARTIAL | Enforced in slot derivation, not by the constraints (B-08, P3) |
| State machine, confirm, cancel, reschedule, no-show | VERIFIED (local) | `booking-transitions.test.ts`, `qa-booking-e2e` 22/22 |
| Time zones (Africa/Cairo, DST) | VERIFIED (local) | Wall-clock frame with `wallToInstant`; F-16 fixed the UTC month for plan caps |
| Deposits and payments | BLOCKED | Code and tests; **no real Paymob payment has ever succeeded**; Stripe test mode only |
| Packages, memberships, loyalty on bookings | VERIFIED (local) | `qa-phase27` 66/66; F-11 (re-check on reschedule) fixed |
| Restaurant tables | PARTIAL | Tables and party size exist; not part of a dedicated QA pass (inventory) |
| Booking QR and check-in | VERIFIED (local) | `qa-phase23` 48/48, `qa-offline-qr` 31/31. Camera scanning was blocked by a header (F-02, fixed; needs a device check) |
| Organization booking attribution | VERIFIED (local) | `qa-phase24`, `qa-phase26` |

## Organization platform

| Requirement | Status | Evidence |
|---|---|---|
| Registration, review, OWNED/HOSTED/MANAGED, several relationships per business | VERIFIED (local) | `qa-phase22c` 59/59, `qa-phase24` 147/147, `qa-phase28` 46/46 |
| Delegated permissions, branch limits, revocation | VERIFIED (local) | Same; F-21/F-26 closed branch-limit gaps; F-20 closed a money leak to REPORTS-only delegates |
| Hosted mall cannot read tenant finance or customer records | VERIFIED (local) | DB CHECKs; `visibility.ts` per-row; `qa-phase28` isolation 10/10 |
| Circular graphs | VERIFIED | Trigger; cycle attempt in `qa-phase28` |
| Suspension stops everything | VERIFIED (local) after F-22 | Venues, desk and passes now stop with the organization |
| Public organization QR (marketing link, not an entry pass) | VERIFIED (local) | `qa-phase22b` |
| Subscription separation, ownership preserved | VERIFIED | No path writes `ownerId`, plan or billing from an organization (security audit) |

## Visitor access

| Requirement | Status | Evidence |
|---|---|---|
| Eligibility, issuance, expiry, revocation, reschedule, guest passes, audit | VERIFIED (local, sandbox) | `qa-phase23` 48/48, `qa-phase23-browser` 49/49, `qa-phase23-loops` 15/15 |
| Provider event processing and outage handling | VERIFIED (sandbox) | HMAC, de-duplication, backoff, DEAD |
| A real gate provider | BLOCKED | No partner; `partnerAdapters` empty |
| Real Emaar integration | BLOCKED / NOT CLAIMED | Concept only; no agreement or specification |

## Mobile

| Requirement | Status | Evidence |
|---|---|---|
| Customer and business app code, Arabic/English, offline cache, deep-link mapping | PARTIAL | 240 unit tests, typecheck and lint clean; contracts match the server (mobile audit); M-04/M-05 fixed |
| Android release | BLOCKED | One test APK built 2026-11-04; no device test recorded; Maestro needs an APK URL or a paid Expo plan |
| iOS release | BLOCKED | No build; no Apple developer setup in evidence |
| Push, universal/app links, store review | BLOCKED | Needs signed builds, `APPLE_TEAM_ID`, `ANDROID_CERT_SHA256` |

## Payments and subscriptions

| Requirement | Status | Evidence |
|---|---|---|
| Initiation, webhooks (signature, idempotency, amount checks), refunds, ledger, reconciliation | VERIFIED (local, fake provider) | Paymob and Stripe DB tests; F-10, F-12–F-15, F-17 fixed |
| Stripe plan payments | PARTIAL | Test mode end to end on staging; live configured; **no live payment** |
| Paymob | BLOCKED | Never a real success; duplicate-order behaviour unverified |
| Payout of deposits to businesses | NOT BUILT | No payout code; needs a decision |
| Organization billing | PARTIAL by design | Contracts hold limits only; no prices invented |

## Notifications and background work

| Requirement | Status | Evidence |
|---|---|---|
| Email, WhatsApp, push, in-app; reminders; outbox with retries and dead-letter | VERIFIED (local) | `outbox.db.test.ts` 8/8; `qa-phase19`; push gated on a live session (F-03) |
| Live delivery through providers | BLOCKED / unverified | Resend and Meta configured; no recorded live send to a customer |
| Crons bounded and recorded | VERIFIED (local) after F-28/F-29 | `FINAL_INFINITE_LOOP_AUDIT.md` |
| SMS | BLOCKED | No provider chosen |

## Enterprise (Phase 28)

| Requirement | Status | Evidence |
|---|---|---|
| API v1, keys, scopes, limits, webhooks, contracts, per-venue credentials | VERIFIED (local) | `qa-phase28` 46/46; F-23/F-24/F-25 hardening |
| Real partner validation | NOT DONE | No real organization, contract, API consumer or gate provider |

## Operations

| Requirement | Status | Evidence |
|---|---|---|
| Health, job records, feature flags, runbooks | VERIFIED (local); production health 200 | Phase 28; this audit |
| Off-site backups | **Verified** | F-01: never succeeded before the fix; manual run and restore drill passed 2026-11-05 |
| Restore | VERIFIED on QA | Phase 28 drill |
| Rollback | VERIFIED on staging | Phase 28 rehearsal |
| Monitoring and alerting | PARTIAL | Sentry DSN set; uptime monitor and alert rules not in evidence |
