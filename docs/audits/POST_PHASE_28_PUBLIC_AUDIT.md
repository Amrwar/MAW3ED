# Post-Phase-28 public audit

**Date:** 2026-11-06
**Baseline:** main @ 1db4e39 (production)
**Fixes:** branch `fix/public-copy-consistency`

**Method:**
- `curl` against www.maw3ed.net for public pages, robots, sitemap, canonical, hreflang and JSON-LD.
- Code reading. Three read-only investigations ran in parallel: organization architecture, security/authorization, and loop/runaway work. I re-checked every security finding they made in the code before acting on it.
- The local checks listed under "Tests executed".

**Not performed (no tools, or unsafe):**
- Browser E2E against production.
- Lighthouse or axe measurements.
- Device tests of the mobile app.
- Partner and provider tests.
- `.db.test` suites: they need a database, so they were skipped.
- Any write against production.

Detail files: [PUBLIC_CONTENT_FINDINGS.md](PUBLIC_CONTENT_FINDINGS.md) · [ORGANIZATION_PRODUCT_READINESS.md](ORGANIZATION_PRODUCT_READINESS.md) · [CONTINUOUS_QA_GAPS.md](CONTINUOUS_QA_GAPS.md) · [../roadmap/PROPOSED_PHASES_29_34.md](../roadmap/PROPOSED_PHASES_29_34.md)

## 1. Confirmed defects

