# Security report — Phase 20

Date: 2026-10-29. Scope: the web application, its API, the mobile app's
use of it, the operations around them. Method: reading every
authentication, authorisation, data-handling and operations path
(`THREAT_MODEL.md`), fixing what was found, and verifying with unit,
database and HTTP tests (`docs/phases/PHASE_20_REPORT.md`,
`docs/roadmap/TEST_MATRIX.md`).

Nothing here is a certification. "Verified" means a test in this
repository exercised it against a local production build or a local
Postgres; "production" means what was observed on the live site without
writing to it.

## 1. Findings fixed in this phase

| ID | Sev | Finding | Fix | Verified by |
|---|---|---|---|---|
| S-F01 | High | **Web sessions could not be revoked.** A password reset ended app sessions but the web cookie stayed valid for its 30-day life; a role or business removed reached the token only on its next explicit update | `User.sessionsRevokedAt`; the JWT re-checks the account every 5 minutes and is refused once revoked (`lib/security/session-policy.ts`, `src/auth.ts`); password reset and the new "sign out everywhere" set it; explicit `maxAge` 30 d | `session-policy.test.ts`; `qa-phase20.mjs` R1–R2 |
| S-F02 | High | **A recycled phone number inherited a deleted account's history** (P17-14). Bookings are keyed by phone; deleting the account left them; the next person to verify the number got an account that showed them | Deletion records a keyed hash of the number (`PhoneRelease`); an account created for it later carries `historySince` and every reader is fenced (`ownedWhere`); the previous holder's name is not reused; the delivery ledger loses the address; the deletion is audited | `deletion.db.test.ts` on Postgres; `deletion.test.ts` |
| S-F03 | Medium | **Uploads trusted the declared MIME type and any folder** | Magic-byte check (JPEG/PNG/WebP) must agree with the declared type; folder allowlist | `image-sniff.test.ts`; `qa-phase20.mjs` U1–U4 |
| S-F04 | Medium | **No CSRF check beyond the cookie's SameSite attribute** | Origin check in the proxy on every state-changing API call carrying the session cookie; routes with their own authentication exempt | `origin.test.ts`; `qa-phase20.mjs` C1–C5 |
| S-F05 | Medium | **Realtime bookings stream trusted the token's `businessId`** for the life of the connection | `requireBusiness()` re-reads ownership | route guard test |
| S-F06 | Low | **Profile-view counter unlimited** (an owner reads it as demand) | Per-address bucket, 120/hour | `qa-phase20.mjs` V1 |
| S-F07 | Low | **No account data export** | `GET /api/account/export`, rate-limited, attachment, same fence as the screens | `qa-phase20.mjs` E1–E2 |
| S-F08 | Low | **Account deletion, password reset and mass sign-out left no audit record** | `AuditLog` rows `account.deleted`, `account.password_reset`, `account.sessions_revoked` | tests above |
| S-F09 | Low | **Mobile `zod` 3.25 under advisory GHSA-mrhx-c7xc-m3w5**; four Expo tooling advisories fixable without a major bump | `zod` 4.6.7 in `mobile/`; `npm audit fix` applied | mobile typecheck and tests pass |
| S-F10 | Low | **No CI gate on dependency advisories; no test that a new API route is guarded** | CI audits web production dependencies at `high`, mobile at `critical`; `route-guards.test.ts` fails on an unguarded, unlisted route | CI config; test |

## 2. Verified as already sound (no change)

Per-request role and ownership checks from the database; tenant
scoping on every business route (Postgres and HTTP tests); OTP
generation, attempt counting and burning; bcrypt(12); rotating,
revocable mobile refresh tokens with reuse detection; HMAC-verified,
replay-safe, amount-checked webhooks; settle-once ledger and reserved
refunds; hashed reset and verification tokens; nonce CSP, HSTS, nosniff,
frame and referrer headers, no `X-Powered-By`; PII redaction in logs;
hashed rate-limit keys; parameterised SQL only; no user-controlled
outbound fetch; safe `?next=` handling; web production dependencies
with no known advisory.

## 3. Residual risks, with owners

