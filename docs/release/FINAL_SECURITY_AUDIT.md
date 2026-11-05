# Final security audit

Final audit, 2026-11-05. An independent read of every route family,
authentication, sessions, validation, secrets, uploads and webhooks, and
the dependency audits. Tests were run against the local QA database and
production build only. Against production only read-only GETs were sent:
the sitemap, headers and the anonymous health check.

Earlier record: `docs/security/SECURITY_REPORT.md`, `THREAT_MODEL.md`,
`VISITOR_ACCESS_THREAT_MODEL.md`. Those were not taken as evidence. Each
claim used here was re-checked in code.

## Verdict

The review found **no P0 or P1 cross-tenant exposure**: no route lets one
business, customer, organization or venue read or change another's
records. The audit fixed **one P1 permission defect**: an organization
granted REPORTS could read revenue and staff commission (F-20). Every P2
found is fixed except two, which are decisions (S-02 self-review, M-03
latent flag). The P3 items are listed below with their owners.

## Fixed in this audit

| ID | Sev | Defect | Fix | Regression test |
|---|---|---|---|---|
| F-20 | P1 | `/api/business/reports/operations` gave revenue and per-staff commission to anyone with `reports.read`, including a MANAGED organization with REPORTS, which the database bars from FINANCE | Money only with `finance.read`; others get counts (`withoutMoney`) | `api/business/reports/operations/route.test.ts` |
| F-21 | P2 | A branch-limited delegate read the whole business's waitlist, with names and phones | Refused for branch-limited delegations (entries carry no branch) | covered by route review; `qa-phase24`/`22c` delegate checks unchanged |
| F-22 | P2 | A suspended organization's people kept its venues: desk (visitor names), decisions, overrides, pass issuing, public page | Venue guard, pass decisions and the public venue filter stop a SUSPENDED or REJECTED organization's venues | `venues/guard-suspended.test.ts` |
| F-23 | P2 | Webhook SSRF guard open to DNS rebinding; ping reported results on demand; NAT64 / 6to4 / IPv4-compatible IPv6 not refused | Send connects only through a lookup that refuses private answers (`postPinned`); ping limited to 10/h per endpoint; ranges added | `enterprise/ssrf-pinned.test.ts` |
| F-24 | P3 | Queued webhook deliveries ignored a grant narrowed to some branches | Send-time re-check compares branches | `webhook-branches.test.ts` |
| F-25 | P3 | Organization package report and integrations "subscriptions" ignored expiry and organization status | Live grants of an approved organization only | `organizations/live-grants.test.ts` |
| F-26 | P3 | A branch-limited delegate could end another branch's recurring series by id | Only a series entirely within the granted branches | route review |
| F-03 | P2 | After "sign out everywhere" or a password reset, a lost phone kept receiving booking pushes | Device tokens deleted with the sessions; push only while a live app session exists | `notifications/push-session.test.ts` |
| S-01 | P2 | Mobile password login limited per IP only; web login per email only | Both paths limited per account (shared bucket) and per caller across accounts | `rate-limit.test.ts` |
| S-03 | P3 | Staff create linked another business's services | Filtered to the business's own services, as the update already was | `api/business/staff/route.test.ts` |
| S-08 | P3 | Sentry received booking, pass, waitlist, check-in and reset tokens in URLs | Path and query secrets redacted before sending | `sentry-scrub.test.ts` |
| S-10 | P3 | Changing the WhatsApp number kept "phone verified" and the badge | Verification cleared when the number really changes (normalised); badge re-derived | `api/business/route.test.ts` |
| F-02 | P2 | `Permissions-Policy: camera=()` blocked the check-in scanner (not a security hole; a hardening setting that broke a feature) | `camera=(self)` | `security/permissions-policy.test.ts` |

## Open (with owner)

