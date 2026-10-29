# Threat model

Phase 20, 2026-10-29. What is worth protecting, where the trust
boundaries are, who realistically attacks what, and what stands in the
way today. "Mitigation" names code or configuration that exists;
"gap" names what does not, with its entry in `SECURITY_REPORT.md`.

## Assets

| Asset | Where it lives | Why it matters |
|---|---|---|
| Customer accounts | `User` rows keyed by a verified phone (OTP) or an email+password; web JWT cookie; mobile access+refresh tokens; `MobileSession` rows | Owning one means reading that person's bookings, payments and reviews, and booking in their name |
| Business accounts | `User` with `Business.ownerId`; staff via `StaffMember.userId` with `access` MANAGER/PROVIDER | Owning one means the whole customer book of that business, its money, and the ability to cancel real appointments |
| Staff accounts | A customer-style phone account linked to a `StaffMember` by the owner's `loginPhone` | A provider sees their own bookings; a manager the whole business |
| Super-admin and admin accounts | `User.adminRole` | Refunds, suspensions, role grants: the keys to everything |
| Customer contact details | `Booking.customerPhone/E164/customerEmail`, `Customer` (the business's CRM copy), `User.phone/email` | Direct marketing abuse, harassment, SIM-swap targeting |
| Booking history | `Booking` by business, keyed to customers by phone | Reveals where a person goes and when; for clinics, that they attend at all |
| Clinic-related information | Business type and service names only; `Booking.notes` free text; `Customer.notes` (owner's private notes) | Free text can carry health details nobody structured; treated as sensitive by default |
| Payment and subscription records | `Payment`, `Refund`, `WebhookEvent`; Paymob holds card data, we hold none | Financial integrity; a forged settlement confirms a booking for free; a double refund loses money |
| Notification providers | Resend, Meta WhatsApp Cloud API, Expo push; the `NotificationDelivery` ledger | A leaked token sends messages from our name; the ledger holds addresses |
| Internal APIs | `/api/business/*`, `/api/admin/*`, `/api/account/*`, `/api/cron/*`, `/api/webhooks/*` | The whole attack surface for authorisation bugs |
| Future Eterna visitor credentials | Not built. Any gate pass or visitor identity will be a credential issued to a customer and presented at a venue | Designed now so it is not bolted on: see "Eterna" below |
| Third-party integration secrets | `AUTH_SECRET`, `DATABASE_URL`, `PAYMOB_*`, `WHATSAPP_ACCESS_TOKEN`, `RESEND_API_KEY`, `CLOUDINARY_*`, `CRON_SECRET`, `EXPO_ACCESS_TOKEN` in Vercel | Each one is a different way to impersonate the platform |

## Trust boundaries

1. **Browser → Vercel** (TLS, HSTS). The browser is untrusted: every
   value it sends is validated (zod), every price is re-derived, every
   slot re-computed, roles and tenant come from the database never
   from the request (`src/lib/api.ts`, `business-access.ts`,
   `admin/guard.ts`).
2. **Native app → API** (bearer tokens). Same routes, same guards; the
   token's claims are re-read from the database on refresh and the admin
   role on every request.
3. **Paymob → webhook** (HMAC-SHA512 over Paymob's field list, constant
   time; claim table per transaction id). Nothing a browser says about a
   payment is believed.
4. **Vercel cron → `/api/cron/*`** (`CRON_SECRET` bearer; refuses to run
   when unset).
5. **App → providers** (outbound HTTPS to fixed hosts; no user-supplied
   URLs are fetched anywhere — checked, Phase 20).
6. **App → database** (Neon over TLS; Prisma parameterised queries; raw
   SQL only through tagged templates).
7. **Operators → production** (Vercel and Neon consoles, GitHub). No
   service account has production database access from a developer
   machine; migrations are applied by the owner by hand.

## Threats and what stands in the way

### Authentication

| Threat | Mitigation | Gap |
|---|---|---|
| Password guessing | bcrypt(12); 8 tries / 15 min per email, not per IP (`rateLimit("login", email)`); identical answer for wrong email and wrong password | No password-strength check beyond 8 characters (S-11) |
| OTP guessing | 6 digits from `crypto.randomInt`; 10-minute life; 5 attempts counted in one conditional UPDATE (parallel guesses cannot exceed it); the code is burned after; one live code per number; 5 sends/hour/number with a 60 s cooldown; per-address and per-number buckets on verification | — |
| OTP interception (WhatsApp) | Out of our control; the code is short-lived and single use | Meta template delivery is the owner's configuration |
| SIM swap / recycled number | Phone proves the number, not the person. A recycled number reaches the **previous holder's account** if it still exists, and their history | Phase 20 fences history after an account *deletion* (`PhoneRelease`); a dormant, undeleted account is still reachable by the number's new holder (S-02) |
| Session theft (web) | httpOnly, Secure, SameSite=Lax cookie; 30-day life; re-checked against the account every 5 minutes; **revocable** since Phase 20 (`sessionsRevokedAt`: password reset, "sign out everywhere") | A stolen cookie works for up to 5 minutes after revocation |
| Session theft (mobile) | 15-minute access token; refresh token rotated on every use, reuse revokes the whole session; sessions listed and revocable per device | — |
| Password reset link theft | 32 random bytes, stored hashed, single use, expiring; same answer whether the email exists; every session ended on reset | — |
| Admin account compromise | Role read from the database per request; 404 not 403; refunds need `payments.refund` (super admin only); audit log | **No second factor for administrators** (S-01) |

### Authorisation

| Threat | Mitigation | Gap |
|---|---|---|
| Cross-tenant read or write (IDOR) | Every business route resolves the business from the signed-in account, never from a parameter; every lookup is `findFirst({ id, businessId })` then acts by id; providers additionally scoped by `staffMemberId` (`bookingScope`); verified on Postgres (Phase 19) and over HTTP (`qa-security.mjs`) | — |
| Staff over-reach | Action table per role (`BusinessAction`); managers cannot grant access; providers cannot cancel or read the customer book; private notes gated on `customers.read` | — |
| Customer reading another customer | Account routes match bookings by the verified phone only; the booking link is a 256-bit token; the app exchanges a booking id for the token only when the id's phone is the caller's | — |
| Client-supplied role or tenant | Tokens carry `businessId`/`adminRole` for navigation only; guards re-read; `requireBusiness` checks `ownerId` | — |
| Plan entitlement bypass | `canUseFeature`/`getEffectivePlan` on the server for deposits, WhatsApp, staff and branch counts; a source scan test keeps the plan matrix honest | — |
| Multi-branch | Resources and blocks scoped by `branchId`; a booking's branch must belong to the business | Staff are not branch-scoped (not a requirement today) |

### Data protection

| Threat | Mitigation | Gap |
|---|---|---|
| PII in logs | `lib/logger` redacts phones, emails, names and secrets before any sink, including the message string | Vercel's own access logs record URLs |
| PII in the rate limiter | Only HMAC(key) with the signing secret is stored | — |
| Deleted account still reachable | Deletion removes the account, its sessions, devices, codes, favourites, feed; scrubs the delivery ledger's addresses; releases the number so a later account starts afresh; audited | Bookings and payments stay with the businesses by design (retention: `docs/legal/DATA_RETENTION_POLICY.md`) |
| Private files exposed | No file is stored by the app; images go to Cloudinary under a fixed folder list after a magic-byte check; the URL is public by design (listing photos) | A review photo is public once uploaded (expected); no private documents exist |
| Database exposure | Neon: TLS in transit, encryption at rest (provider), credentials only in Vercel; no developer tooling connects to production | Backup retention depends on the Neon plan (S-06) |
| Data export | `GET /api/account/export` (Phase 20) | Business-side export is the dashboard's CSV/screens; no one-call export yet |

### Application security

| Threat | Mitigation | Gap |
|---|---|---|
| XSS | React escaping; JSON-LD escaped (`seo/jsonld-script`); nonce CSP with `strict-dynamic`, no `unsafe-eval` in production, `object-src 'none'`, `base-uri 'self'` | `style-src 'unsafe-inline'` (inline styles) |
| CSRF | SameSite=Lax session cookie; NextAuth's own CSRF token for its routes; **Origin check on every state-changing API call carrying the cookie** (Phase 20, proxy) | — |
| Injection | Prisma; raw SQL only as tagged templates (`$queryRaw`/`$executeRaw`), never `Unsafe`; zod on every body | — |
| Open redirect | `safeNext` for `?next=`; API redirects only to `siteUrl` | — |
| SSRF | No user-controlled URL is fetched; providers are fixed hosts | — |
| Upload abuse | Session required; 5 MB; MIME allowlist **and** magic bytes; folder allowlist (Phase 20) | — |
| Webhook forgery / replay | HMAC; `WebhookEvent(provider, eventId)` unique; amount and currency checked; settle-once | — |
| Enumeration | Same answers for existing/missing accounts; admin 404; rate limits | `check-slug` confirms a slug is taken (public information) |
| Abuse / flooding | Per-address and per-number buckets on booking, OTP, waitlist, votes, views; the counters live in Postgres so every instance shares them | Limiter fails open if the database is down (deliberate); no WAF rules (S-08) |
| Dependency vulnerabilities | `npm audit` clean for web production dependencies; CI gate at high (Phase 20) | Mobile: Expo toolchain advisories (S-07) |

### Operations

| Threat | Mitigation | Gap |
|---|---|---|
| Secret leak | Secrets only in Vercel env; `.env*.local` gitignored; `env-coverage.test` keeps every variable declared | Production Paymob keys also exposed to Preview/Development; secrets not marked "sensitive" in Vercel (S-04) |
| Bad deploy | CI: typecheck, lint, tests, build, audits; Vercel instant rollback | No staging environment (S-05) |
| Bad migration | Hand-written idempotent SQL with pre-checks and NOTICEs; applied by the owner before deploy; code tolerates a missing column where it must (`refreshWithoutRotation`) | Order and application are manual; recorded in `PHASE_STATUS.md` |
| Silent failure | Structured JSON logs; the notification outbox; audit entries for money and account events | **No error tracker configured** (`SENTRY_DSN` unset, S-03); no alerting |
| Data loss | Neon backups; restore drill performed on an isolated copy (Phase 20, `docs/runbooks/SECURITY_OPERATIONS.md` § 3) | Production backup retention and PITR window to be confirmed by the owner (S-06) |

## Eterna visitor credentials (future)

When gate access for Eterna Mall / Emaar is built, the credential will
be a short-lived, single-venue, signed token (as the mobile access token
is), tied to a booking and to the customer's verified phone, presented
as a QR code, verified by the venue against our API with its own
credential, never containing personal data in clear, and revoked when
the booking is cancelled. The pieces that already exist — `jose`
signing with audience and expiry, the per-booking access token, the
outbox — are the ones to reuse. Nothing of it is in this phase.

## Out of scope / accepted

- Attacks on Paymob, Meta, Resend, Neon or Vercel themselves.
- A customer sharing their own booking link.
- Physical access to an unlocked device with the app signed in
  (mitigated by the 15-minute access token and per-device revocation).
