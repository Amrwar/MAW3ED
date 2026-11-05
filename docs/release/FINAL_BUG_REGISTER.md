# Final bug register

Final audit, 2026-11-05. Every defect this audit confirmed, plus the older
open items it re-checked. The fixes are on branch `final-audit`: commit
`e79f2a1`, plus review fixes after it. Each fix has a regression test that
was run with the fix removed and seen to fail, except where noted.
The fixes were then reviewed independently (`/code-review`). Ten findings: nine fixed, among them a
reschedule that could commit half a move, NaN money tiles, a refund-row race, and a
webhook send a slow receiver could hold open. One was rejected (it would have dated
entitlements by the wall-clock column).

Severity: **P0** data loss, security breach or money wrong in normal use ·
**P1** serious or likely production failure · **P2** real, limited ·
**P3** minor or hardening.

## Summary

| | Found | Fixed | Open |
|---|---|---|---|
| P0 | 1 (legal text) | the factual part (Stripe disclosed, F-30) | 1: operator identity, retention, minimum age and money terms (F-30b, owner/counsel) |
| P1 | 3 (F-01, F-10, F-20) | 3 | 0 (F-01 and F-10 still need an external confirmation) |
| P2 | 19 | 17 | 2 (S-02 decision, M-03 latent) |
| P3 | 30 | 18 | 12 (one, S-09, fixed then reverted on review: the fix was worse than the risk) |

Plus one test defect (T-01, fixed), one accepted design (S-04), one decision (M-07) and one blocked CI job (CI-01).

## Fixed