| ID | Sev | Issue | Impact | Required fix | Release impact |
|---|---|---|---|---|---|
| S-02 | P2 | A business can review itself: a walk-in it entered with its own phone, marked COMPLETED, gets a review link | Inflated ratings shown as "verified booking" (P17-24 also open: reported reviews count while under review, by design) | Product decision: no reviews on business-entered or walk-in bookings, or label them; one review per phone per business | CONDITIONAL — trust in reviews |
| M-03 | P2 (latent) | With `BOOKING_PHONE_VERIFICATION=1`, every app booking would fail (`phone-unverified`): the app books without the bearer token and never sends a phone proof | None today (flag unset) | Send the token when signed in; add the code step for guests | **Do not enable the flag** until fixed |
| S-05 | P3 | A mobile access token works for up to 15 minutes after logout or revocation | Bounded: business, admin, organization and venue guards re-read the database | `sid` in the access token, checked against `MobileSession` | Accept for launch |
| S-06 | P3 | Per-device logout leaves that device's push token if the app's unregister call fails | The app unregisters before logout; server-side only on failure | Bind `DeviceToken` to `MobileSession` | Accept |
| S-07 | P3 | One one-time code works for every purpose (booking proof, sign-in, deletion) | Social engineering ("read me your booking code") | `purpose` column on `LoginCode` | Accept; message wording warns |
| S-09 | P3 | Reset emails limited per IP only (one inbox can be flooded from many IPs) | Annoyance | A per-address limit was tried and removed on review: a stranger could use it up and silently stop the owner's resets | Accept |
| S-11 | P3 | Sign-up says an email is already registered | Enumeration, throttled 5/h per IP | Generic answer plus email | Accept |
| S-04 | — | Email verification links are reusable until expiry | Deliberate: mail scanners open links first; verifying is idempotent; profile changes delete pending links | — | Accepted by design |
| S-07b | P3 | Mobile: 6 high advisories in the Expo toolchain (`@expo/cli`, `expo-router` → `query-string`/`decode-uri-component`) | Build tooling; deep-link URL parsing | Next Expo SDK | Tracked as S-07 in `SECURITY_REPORT.md` |
| — | P3 | Web: 5 moderate advisories (`glob`/`minimatch`, transitive), no high or critical | Build-time | Dependency update | Accept |
| — | Owner | WAF / bot rules beyond Vercel defaults; Vercel log retention for `?lat=&lng=` | — | Vercel settings | Owner |
| — | Legal | Privacy page lacks the operator's legal identity, retention periods and minimum age; terms lack money terms | Compliance | Counsel | **Blocks a paid public launch** |

## Checked and sound (with evidence)

- **Tenant scoping:** the business comes from the caller's account, never the URL (`business-access.ts`). Every `[id]` business route filters `{ id, businessId }`. Bookings go through `bookingScope` (provider sees own, delegates by branch).
- **Roles:** staff → owner escalation blocked (`staff.manageAccess` OWNER-only). Admin RBAC re-read from the database; payments/refunds SUPER_ADMIN only; all 21 admin handlers guarded. `qa-phase20` 19/19, `qa-security` 32/32.
- **Delegation:** OWNED/MANAGED only, APPROVED, unexpired; HOSTED never operates (database CHECK). Re-validated every request. `qa-phase22c` 59/59, `qa-phase24` 147/147, `qa-phase28` 46/46.
- **Sessions:** web JWT re-checked every 5 min including `sessionsRevokedAt`. Refresh tokens rotate with reuse detection. Reset tokens hashed, 1 h, all sessions ended. OTPs hashed, 5 attempts, atomic.
- **Input:** no `$queryRawUnsafe`. No request body spread into Prisma. JSON-LD escaped. Redirects same-origin (`safeNext`). Uploads: allow-list, size cap, magic bytes, no SVG.
- **Webhooks in:** Paymob HMAC-SHA512 constant time; Stripe signature with 300 s tolerance; access-provider callbacks HMAC with a 300 s window and event de-duplication.
- **Secrets:** only the site URL, Sentry DSN, support contacts and version are `NEXT_PUBLIC_*`. Test switches (`PAYMOB_FAKE`, `ACCESS_SANDBOX`, `WEBHOOK_ALLOW_PRIVATE`) absent from production (`vercel env ls`, names only).
- **Headers (production):** CSP with nonce and `strict-dynamic`, HSTS 2 years, nosniff, SAMEORIGIN, strict referrer.
- **Rate limits:** login, signup, reset, OTP send/verify, public booking (per IP and per business), waitlists, review votes and reports, profile views, access scans, and now webhook pings.

## Required external reviews

- Legal review of privacy and terms (entity, retention, age, money terms, organization data sharing).
- A penetration test by a third party before an enterprise contract. This audit was a code review with automated, non-destructive tests only.
- Payment-provider review of the refund policy (Paymob merchant review).