| ID | Sev | Risk | Why it is open | Mitigation in place | Owner, next step |
|---|---|---|---|---|---|
| S-01 | **High** | No second factor for administrator and super-admin accounts | Needs a TOTP/WebAuthn enrolment flow and UI; not in this phase | bcrypt, per-email login throttle, role from DB per request, audit log, refunds super-admin only | Engineering, next security phase: WebAuthn or TOTP for `adminRole` accounts; until then the owner keeps admin passwords unique and long |
| S-02 | Medium | A dormant customer account on a recycled number is reachable by the number's new holder | Phone OTP proves the number, not the person; only a deletion fences history today | Short OTP life, per-device sessions | Product decision: step-up (email confirmation or re-verification) when an account has not signed in for N months; or expire dormant accounts |
| S-03 | Low | Error tracking now configured: Sentry project `maw3ed` (org `website-builder-l5`), `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_ORG`/`SENTRY_PROJECT` set in all Vercel environments on 2026-10-29 and a test event received (issue MAW3ED-1). Still missing: alert rules on new issues, a Vercel log drain, an uptime check, and `SENTRY_AUTH_TOKEN` for source-map upload | Configuration | Redacted structured logs; outbox and audit tables | **Owner**: in Sentry, Alerts → create a rule "notify on new issue" to email; optionally create an org auth token for source maps and set `SENTRY_AUTH_TOKEN` (Sensitive) |
| S-04 | Medium | Production Paymob keys also exposed to Preview and Development; secrets not marked sensitive in Vercel (P17-25) | Configuration | Preview deployments do not take payments by default | **Owner**: separate Paymob test keys for Preview/Development; mark every secret "Sensitive" in Vercel |
| S-05 | Medium | No staging environment; migrations applied by hand | Cost and process | Idempotent SQL with pre-checks; CI build; restore drill works | Owner: a Neon branch per PR as staging, or at least before migrations |
| S-06 | Medium | Production backup retention and point-in-time window not confirmed | Depends on the Neon plan | Restore procedure proven on a dump (§ runbook 3) | **Owner**: confirm the Neon plan's PITR window; schedule a monthly `pg_dump` to encrypted off-site storage |
| S-07 | Low | Mobile: 6 high / 5 low advisories remain in the Expo toolchain (`@expo/cli`, `expo-router`→`query-string`/`decode-uri-component`, `deepmerge`) | Need an Expo SDK upgrade | Build-time tooling, not runtime network surface, except `expo-router` URL parsing of deep links | Engineering, with the next Expo SDK; CI gate at `critical` meanwhile |
| S-08 | Low | No WAF, bot or DDoS rules beyond Vercel's defaults | Not configured | Application rate limits | Owner: Vercel Firewall rules for `/api/auth/*` and `/api/public/*/bookings` |
| S-09 | Low | Rate limiter fails open when the database is unreachable | Deliberate: availability over the limiter | — | Accepted |
| S-10 | Low | `style-src 'unsafe-inline'` in the CSP | React inline styles | Scripts are nonce-locked | Accepted |
| S-11 | Low | Password rule is length ≥ 8 only | — | bcrypt, throttle | Engineering: deny common passwords; encourage phrases |
| S-12 | Low | Vercel access logs hold request URLs with `?lat=&lng=` | Provider behaviour | App logs do not | Owner: Vercel log retention setting |
| S-13 | Info | Business-side data export is per screen; no one-call export | Not requested | — | Backlog |
| S-14 | Info | Free text in `Booking.notes` / `Customer.notes` can carry health details | By nature | Only the owner/manager reads notes; providers do not | Legal/product: say so in the business terms |

## 4. Legal and compliance questions needing qualified review

See `docs/legal/*.md`. Each draft marks what is a fact of the code and
what is a decision or a question for counsel. In particular:

- the legal entity, its registration country and contact details;
- the lawful basis and notices required under Egypt's Personal Data
  Protection Law (Law 151/2020) and its executive regulations, and any
  licensing/controller registration the Personal Data Protection
  Centre requires;
- whether clinic bookings make Maw3ed a processor of "sensitive" data
  under that law, and what that requires of the businesses;
- cross-border processing (Vercel, Neon, Resend, Cloudinary, Meta,
  Expo are outside Egypt);
- retention periods for bookings, payments, audit logs and delivery
  records (the code applies none today);
- minimum age;
- the deposit, cancellation and refund terms Paymob's merchant review
  expects (P17-13).

No approval, certification or compliance is claimed.
