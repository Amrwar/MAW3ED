# Architecture overview

Baseline as of `main` @ `77c8649` (2026-10-28). Describes what is in the
repository, not what is planned. Planned work lives in
`docs/roadmap/MASTER_ROADMAP.md`.

## Systems

| System | Where | Runtime |
|---|---|---|
| Web app + API | repository root (`src/`) | Next.js 16.4.3 (App Router, Turbopack), React 19.2, TypeScript strict, on Vercel |
| Mobile app | `mobile/` | Expo SDK 57, React Native 0.86, expo-router; talks only to the web app's HTTP API |
| Database | `prisma/schema.prisma` | PostgreSQL (Neon in production), Prisma 7.10 |
| Scheduled jobs | `vercel.json` | Vercel Cron: `/api/cron/reminders` hourly, `/api/cron/subscriptions` daily 05:00 UTC |

There is one backend. The mobile app has no server of its own; it uses
the same route handlers as the web, authenticated with bearer tokens
instead of cookies (`docs/mobile.md`).

## Repository layout (web)

```
src/
  app/            routes: pages and API route handlers (route.ts)
    api/public/   unauthenticated endpoints (discovery, slots, booking, waitlist)
    api/business/ business owner / staff endpoints
    api/account/  signed-in customer endpoints
    api/admin/    platform admin endpoints
    api/auth/     sign-up, sign-in (web + mobile), OTP, password reset
    api/cron/     scheduled jobs (CRON_SECRET-guarded)
    api/webhooks/ Paymob
  features/       page-level UI for home, company profile, dashboard
  components/     shared UI, layout, dashboard chrome
  lib/            domain logic; most unit tests live beside it
  proxy.ts        auth gate, language routing (/en rewrite), per-request CSP nonce
  auth.ts         NextAuth v5 (credentials providers, JWT sessions)
prisma/
  schema.prisma   data model
  migrations/     hand-written idempotent SQL, applied manually (see below)
  data-fixes/     one-off production data scripts, run by hand in a transaction
  seed.ts         categories, cities, demo data
scripts/          Playwright QA scripts and fixtures (run by hand, not in CI)
mobile/           Expo app (own package.json, tests and Maestro flows)
docs/             runbooks and verification records
```

## Domain model (summary)

Models in `prisma/schema.prisma` (1,458 lines):

- **Accounts:** `User` (customers, business owners, admins via
  `adminRole`), NextAuth `Account`/`Session`/`VerificationToken`,
  `LoginCode` (WhatsApp OTP), `EmailVerificationToken`,
  `PhoneVerification`, `PasswordResetToken`, `MobileSession` (rotating
  refresh tokens), `DeviceToken` (push).
- **Businesses:** `Business` (type `GENERAL | RESTAURANT | BARBERSHOP`,
  status `PENDING | APPROVED | REJECTED | SUSPENDED`, plan
  `FREE | PRO | PREMIUM`), `Branch`, `BusinessImage`, `Category`, `City`,
  `Neighborhood`.
- **Scheduling:** `Service`, `AvailabilityRule`, `TimeBlock`,
  `StaffMember` (access `MANAGER | PROVIDER`), `StaffHours`,
  `StaffService`, `Resource` (`TABLE | ROOM | CHAIR | EQUIPMENT | OTHER`),
  `Table` (restaurants).
- **Bookings:** `Booking` (status `PENDING_PAYMENT → PENDING → CONFIRMED
  → ARRIVED → IN_PROGRESS → COMPLETED`, plus `CANCELLED`, `NO_SHOW`,
  `FAILED_PAYMENT`), `Customer` (per-business CRM record).
- **Money:** `Payment` (kinds deposit / balance / full / subscription;
  providers `PAYMOB | MANUAL`), `Refund`, `WebhookEvent`, `Discount`,
  `DiscountRedemption`.
- **Trust & engagement:** `Review`, `ReviewVote`, `ReviewReport`,
  `Favorite`, `ProfileView` (traffic source attribution),
  `WaitlistRequest`.
- **Operations:** `Notification`, `NotificationDelivery` (per-channel
  ledger), `AuditLog`, `RateLimit` (DB-backed limiter).
- **Onboarding (Phase 21):** `OnboardingDraft` (one per account),
  `ImportBatch` (what a CSV import created, for rollback),
  `LifecycleEvent` (one row per account and milestone, for the funnel).
  `Booking.isTest` marks an owner's test booking on a private page.
- **Organizations (Phase 22b):** `Organization` (the `VenueOrganization`
  table, renamed in Prisma), `OrganizationBusiness`, `OrganizationInvite`,
  `OrganizationView`, `OrganizationBookingAttribution`; registration is
  self-serve behind platform review, associations are approved on both
  sides, and booking attribution is a statistic that never touches the
  booking itself — `docs/architecture/ORGANIZATION_PLATFORM.md`.
