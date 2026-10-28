# Phase 17 audit: production audit and remediation

Date: 2026-10-28. Code: `main` @ `77c8649` plus the Phase 17 branch.
Live site: https://www.maw3ed.net (serving `77c8649`, checked through
`/api/version`).

Findings with severity, evidence, reproduction and fix are in
`CRITICAL_FINDINGS.md`. This file is the inventory and the audit
narrative.

## How the audit was done

- Every route handler, the Prisma schema, migrations, auth, the booking
  engine, payments, notifications and the public copy were read.
  Three read-only review passes ran in parallel: authorization (all
  route handlers), data integrity (booking, money, notifications,
  deletion, performance), and public content (code plus the live site,
  fetched with GET only). **Every finding they returned was traced
  again in the code before it was classified.** One of them was a
  wrong expectation in my own test, not a defect (see Phase 17 report).
- On production: GET requests only (pages, public APIs, `robots.txt`,
  `sitemap.xml`, response headers, `/api/version`), and a listing of
  the Vercel production environment's variable **names** (no values).
  Nothing was written to production, and the production database was
  not accessed (owner-only access).
- Locally: a production build against the Docker QA database
  (`maw3ed-qa`), with test data removed afterwards.

## 1. Repository inventory (counted 2026-10-28, not copied)

| Item | Count | How counted |
|---|---|---|
| Pages (`page.tsx`) | 77 | `find src/app -name page.tsx` |
| Route handlers (`route.ts`) | 96, of which 93 under `src/app/api` | `find src/app -name route.ts` |
| HTTP method handlers | 124 | `export async function GET/POST/PATCH/PUT/DELETE` in route files |
| API route files by area | business 36, public 19, auth 12, account 10, admin 5, booking 2, cron 2, dev 1, mobile 1, onboarding 1, realtime 1, upload 1, version 1, webhooks 1 | |
| Layouts | 13 | |
| `loading.tsx` / `error.tsx` / `not-found.tsx` | 2 / 1 / 1 (no `global-error.tsx`) | |
| `.tsx` files in `src` | 252 | |
| Prisma models / enums | 41 / 23 | `prisma/schema.prisma` |
| Relations / indexes + uniques | 56 / 94 | `@relation`, `@@index`/`@@unique` |
| SQL migrations | 28 at baseline, 29 with `phase17_booking_integrity.sql` | `prisma/migrations/*.sql` |
| Data-fix scripts | 1 | `prisma/data-fixes/` |
| Web test files | 80 at baseline, 82 now | `*.test.ts(x)` in `src` |
| Mobile screens / test files / Maestro flows | 45 / 18 / 19 | `mobile/app`, `mobile/**/*.test.*`, `mobile/.maestro/*.yaml` |
| Dependencies (web) | 20 runtime, 22 dev | `package.json` |

**Versions (installed):** Next 16.4.3, React 19.2.4, TypeScript 5.9.3,
next-auth 5.0.0-beta.32, Prisma 7.10.1, zod 4.6.7, Sentry (Next) 11.4.0,
Vitest 5.0.5, ESLint 9.39.4, Playwright 1.63.0, Tailwind 4.2.2, Node
22.16 locally and 22 in CI. Mobile: Expo ~57.0.29, React Native 0.86.3,
expo-router ~57.0.27, Sentry RN ~7.11.0, TanStack Query ^5.104.

Architecture, data model and flows: `docs/architecture/ARCHITECTURE_OVERVIEW.md`.

### Areas

