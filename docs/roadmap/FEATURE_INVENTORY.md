# Feature inventory

Baseline: `main` @ `77c8649`, 2026-10-28. Update this file whenever a
phase changes a feature's status.

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
| Booking: service → staff → day → time → details, guest checkout | VERIFIED | `BookingWidget.tsx`, `create.ts`, `availability.test.ts`; QA phase 19, PR #30 |
| Restaurant table reservations (party size, table types) | INCOMPLETE | `Table`, `TableType`, `partySize` on `Booking`, `/dashboard/tables`. No dedicated unit tests for table assignment; not part of a recorded QA pass |
| Booking self-service by token link (view, cancel, reschedule, calendar file, review) | VERIFIED | `/api/public/booking/[token]/*`, `self-service.test.ts`; QA-C1 fixed |
| Online deposits / full payment (Paymob) | BLOCKED | Code and webhook tests exist; **no real card payment has ever succeeded** (`docs/payments-verification.md`) |
| Refunds through Paymob | BLOCKED | `refundTransaction()` never called against Paymob's API |
| Reviews (verified-booking only, votes, reports, moderation) | VERIFIED | `reviews.test.ts`, `review-policy.test.ts`; QA phase 19 |
| Customer accounts (upcoming, history, favorites, payments, reviews, notifications, profile, sessions, deletion) | VERIFIED | `/account/*`, `/api/account/*`; QA phase 19 |
| Sign-in: password, WhatsApp OTP | INCOMPLETE | Password verified in QA. WhatsApp OTP depends on Meta Cloud API credentials (BLOCKED for live delivery) |
| Google sign-in | MISSING | No provider configured in `src/auth.ts` |
| Waitlist "notify me" with email confirmation | INCOMPLETE | PR #31. Confirmation verified locally; **sending the "it's listed now" email is not built** (`notifiedAt` is never set) |
| English at `/en/...`, hreflang, RTL/LTR | VERIFIED | `locale-routing.test.ts`, `i18n-support.test.ts`; PR #29 |
| FAQ, pricing, legal pages | VERIFIED | PR #30/#31 |
| PWA basics (manifest, icons) | VERIFIED | PR #27 |

## Business-facing (web dashboard)

| Feature | Status | Evidence / notes |
|---|---|---|
| Onboarding (type, details, services, hours) | VERIFIED | `/onboarding`; QA phase 19 |
| Services, staff, staff hours, staff ↔ service | VERIFIED | `/dashboard/services`, `/dashboard/staff` |
| Staff access levels (MANAGER / PROVIDER) | VERIFIED | `business-access.test.ts` |
| Bookings list, today, upcoming, calendar, manual booking, status changes | VERIFIED | `booking-transitions.test.ts`, `calendar.test.ts`; QA-M3 fixed |
| Realtime booking updates | VERIFIED | SSE with 3 s DB polling (`/api/realtime/bookings`) — fine at current scale, see performance notes |
| Customer management (CRM: list, profile, history, notes) | VERIFIED | `Customer` model, `/dashboard/customers` |
| Multi-branch | INCOMPLETE | `Branch` carries bookings, time blocks and resources. **Services, staff, opening hours and pricing are business-wide**; no per-branch manager role; no per-branch reporting |
| Resources (rooms, chairs, equipment) | VERIFIED | `/dashboard/resources`, add_resources migrations |
| Time blocks (closures, breaks, per-branch) | VERIFIED | `TimeBlock` + availability tests |
| Deposits policy | INCOMPLETE | Settings exist; live collection BLOCKED with payments |
| Discounts / offers | VERIFIED | `src/lib/discounts`, `/dashboard/offers` |
| Reports & analytics (bookings, revenue, customers, performance) | VERIFIED | `/dashboard/reports/*`, `src/lib/dashboard/reports.ts` |
| Referral / attribution links, QR code for the booking page | VERIFIED | `src/lib/attribution`, `/api/business/qr` |
| Subscriptions: FREE / PRO / PREMIUM, monthly & annual, soft cap, auto-confirm | INCOMPLETE | PR #31. Plan logic tested; **paid upgrade BLOCKED** with Paymob; no automatic renewal by design |
| Notifications to owners (in-app, email, WhatsApp, push) | BLOCKED | Pipeline + ledger tested. Email needs `RESEND_API_KEY`; WhatsApp needs Meta credentials; push not verified on a device (`docs/push-setup.md`); SMS has no provider |

## Platform administration

| Feature | Status | Evidence / notes |
|---|---|---|
| Admin RBAC (MODERATOR / ADMIN / SUPER_ADMIN) | VERIFIED | `permissions.test.ts`; QA phase 19 |
| Business approval, suspension, verification | VERIFIED | `/admin/businesses`, `/admin/verification` |
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

## Known defects at baseline

| Defect | Severity | Notes |
|---|---|---|
| CI "suite not empty" check counted 0 tests since Vitest 5 (PR #28), so CI failed on `main` for #28–#31 and the CI **Build** step did not run | HIGH (process) | Fixed in the baseline PR (`.github/workflows/ci.yml`). Vercel's own build succeeded for `77c8649` |
| Production may not have `add_audit_followups.sql` applied while #31 is live | CRITICAL if unapplied | Owner action; cannot be checked from here (production DB access is owner-only) |
| `axe-core` is a dev dependency but nothing runs it | LOW | No automated accessibility check exists |
| 6 lint warnings (`<img>` elements, an unused variable in a QA script, a React Compiler skip) | LOW | Non-blocking |
| Mobile tests and web Playwright QA scripts are not run in CI | MEDIUM | Only the web unit suite gates merges |