- **Destinations (Phase 22):** `VenueOrganization`, `Compound`, `Venue`,
  `VenueZone`, `VenueGate`, `VenueHours`, `VenuePolicy`, `VenueException`,
  `VenueMembership`, `VenueRole`; `City.countryCode`. Model, hierarchy and
  permission matrix: `docs/architecture/VENUES.md`.

## Key flows and where they live

| Flow | Code |
|---|---|
| Slot computation | `src/lib/bookings/availability.ts`, `schedule.ts`, `overlap.ts` |
| Booking creation (transactional, idempotent, plan allowance) | `src/lib/bookings/create.ts` |
| Status transitions | `src/lib/booking-transitions.test.ts`, `src/lib/bookings/progress-guard.ts` |
| Customer self-service (token links: view, cancel, reschedule, pay, review) | `src/app/api/public/booking/[token]/*`, `src/lib/bookings/self-service.ts` |
| Time zone | Wall-clock times are stored per business; conversion to instants uses the `Africa/Cairo` IANA zone (`src/lib/bookings/instants.ts`) — no fixed offsets |
| Discovery / search | `src/lib/discovery/*` (search, synonyms, nearby, hours, next-free) |
| Payments | `src/lib/payments/ledger.ts`, `src/lib/services/paymob.ts`, `src/app/api/webhooks/paymob`; amounts in piastres; see `docs/payments-verification.md` |
| Subscriptions | `src/lib/plans.ts`, `src/lib/payments/subscription.ts`, `/api/cron/subscriptions` (no automatic card renewal) |
| Notifications | `src/lib/notifications/*`: event → recipients → channels (IN_APP, EMAIL via Resend, WHATSAPP via Meta Cloud API, SMS dormant, PUSH via Expo) with a delivery ledger |
| Realtime dashboard | `/api/realtime/bookings` — SSE backed by 3-second DB polling |
| Admin RBAC | `src/lib/admin/permissions.ts`, `guard.ts`; roles `MODERATOR < ADMIN < SUPER_ADMIN`; `AuditLog` |
| Business access (owner vs staff) | `src/lib/business-access.ts` |
| i18n | `src/lib/i18n.ts` (Arabic default, English at `/en/...`), `src/lib/locale-routing.ts` |
| Rate limiting | `src/lib/rate-limit.ts` (Postgres-backed, per bucket) |
| Readiness and publishing (Phase 21) | `src/lib/business/readiness.ts` (pure checklist), `readiness-load.ts`, `publish.ts`; `/api/business/readiness`, `/api/business/publish`; `/dashboard/setup` |
| Owner preview and test bookings (Phase 21) | `src/lib/business/preview.ts`; the public page, slots, quote and bookings routes allow the owner of an unpublished business; `isTest` bookings are excluded from counts, KPIs, reports, reminders and notifications, and deleted on publish |
| Entitlements (Phase 21) | `src/lib/plans.ts` (the matrix), `src/lib/business/entitlements.ts`, `GET /api/business/entitlements` |
| CSV import (Phase 21) | `src/lib/import/csv.ts` (pure parse/validate/duplicates), `run.ts` (transactional commit and rollback), `/api/business/import/**`, `/dashboard/import` |
| Demo workspace (Phase 21) | `src/lib/demo/workspace.ts`, `/demo` — browser-only fixtures on the real availability engine |
| Help centre (Phase 21) | `src/lib/help/articles.ts`, `/help`, `/help/[slug]` |
| Destinations and venues (Phase 22) | `src/lib/venues/*` (access matrix, guard, memberships, metrics, public loader, rules, SEO); `/api/venues/**` (console), `/api/admin/{venue-organizations,compounds,venues,venue-roles}`, `/api/business/venues/**`, `/api/public/venues/**`; pages `/venues`, `/venues/[slug]`, `/venue-admin`, `/admin/venues`, `/dashboard/venue` — `docs/architecture/VENUES.md` |
| Organization platform (Phase 22b) | `src/lib/organizations/*` (access, guard, rules, associations, public loader, SEO, route helpers); `/api/organizations/**` (console), `/api/business/organizations/**`, `/api/public/groups/**`, `/api/public/org-invites/[token]`, `/api/admin/organizations/[id]`; pages `/groups`, `/groups/[slug]`, `/org-admin`, `/org-admin/[id]`, `/dashboard/organizations` — `docs/architecture/ORGANIZATION_PLATFORM.md` |
| Onboarding funnel (Phase 21) | `src/lib/business/lifecycle.ts` (recording), `src/lib/admin/funnel.ts`, `/admin/onboarding` |