| Area | Where | State |
|---|---|---|
| Auth & accounts | `src/auth.ts` (credentials: password, WhatsApp OTP), `src/lib/auth/*` (mobile tokens, rotating refresh), `/api/auth/*` | Working. Email change is unverified (P17-10) |
| Permissions | `src/lib/admin/permissions.ts` (MODERATOR / ADMIN / SUPER_ADMIN), `src/lib/business-access.ts` (owner / MANAGER / PROVIDER) | Enforced server-side on every route read |
| Business profiles, staff, services, schedules | `/api/business/*`, `src/lib/scheduling`, `src/lib/bookings/availability.ts` | Working; "any available" was defective (P17-01, fixed) |
| Bookings & states | `src/lib/bookings/*`; states PENDING_PAYMENT → PENDING → CONFIRMED → ARRIVED → IN_PROGRESS → COMPLETED, plus CANCELLED, NO_SHOW, FAILED_PAYMENT | Working; races in status writes (P17-16) |
| Payments, refunds, plans, ledger | `src/lib/payments/*`, `src/lib/services/paymob.ts`, `/api/webhooks/paymob`, `src/lib/plans.ts` | Code sound on review; **no real payment has ever succeeded** (external). Premium sold unbuilt features (P17-02, fixed) |
| Notifications, WhatsApp, email, cron | `src/lib/notifications/*`, Resend, Meta Cloud API, Expo push; `vercel.json` crons | Working; time-frame bug (P17-06, fixed); fire-and-forget sends (P17-11) |
| Reviews & verification | `src/lib/reviews.ts`, `review-policy.ts`, `src/lib/verification.ts` | Ratings from real reviews only; badge copy overstated (P17-09, fixed) |
| Admin | `/admin/*`, `/api/admin/*` | Working |
| Mobile foundation | `mobile/` (Expo), bearer auth on the same API | Not in stores; Maestro last run failed |
| CI/CD | GitHub Actions `ci.yml` (typecheck, lint, tests, build), Vercel auto-deploy from `main`, Maestro workflow | CI repaired in the baseline PR |
| Hosting | Vercel (functions + 2 crons), Neon Postgres, Cloudinary images | |
| Backups | Neon provider-side | **NOT VERIFIED**: no backup or restore procedure in the repository; Neon's retention for this project is not visible from here |
| Monitoring | Sentry configured in code; structured logger | **Production has no `SENTRY_DSN`** in its Vercel environment (P17-12): errors are not reported anywhere but Vercel logs |
| Venue, QR, access | `/api/business/qr` (a QR code of the public booking link) | No venue, mall, compound, visitor or gate functionality exists |

## 2. Public website audit

Checked on the live site and in code. Results:

| Topic | Result |
|---|---|
| Homepage numbers | Computed from the database and hidden below 50 (`SHOW_COUNTS_FROM`); none shown live. **OK** |
| Testimonials, quotes, logos, star ratings | None in code or live. **OK** |
| Ratings | From Review rows only; `aggregateRating` emitted only when a business has reviews (none live). Reported reviews (UNDER_REVIEW) still count, by design (P17-24) |
| "Verified businesses" claim | Hero chip and trust section said "أنشطة متحقّق منها" while **0** listings are verified (`/businesses?verified=1` → 0). **Fixed** (P17-09) |
| "Booking is completely free" / "Instant confirmation" | Contradicted deposits and businesses that confirm by hand (the default). **Fixed** (P17-09) |
| Pricing page | Premium ticked five features nothing implements. **Fixed** (P17-02). Pro's "Most popular" badge is unbacked (P17-20) |
| Prices on listings | Price 0 shows "price not set"; JSON-LD published `"priceRange":"0 EGP"`. **Fixed** (P17-08) |
| Category accuracy | BerryGum (web design) under Education; a Maadi business under Cairo (P17-21; `prisma/data-fixes/2026-10-27-listing-cleanup.sql`) |
| Arabic/English | `/en` company pages show the Arabic city; `/en/businesses` loading text is Arabic (P17-23) |
| Cancellation / reschedule policy | 2-hour cutoff consistent across FAQ, booking page, emails and `self-service.ts`. **OK** |
| Terms | No money, refund, deposit, cancellation or subscription terms (P17-13) |
| Privacy | Names every processor actually used; no analytics or tracking script, so no consent banner needed. Open VERIFY notes on legal entity, retention and minimum age |
| Contact | Canadian address and phone vs "made in Cairo"; promises WhatsApp it does not show (P17-22) |
| Links | 75 internal links on 16 pages and all 50 sitemap URLs return 200; unknown slugs 404. **OK** |
| SEO | Unique titles and descriptions, self-canonical, ar/en/x-default hreflang, filtered pages noindex, private areas disallowed. Sitemap `lastmod` is the request time (P3) |