| ID | Severity | Defect | Status |
|---|---|---|---|
| S-1 | **High** | A phone OTP signed into **any** account holding the number, including business owners (whose dashboard holds every customer's details and payments) and admins. One SMS/WhatsApp factor bypassed both password and Google. Evidence: `auth.ts` phone-otp `authorize`; `api/auth/mobile/otp` | **Fixed**: `lib/auth/phone-signin-policy.ts` refuses owners and admins on web and mobile, with a clear message ("sign in with email/password or Google"). Staff phone login is unchanged |
| S-2 | **High** | A recycled phone number whose old holder **never deleted** their account: the new holder signs straight into that account (`login-code.ts:151-156`). They get its full booking history, each booking's `accessToken` (cancel/reschedule), payments, reviews and data export | **Open: needs a schema change**, see the proposal below |
| C-1 | Medium | The deletion page said past bookings "will show again" in a new account on the same number. The code does the opposite (`PhoneRelease` fence) | **Fixed** (AR+EN) |
| C-2 | Medium | FAQ promised a fixed two-hour cancellation window. The cutoff is per business (`cancellationCutoffHours`), as the help centre says | **Fixed** |
| C-3 | Medium | Services priced 0 (allowed on purpose: the business quotes the price) displayed "Price not set", which reads as a broken listing | **Fixed**: now "Price on request / السعر عند الاستفسار". Help article explains 0 |
| L-1 | Medium | `/dashboard`, `/dashboard/analytics` and `/dashboard/referrals` sent a token with a stale or empty `businessId` to `/onboarding`, which looks up by owner and sends it back, so the browser bounced between them (same class as the earlier production report fixed in the layout) | **Fixed**: all three use `requireBusinessPage()` (owner fallback). Regression test scans every dashboard page |
| L-2 | Low | Translation model call had no timeout. One hung call could eat the cron's 300 s and starve later businesses | **Fixed**: `AbortSignal.timeout(60 s)` + test |
| C-4 | Low | Terms of Use is 207 words. It is silent on deposits and refunds, subscriptions, cancellation, liability, governing law, organizations and visitor access | Open: Phase 29, legal review |
| C-5 | Low | Apex `maw3ed.net` → `www` is a 307 (temporary) | Open: owner setting in Vercel Domains |

**Proposed S-2 fix**, to be designed and reviewed in Phase 29:
1. Add `User.lastSignInAt`, set on every sign-in.
2. In `accountForVerifiedPhone`, treat a user whose last sign-in and last booking are both older than about 180 days as a recycled number:
   - If the account has an email or Google link, require that factor.
   - Otherwise, in one transaction: write a `PhoneRelease`, detach the number and start a fresh account fenced at now.
3. In `newHolderOf` without a release: fence history at the start of the latest run of bookings with no gap over 180 days.

## 2. Already fixed (verified, no action)

- **Sign-in page ↔ dashboard loop (F-27):** guarded by `auth-page-loop.test.ts`.
- **Locale redirects:** a pure function. Every target ends in a rewrite or next.
- **Organization hierarchy cycles:** a DB trigger refuses them (depth ≤ 3, walk ≤ 10). Tested, including a cycle inserted with the trigger bypassed.
- **Deleted account → new holder of the number:** fenced by `PhoneRelease` (only the page text was wrong).
- **Webhook signatures:**
  - Stripe: HMAC-SHA256, timestamp tolerance, constant-time compare.
  - Paymob: HMAC-SHA512, fails closed.
- **CSRF:** SameSite=Lax plus an Origin check on mutating `/api` requests.
- **Tenant isolation:** every business `[id]` route scopes by `businessId`; every org and venue route goes through `requireOrgAccess`/`requireVenueAccess` with a permission.
- **SEO basics:** self-canonical, ar/en/x-default hreflang, sitemap and robots all correct.

## 3. Publicly hidden but working

These are deployed and tested, but nothing public leads to them:
- OWNED, HOSTED and MANAGED organizations
- Delegated manager access (9 scopes, expiry)
- Organization directories (`/groups`)
- Org QR and attribution
- Booking check-in
- The enterprise API and webhooks

See ORGANIZATION_PRODUCT_READINESS.md.

## 4. Undeployed functionality

None. Phases 22 through 28 are merged, with their production migrations applied.

**Blocked externally:**
- **Visitor-pass providers:** no partner adapter exists, and the sandbox is refused on Vercel.
- **Mobile apps:** no store accounts yet.
- **Auto-translation:** needs paid AI Gateway credit.
- **WhatsApp login template:** needs a WABA payment method. Meta business verification is pending.

## 5. New product opportunities

- Organization landing and contact-sales path (Phase 30).
- Org pricing tier (Phase 31).
- A listing-quality nudge for owners: missing English, price-on-request on every service, category mismatch (Phase 29).
- Optional "price from" display on cards.

## 6. Security and privacy concerns

| | Item | Status |
|---|---|---|
| Fixed | S-1 | See above |
| Open | S-2 | See above |
| Open (low) | OTP hashes are unsalted SHA-256 of a 6-digit code | Use an HMAC with a server secret |
| Open (low) | A normal logout does not revoke the 30-day JWT (only "sign out everywhere" does) | Revoke the session in the `signOut` event |
| Open (low) | A staff seat goes to whoever verifies the `loginPhone` the owner typed | Show the owner a pending claim |
| Open | Privacy notice has no section on organizations and delegated access | Required before the first org goes live |
| Solid | OTP limits: 6 digits, 10-minute TTL, 5 attempts, 60 s cooldown, 5 sends/hour | About 25 guesses/hour/number |

## 7. Performance

- Nothing measured: Lighthouse was not run (no tool here).
- The production build compiles in 12 s and prerenders 236 pages.
- Bounded-work issues are listed under §8.

## 8. Infinite-loop investigation

| Verdict | Items |
|---|---|
| **Confirmed and fixed** | L-1 (dashboard ↔ onboarding) |
| **Possible, tests proposed** | Translations: no timeout (fixed, L-2), cron runs may overlap (Q-4). Reminders: `take: 1000` starvation (Q-5). Mobile payment polling: no error backoff (Q-6). Stripe: the claim is not released if the function is killed mid-handler (Q-7) |
| **Guarded (evidence in the subagent report, summarised)** | Notification outbox: 5 attempts with backoff, then DEAD. Outbound webhooks: 8 attempts; endpoint disabled after 20 failures; SSRF guard. Access sync: 6 attempts with a time budget. Automations: page cap plus a 240 s deadline. Payment reaper: `take 500` with row locks. Realtime stream: client stops after 8 failures. Mobile app: every listener cleaned up; a 401 retries once with a single shared refresh. No `revalidate*` calls anywhere. No effect calls `router.push` unconditionally |

## 9. Tests executed (exact results, local, branch `fix/public-copy-consistency`)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src` | 0 errors, 6 warnings (the warning count is the same as main) |
| `npx eslint .` (whole repo) | 2457 errors, 30985 warnings, all outside `src/` (see Q-11) |
| `npx vitest run` | 147 files passed, 22 skipped (DB). **1451 passed, 228 skipped, 0 failed**, after the new tests were added |
| `npx next build` | exit 0. Compiled in 12.3 s, 236/236 static pages |
| Live HTTP checks | robots, sitemap (64 URLs), canonical, hreflang and JSON-LD on 11 pages, plus 4 company pages, FAQ and help text |
| Browser E2E, Lighthouse, axe, device, partner, concurrency | **Not run** (no tooling here or unsafe on production) |

## 10. Recommended work, by impact and dependency

1. **Merge this branch** (S-1, C-1..C-3, L-1, L-2).
2. **Owner actions, no code needed:**
   - Buy AI Gateway credit (fixes the English listings).
   - Re-categorise or hide BerryGum.
   - Set the apex redirect to permanent.
   - Add the WABA payment method.
3. **Phase 29:** S-2 recycled-number fix, Terms rewrite (legal review), privacy section on organizations, the low security items, Q-2/Q-3 CI.
4. **Phase 30:** organization landing page, sales path and help article; then one production pilot with a fictional org.
5. **Phase 31:** org commercial model and billing.
6. **Phases 32–34:** see the roadmap.