## Booking state machine and concurrency (Phase 19)

- `src/lib/bookings/transitions.ts` is the one table of what may follow
  what, for the business, the customer and the system. The dashboard's
  buttons import it; the API checks it.
- `src/lib/bookings/state.ts` makes a move: `UPDATE … WHERE id AND status
  = <from>`, so of two moves racing exactly one applies (the other gets
  409 `changed`). A cancellation or a released hold also closes open payment pages,
  hands a redeemed discount back and flags money already paid for a
  person to refund (completing a booking does none of that).
- Slots: `loadAvailability` is called to offer times and again to accept
  one. "Anyone" is given a free member of staff; "any table" the smallest
  free one that seats the party; a named table must seat it. Under a
  race the three exclusion constraints decide, and an auto-assigned
  member or table is re-derived before the time is called taken.
- Idempotency: a client key on the booking row; a retry returns the
  original. Payments: `WebhookEvent (provider, eventId)` claims a
  delivery; `settlePayment` moves a payment out of PENDING once; refunds
  reserve their amount with a conditional UPDATE before Paymob is asked.
- Time: wall-clock strings and a `startsAt` frame written as UTC; every
  real-instant conversion asks Intl for the zone's offset at that moment
  (`src/lib/bookings/instants.ts`). Hours may cross midnight ("25:00").

## Notification outbox (Phase 19)

`NotificationDelivery` is claimed PENDING with the event stored on the
row, moved to SENT/SKIPPED/FAILED when the provider answers, retried
with backoff (2 m, 10 m, 30 m, 2 h) and marked DEAD after five attempts,
a permanent refusal or when the message went stale. Routes schedule
sends with `after()`; `/api/cron/notifications` (every 10 minutes) hands
due rows back to the dispatcher, whose claim logic re-sends only those.
Runbooks: `docs/runbooks/BOOKING_OPERATIONS.md`,
`docs/runbooks/PAYMENT_OPERATIONS.md`.

## Security boundaries

- **Authentication:** NextAuth v5 with JWT sessions for the web; mobile
  uses short-lived access tokens plus rotating refresh tokens
  (`MobileSession`). Sign-in by password or WhatsApp OTP.
- **Authorization:** enforced server-side in each route handler
  (`requireBusiness`, admin `guard`, token ownership for self-service
  links). `src/lib/api-bearer-coverage.test.ts` checks that routes the
  app calls accept bearer auth.
- **Tenant isolation:** business routes resolve the business from the
  session, never from the request body; covered by
  `business-access.test.ts` and the cross-tenant checks in
  `scripts/qa-security.mjs` (manual).
- **Headers:** per-request CSP nonce with `strict-dynamic` (`proxy.ts`,
  `src/lib/security/csp.ts`).
- **Secrets:** `src/lib/env.ts` validates environment;
  `env-coverage.test.ts` checks every variable read is declared.
  One-time links store only hashes (`hashSecret`).
- **Observability:** Sentry (`sentry.*.config.ts`, `instrumentation*.ts`),
  structured logger with redaction (`src/lib/logger.ts`).

### Phase 20 additions

- Web sessions are revocable (`User.sessionsRevokedAt`; re-checked every 5 minutes in the JWT callback, `src/lib/security/session-policy.ts`).
- The proxy refuses state-changing API calls that carry the session cookie from another origin (`src/lib/security/origin.ts`).
- Uploads must match their declared type by magic bytes and land in a listed folder (`src/lib/security/image-sniff.ts`).
- Account deletion releases the phone number as a keyed hash (`PhoneRelease`); a later account on it is fenced by `historySince` (`lib/account/queries.ts` `ownedWhere`).
- `GET /api/account/export`; audit entries for deletion, password reset, mass sign-out.
- Threat model, security report and runbook: `docs/security/`, `docs/runbooks/SECURITY_OPERATIONS.md`; legal drafts: `docs/legal/`.

## Database migrations

Migrations are **not** run by the build (`npm run build` is
`prisma generate && next build`). Each file in `prisma/migrations/` is
hand-written, idempotent SQL that the owner applies to production
before deploying the code that needs it. There is no migration history
table; which files production has received is tracked in PR
descriptions and `docs/roadmap/PHASE_STATUS.md`.

This is the main operational risk in the current setup: a merge to
`main` deploys immediately, whether or not its migration has been run.

## Environments

| Environment | Database | How |
|---|---|---|
| Production | Neon | Vercel, auto-deploy from `main` |
| Preview | as configured in Vercel | Vercel preview per PR |
| Local QA | Docker Postgres (`maw3ed-qa`, port 5450) | `.env.development.local`; `src/lib/db.ts` picks the `pg` adapter for non-Neon hosts |

There is no dedicated staging database recorded in the repository.