## 3. Architecture audit

| Topic | Finding |
|---|---|
| Multi-tenant isolation | Every id-taking business route loads with `businessId` from the session. **No cross-tenant read or write found.** Gaps: the public booking route accepted another tenant's staff, resource and branch ids (P17-05, fixed); staff creation accepts foreign service ids (P3) |
| Authorization | Server-side in every handler; admin role read from the database; staff access re-read per request. Unverified email change enables pre-registration account takeover (P17-10, open) |
| Booking concurrency | Exclusion constraint plus Serializable transaction. Defects: "anyone" bookings did not collide with named ones (P17-01), shared resources across staff (P17-04), serialization failures reported as taken (P17-07). All fixed, with new DB constraints in the migration |
| Transaction boundaries | Booking insert, discount claim and limit count share one transaction. Status changes and reschedules write unconditionally after a separate read (P17-16) |
| Idempotency | Booking key checked before and after conflicts; webhook events de-duplicated by transaction id; refund reservation atomic. Key lookup is not scoped to the business (P3) |
| Webhook verification | HMAC checked before any read; fails closed without a secret; amount and currency matched to the stored payment. **Sound** |
| Retry behaviour | Webhook claim/release/retry sound. Notifications: claim stored as SENT before sending, sent fire-and-forget, never re-driven (P17-11) |
| Notification failure recovery | Ledger records FAILED; re-sent only if the same event fires again (P17-11) |
| Data deletion and retention | Account deletion keeps bookings, the Customer row and reviews unchanged; account history follows the phone number, so a recycled number sees the old history (P17-14). Retention periods unset (privacy VERIFY notes) |
| Error logging and monitoring | Logger redacts personal data. Sentry not active in production (P17-12) |
| Database performance | Discovery, profile and slots are batched, with no N+1. Missing: `Booking(status, startsAt)` for the hourly cron and `Booking(businessId, createdAt)` for the monthly count (P3) |
| API response times | Production, uncached, from this machine, median TTFB of 3: home 0.17 s, `/en` 0.12 s, `/businesses` 0.13 s, search 0.14 s, business page 0.21 s, `/api/public/businesses` 0.07 s, profile API 0.08 s, slots API 0.14–0.20 s, sitemap 0.06 s |
| Sensitive data exposure | Public booking view hides phone and internal ids; mobile login phone visible only to owners. Customer emails could be redirected (P17-03, fixed); PROVIDER staff see the owner's private customer notes in the list view (P17-18) |
| Security headers | Per-request CSP nonce with `strict-dynamic`, HSTS (2 years, subdomains), X-Frame-Options SAMEORIGIN, strict referrer policy, restrictive Permissions-Policy. **OK** |
| Secrets | Vercel shows several secrets (`PAYMOB_HMAC_SECRET`, `PAYMOB_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`) as type "Config" (plain) rather than "Secret"/sensitive, and Paymob production keys are also given to Development and Preview (P17-25) |

## External systems not tested

| System | Why | Status |
|---|---|---|
| Paymob (real card, refund) | Costs real money; owner's runbook in `docs/payments-verification.md` | BLOCKED |
| Resend (production email delivery) | Would send to real people | NOT RUN |
| Meta WhatsApp Cloud API | Same | NOT RUN |
| Expo push on a device | No device | BLOCKED |
| Neon backups / restore | Provider console, owner access | NOT VERIFIED |
| Production database (migration state) | Owner-only access | NOT VERIFIED |
| Emaar / Eterna Mall | No agreement or specification | BLOCKED (nothing built) |
| Staging | None exists | NOT RUN |