| ID | Sev | Area | Defect (reproduction) | Root cause | Fix | Test |
|---|---|---|---|---|---|---|
| F-01 | P1 | Operations | The weekly off-site backup never produced a copy: run 2026-11-02 dumped 265 KB, then `shred: Permission denied`, so no upload | The Docker container wrote the dump as root | Containers run as the runner's user | **Needs a manual run after merge** (no CI test possible) |
| F-02 | P2 | Check-in | Pressing "scan" on `/dashboard/check-in` always said the camera was denied | `Permissions-Policy: camera=()` site-wide | `camera=(self)` | `security/permissions-policy.test.ts` |
| F-03 | P2 | Push | After "sign out everywhere" or a password reset, a lost phone kept getting booking pushes | Device tokens outlived sessions | Tokens deleted with sessions; push needs a live session | `notifications/push-session.test.ts` |
| F-04 | P2 | Mobile / account | A wrong deletion code spent 2 of 5 attempts and showed "session ended" | 401 for a form error triggered refresh-and-replay | 422 `wrong-code` | `api/account/delete/route.test.ts` |
| F-10 | P1 | Payments | A second Paymob order for one booking (pay again; balance link) is refused as a duplicate | `merchant_order_id` = booking id | Unique per order; parsed back on return | `services/paymob-order.test.ts` (Paymob's real behaviour unverified) |
| F-11 | P2 | Entitlements | Rescheduling let a package be used after expiry, or stacked membership visits into one month | Reschedule ignored `EntitlementUse` | `moveEntitlement` in the transaction; 409 `entitlement-gone` | `entitlements/move.db.test.ts` (calls the new function; route wiring type-checked) |
| F-12 | P2 | Discounts | A booking revived by a late payment kept its discount with no redemption, so caps could be exceeded | Revival re-took points only | Discount re-claimed; over-cap flagged | `webhooks/paymob/route.db.test.ts` |
| F-13 | P2 | Payments | Overlapping decline and success could leave a paid payment FAILED; double settle | Read-then-write without a lock | `SELECT … FOR UPDATE` in settle, fail, reap | `payments/ledger-race.db.test.ts` |
| F-14 | P2 | Payments | An owner could open several payable links for one balance; overpayment not flagged | No lock or live-link check in link mode | Advisory lock; a second link within 10 min is refused (double click); later links supersede the old one; a row Paymob never opened blocks nothing; `payment.overpaid` audit | `business/bookings/[id]/payments/route.db.test.ts` |
| F-15 | P3 | Reconciliation | Stripe Dashboard refunds showed as a permanent discrepancy | No `Refund` row | Row inserted for the difference | `webhooks/stripe/route.db.test.ts` |
| F-16 | P3 | Plans | Bookings 00:00–02:00 Cairo on the 1st counted toward the previous month | UTC month | Cairo month bounds | `bookings/create-month-key.test.ts` |
| F-17 | P3 | Payments | A hung Paymob call held a booking until the 2 h reaper | No timeout | 15 s timeouts | `paymob-order.test.ts` |
| F-18 | P3 | Booking | An idempotency key could return another business's booking (with its token) | Unscoped lookup | Scoped to the business | `create-month-key.test.ts` |
| F-20 | P1 | Organizations | A REPORTS-only delegate read revenue and staff commission | Route guarded by `reports.read` alone | Money only with `finance.read` | `business/reports/operations/route.test.ts` |
| F-21 | P2 | Organizations | A branch-limited delegate read the whole waitlist (names, phones) | Entries carry no branch | Refused for branch-limited delegations | route reviewed; no route test |
| F-22 | P2 | Venues | A suspended organization still ran its venues' desk, decisions and passes | Authority from role rows only | A SUSPENDED or REJECTED organization stops its venues (guard, passes, public). Not "anything but APPROVED": operators the platform adds keep PENDING (caught by `phase22.db.test`) | `venues/guard-suspended.test.ts` |
| F-23 | P2 | Webhooks | DNS rebinding past the SSRF check; ping as a probe; embedded-IPv4 IPv6 | Check and fetch resolved separately | Pinned lookup at connect; ping 10/h; ranges | `enterprise/ssrf-pinned.test.ts` |
| F-24 | P3 | Webhooks | Queued deliveries ignored a grant narrowed to some branches | Business-only re-check | Branches compared | `enterprise/webhook-branches.test.ts` |
| F-25 | P3 | Organizations | Expired grants / suspended organization still saw package and plan figures | Filters lacked expiry and status | Live grants only | `organizations/live-grants.test.ts` |
| F-26 | P3 | Organizations | A branch-limited delegate could end another branch's series | No branch filter | Series must lie within the granted branches | route reviewed |
| F-27 | P2 | Auth | Redirect loop (ERR_TOO_MANY_REDIRECTS) after a session was revoked | Proxy bounce vs layout database check | Bounce moved to the pages | `auth/auth-page-loop.test.ts` |
| F-28 | P2 | Crons | The operations cron had no deadline; later jobs never ran on a busy day | No time budget | 240 s deadline, `skipped`, retries first; explicit `maxDuration` on every cron | `automations/run-deadline.test.ts` |
| F-29 | P3 | Crons | Waitlist sweep, membership auto-resume and the reaper could re-read the same rows each run | `take` without an order | Ordered; due-only in SQL | `entitlements/auto-resume.db.test.ts` |
| F-30 | P0 (part) | Legal | The privacy page did not name Stripe, which receives the owner's email | Stripe added after the page | Stripe listed, both gateways named | `final-audit-content.test.ts` |
| F-31 | P2 | Payments UI | Payment return pages Arabic-only; blank for other statuses; mislabelled button | Hardcoded Arabic | Bilingual, fallback, label | `final-audit-content.test.ts` |
| F-32/33 | P2 | Account, billing | Arabic-only kinds; dates a day off near midnight | No language; server UTC | Labels in both languages; Cairo dates | `final-audit-content.test.ts` |
| F-34 | P2 | Navigation | Help centre unreachable from public pages | Not in footer | Footer link | `final-audit-content.test.ts` |
| F-35 | P3 | Errors | Client render errors not reported; no `global-error` | — | Sentry capture; `global-error.tsx` | `final-audit-content.test.ts` |
| F-36 | P3 | Copy | "Payment through Paymob" only, though Stripe is offered | — | Both named | `final-audit-content.test.ts` |
| F-37 | P3 | SEO | Arabic JSON-LD on `/en` | `nameAr` only | Language option | `final-audit-content.test.ts` |
| F-38 | P3 | Email | Renewal link opened the wrong tab | — | `?tab=subscription` | `final-audit-content.test.ts` |
| F-39 | P3 | Robots, venue console | Private consoles not disallowed; raw status codes | — | Disallowed; labels | `final-audit-content.test.ts` |
| S-01 | P2 | Auth | Distributed password guessing on mobile; spraying on web | One-sided limits | Per account and per caller on both | `rate-limit.test.ts` |
| S-03 | P3 | Staff | Create linked another business's services | Missing filter | Filtered | `business/staff/route.test.ts` |
| S-08 | P3 | Privacy | Bearer tokens in URLs sent to Sentry | Scrubber covered email/phone only | Paths and query secrets redacted | `sentry-scrub.test.ts` |
| S-10 | P3 | Verification | Changing the WhatsApp number kept "verified" and the badge (also P17-26) | Not cleared | Cleared on a real change | `business/route.test.ts` |
| M-04 | P3 | Mobile | Session expiry left the last person's drafts and searches | Only sign-out cleared them | Cleared on expiry too | typecheck + mobile tests (no component test) |
| M-05 | P3 | Mobile | A long Android device name blocked sign-in (422) | `max(80)` refusal | Cut to 80 | type-checked |
| T-01 | — | Tests | `outbox.db.test.ts` failed intermittently ("flake" in Phase 28) | Asserted a database-wide count while other files ran | Asserts its own row | 3 consecutive passes |

## Open

| ID | Sev | Impact | Reproduction | Root cause | Required fix | Release impact |
|---|---|---|---|---|---|---|
| F-30b | P0 (legal) | The site takes money with terms that say nothing about plans, deposits, refunds, cancellation, no-shows, liability or law; the operator is not named | Read `/terms`, `/privacy` | Legal text not written | Counsel; owner names the entity | **Blocks paid public launch** |
| S-02 | P2 | Owner can review own business via a walk-in | Enter a walk-in with own phone → complete → review link | No source check | Decision; then rule | CONDITIONAL |
| M-03 | P2 latent | Enabling `BOOKING_PHONE_VERIFICATION` breaks every app booking | Set flag; book in the app → 403 | App books anonymously, no proof | Bearer when signed in; guest code step | Do not enable the flag |
| B-08 | P3 | Two racing bookings can sit inside each other's buffer (never overlap) | Concurrent adjacent bookings | Constraints exclude buffer | Include buffer in `endsAt` range or lock | Accept |
| S-05 | P3 | Access token valid ≤ 15 min after revocation | Revoke, reuse token | No `sid` | `sid` check | Accept |
| S-06 | P3 | Push to a logged-out device if unregister failed | Logout offline | No token↔session link | Bind tokens | Accept |
| S-07 | P3 | One OTP for all purposes | — | No purpose column | `purpose` | Accept |
| S-11 | P3 | Sign-up enumeration | Register a known email | 409 message | Generic answer | Accept |
| S-09 | P3 | Many callers could send reset emails to one inbox | Request resets from many IPs | Per-IP limit only | A per-address limit was added, then removed on review: a stranger could use it up and silently stop the owner's own resets | Accept (bounded per IP) |
| M-06 | P3 | iOS staging/dev builds show "Maw3ed" | Install both | Locale `CFBundleDisplayName` | Per-environment name | Accept |
| M-07 | Decision | "preview" mobile profile talks to production | `eas.json` | Intentional per docs | Confirm | Owner |
| D-01 | P3 | `db:push` would drop SQL-only indexes | Run it | Prisma schema lacks them | Never run against real DBs (documented) | Accept |
| L-01 | P3 | Delivery and event tables never pruned | Growth | — | Retention prune | Accept |
| L-02 | P3 | Realtime polls per hidden tab | Many tabs | — | Pause when hidden | Accept |
| P17-20 | P3 | Unbacked "replies within 24 hours" copy (re-check pending) | — | Copy | Owner | Accept |
| CI-01 | Blocked | Android E2E fails on `main` (no APK) | Actions run 2026-11-04 | No `E2E_APK_URL` | Owner input | Blocks mobile verification |
| DEP | P3 | Mobile 6 high (toolchain), web 5 moderate | `npm audit` | Upstream | Expo SDK upgrade | Accept |

## Re-checked older items

| ID | Now |
|---|---|
| P17-12 Sentry DSN missing | **Resolved:** both DSN variables set in production |
| P17-13 Terms lack money terms | Still open (F-30b) |
| P17-24 Reported reviews count; owner can review self | Reported-review counting is deliberate (documented in `reviews.ts`); self-review still open (S-02) |
| P17-26 Badge survives phone change; mobile login per-IP only | Both fixed (S-10, S-01) |
| P17-27 Maestro failing | Still failing: no APK (CI-01) |
| P17-28 No backup procedure | Procedure exists; first run failed (F-01, fixed) |
