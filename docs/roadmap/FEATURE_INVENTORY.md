# Feature inventory

Baseline: `main` @ `77c8649`, 2026-10-28. Updated by Phase 17
(`docs/audits/CRITICAL_FINDINGS.md` holds the findings referred to as
P17-xx). Update this file whenever a phase changes a feature's status.

## Classification

| Status | Meaning |
|---|---|
| **VERIFIED** | Existing and verified working: automated tests cover the core behaviour **and** it has been exercised end to end (local QA database, recorded in `docs/qa-*.md`, a phase report, or a PR's QA notes). |
| **INCOMPLETE** | Existing but incomplete: works for what it does, missing a part the roadmap needs. |
| **DEFECTIVE** | Existing but defective: a known bug. |
| **MISSING** | Not in the codebase. |
| **BLOCKED** | Built, or buildable, but completion or verification depends on something outside the repository (credentials, a provider, a partner, a device, money). |

"Verified" here never means verified in production. Production
verification is tracked separately in `PHASE_STATUS.md`.

## Customer-facing (web)

| Feature | Status | Evidence / notes |
|---|---|---|
| Business discovery: search, filters, categories, cities, city×category pages | VERIFIED | `src/lib/discovery/*`, `search.test.ts`, `synonyms.test.ts`; QA in PR #30 |
| Arabic synonyms / dialect search ("دكتور" → clinics) | VERIFIED | `synonyms.ts` + tests; PR #30 QA |
| Nearby (location) | VERIFIED | `/api/public/businesses/nearby`, `geo.test.ts`; `docs/location.md` |
| Business profile page (services, staff, hours, map, reviews, JSON-LD) | VERIFIED | `src/features/company`, `jsonld.test.ts`; QA phase 19/20 |
| Booking: service → staff → day → time → details, guest checkout | VERIFIED (Phase 17 branch) | "Any available" double-booked staff (P17-01) and shared rooms were not held across staff (P17-04): fixed, with `create.db.test.ts` against Postgres and an end-to-end race. In production only once the Phase 17 PR and its migration are deployed |
| Restaurant table reservations (party size, table types) | INCOMPLETE | `Table`, `TableType`, `partySize` on `Booking`, `/dashboard/tables`. No dedicated unit tests for table assignment; not part of a recorded QA pass |
| Booking self-service by token link (view, cancel, reschedule, calendar file, review) | VERIFIED | `/api/public/booking/[token]/*`, `self-service.test.ts`; QA-C1 fixed |
| Online deposits / full payment (Paymob) | BLOCKED | Code and webhook tests exist; **no real card payment has ever succeeded** (`docs/payments-verification.md`) |
| Refunds through Paymob | BLOCKED | `refundTransaction()` never called against Paymob's API |
| Reviews (verified-booking only, votes, reports, moderation) | VERIFIED | `reviews.test.ts`, `review-policy.test.ts`; QA phase 19 |
| Customer accounts (upcoming, history, favorites, payments, reviews, notifications, profile, sessions, deletion) | INCOMPLETE | Email change now confirmed from the new address (P17-10 fixed, Phase 18). Deletion still leaves history reachable by the next holder of the number (P17-14) |
| Sign-in: password, WhatsApp OTP | INCOMPLETE | Password verified in QA. WhatsApp OTP depends on Meta Cloud API credentials (BLOCKED for live delivery) |
| Google sign-in | MISSING | No provider configured in `src/auth.ts` |
| Waitlist "notify me" with email confirmation | INCOMPLETE | PR #31. Confirmation verified locally; **sending the "it's listed now" email is not built** (`notifiedAt` is never set) |
| English at `/en/...`, hreflang, RTL/LTR | VERIFIED | `locale-routing.test.ts`, `i18n-support.test.ts`; PR #29 |
| FAQ, pricing, legal pages | VERIFIED | PR #30/#31 |
| PWA basics (manifest, icons) | VERIFIED | PR #27 |

## Business-facing (web dashboard)

| Feature | Status | Evidence / notes |
|---|---|---|
| Onboarding (type, details, services, hours) | VERIFIED | `/onboarding`; QA phase 19. Phase 21: progress saved on the server and resumed on any device (`/api/onboarding/draft`); business created private |
| Setup checklist, readiness gate, publish / unpublish | VERIFIED (Phase 21, locally) | `/dashboard/setup`, `lib/business/readiness.ts`, `POST /api/business/publish`; required items differ by business type; email confirmation completes a pending publish. `scripts/qa-phase21.mjs` |
| Owner preview and test bookings | VERIFIED (Phase 21, locally) | Owner-only preview of the private page; test bookings use the real engine, create no customer, send nothing, are not counted, and are deleted on publish |
| Booking and cancellation policies (notice, advance, buffer, same-day cut-off, cancellation window) | VERIFIED (Phase 21, locally) | `/dashboard/setup#policies`, `/api/business/settings/booking`; the cancellation window is per business (was a fixed 2 h) |
| Separate verification states (email, phone, ownership, venue) | VERIFIED (Phase 21, locally) | The Verified badge now means an administrator checked ownership with a written note; contact confirmation alone no longer awards it |
| CSV import of customers and services with preview, duplicates, errors and rollback | VERIFIED (Phase 21, locally) | `/dashboard/import`, `lib/import/*`; owner-only, tenant-scoped |
| Entitlements endpoint | VERIFIED (Phase 21, locally) | `GET /api/business/entitlements` from `lib/plans.ts`; analytics data and turning deposits on are now refused server-side on plans without them |
| Help centre | VERIFIED (Phase 21, locally) | `/help`, `/help/[slug]`, ar/en, built from the same constants as the rules it explains |
| Demo workspace | VERIFIED (Phase 21, locally) | `/demo`, fictional data in the browser only; a test fails if its code imports the database, the API or makes a request |
| Services, staff, staff hours, staff ↔ service | VERIFIED | `/dashboard/services`, `/dashboard/staff` |
| Staff access levels (MANAGER / PROVIDER) | VERIFIED | `business-access.test.ts` |
| Bookings list, today, upcoming, calendar, manual booking, status changes | VERIFIED (Phase 17 branch) | Today dropped bookings from 22:00 (P17-06, fixed). Status writes race (P17-16, open) |
| Realtime booking updates | VERIFIED | SSE with 3 s DB polling (`/api/realtime/bookings`) — fine at current scale, see performance notes |
| Customer management (CRM: list, profile, history, notes) | VERIFIED | `Customer` model, `/dashboard/customers` |
| Multi-branch | INCOMPLETE | `Branch` carries bookings, time blocks and resources. **Services, staff, opening hours and pricing are business-wide**; no per-branch manager role; no per-branch reporting |
| Resources (rooms, chairs, equipment) | VERIFIED | `/dashboard/resources`, add_resources migrations |
| Time blocks (closures, breaks, per-branch) | VERIFIED | `TimeBlock` + availability tests |
| Deposits policy | INCOMPLETE | Settings exist; live collection BLOCKED with payments |
| Discounts / offers | VERIFIED | `src/lib/discounts`, `/dashboard/offers` |
| Reports & analytics (bookings, revenue, customers, performance) | VERIFIED | `/dashboard/reports/*`, `src/lib/dashboard/reports.ts` |
| Referral / attribution links, QR code for the booking page | VERIFIED | `src/lib/attribution`, `/api/business/qr` |
| Subscriptions: FREE / PRO / PREMIUM, monthly & annual, soft cap, auto-confirm | INCOMPLETE | PR #31. Premium was sold with five unbuilt features (P17-02, fixed: Premium = multiple branches + unlimited team; a test now fails for any plan row no code checks). **Paid upgrade BLOCKED** with Paymob; no automatic renewal by design |
| Notifications (in-app, email, WhatsApp, push) | WORKING (locally verified) | Customer emails went to an address any anonymous booking could set (P17-03, fixed). Reminders fired on the wrong clock (P17-06, fixed). Sends are now an outbox with retries and a dead letter, re-driven every 10 minutes (P17-11, fixed in Phase 19; `docs/runbooks/PAYMENT_OPERATIONS.md` § 5). Live delivery not verified: `RESEND_API_KEY` and the WhatsApp variables are set in production, but no send was observed; push not verified on a device; SMS has no provider |

## Platform administration

| Feature | Status | Evidence / notes |
|---|---|---|
| Admin RBAC (MODERATOR / ADMIN / SUPER_ADMIN) | VERIFIED | `permissions.test.ts`; QA phase 19 |
| Business approval, suspension, verification | VERIFIED | `/admin/businesses`, `/admin/verification`. Phase 21: verifying requires an evidence note |
| Onboarding funnel | VERIFIED (Phase 21, locally) | `/admin/onboarding`, cohort of registrations by window, from `LifecycleEvent` |
| Review moderation | VERIFIED | `/admin/reviews` |
| Payments, refunds, diagnostics | INCOMPLETE | Screens exist; refunds BLOCKED as above |
| Audit log | VERIFIED | `AuditLog`, `/admin/audit` |
| Waitlist demand view | VERIFIED | `/admin/waitlist` (PR #31) |

## Mobile app (`mobile/`)

| Feature | Status | Evidence / notes |
|---|---|---|
| Customer app: discovery, nearby, profile, booking, account, favorites, notifications | INCOMPLETE | 199 unit tests pass; 19 Maestro flows exist. **Not published to either store.** Maestro on GitHub Actions: last success 2026-10-14 (`release/audit-fixes`); the latest run, on `main` 2026-10-17, **failed** and has not been investigated |
| Business app: today, calendar, customers, services, staff, reports | INCOMPLETE | Same as above |
| Push notifications | BLOCKED | "built and unit-tested; not yet verified on a physical device" (`docs/push-setup.md`) |
| Mobile payments | BLOCKED | Same Paymob dependency as web |
| Deep links / universal links | INCOMPLETE | `/.well-known/*` served; needs store builds to verify |

## Roadmap areas with nothing built yet

| Feature | Status | Notes |
|---|---|---|
| Malls and commercial destinations (venue with many businesses) | MISSING | No venue/mall model; a business belongs to one category and city |
| Enterprise multi-venue administration | MISSING | Admin is platform-wide; there is no organisation/tenant level above a business |
| Compound visitor authorization | MISSING | No visitor, host, pass or gate model |
| Authorized third-party QR / gate access (Eterna Mall, Emaar) | BLOCKED | Requires a written agreement and an API or integration spec from Emaar/the operator. Nothing may be built that simulates their approval |
| SMS channel | BLOCKED | Channel exists and reports `sms-not-configured`; no provider chosen |

## Known defects

The full, current list is `docs/audits/CRITICAL_FINDINGS.md` (Phase 17).
Open items with the most weight:

| ID | Defect | Severity |
|---|---|---|
| P17-11 | Notifications fire-and-forget, claimed SENT before sending, never re-driven | P1 — FIXED in Phase 19 |
| P17-12 | No Sentry DSN in production: errors are not reported | P1 (owner) |
| P17-13 | Terms say nothing about deposits, refunds, cancellation or subscriptions | P1 (owner) |
| P17-14 | Deleted accounts' history reachable through a recycled number | P1 |
| P17-15 | `add_audit_followups.sql` unconfirmed on production | P1 (owner) |
| P17-27 | Maestro failing on `main`; mobile tests and Playwright not in CI | P2 |
