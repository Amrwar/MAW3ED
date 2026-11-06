# Proposed phases 29–34

These are proposals from the post-Phase-28 audit (docs/audits/POST_PHASE_28_PUBLIC_AUDIT.md). None of them has started. Each phase needs the owner's go-ahead.

## Phase 29: trust and correctness (do first)

**Why:** an open High security item, plus legal text that does not match the product.

**Scope:**
- S-2 recycled-number protection: `User.lastSignInAt` (migration), a staleness rule in `accountForVerifiedPhone`, a fence in `newHolderOf`.
- Terms of Use rewrite: bookings and cancellation (per-business cutoff), deposits and refunds, business subscriptions (no auto-renew), limitation of liability, governing law, organizations and delegated managers, visitor access. **Needs review by the owner or counsel before it ships.**
- Privacy notice: a section on organizations, delegated managers and the enterprise API and webhooks.
- Low security items: HMAC'd OTP hashes, session revocation on logout, owner-visible pending staff claims.
- CI: a DB-backed vitest job (Q-2), and a Playwright smoke on preview deployments (Q-3).
- Listing-quality nudge in the owner dashboard: missing English, every service on "price on request", a category that doesn't match the services.

**Acceptance criteria:**
- A user unseen for 180 days with no bookings in that time: their number verified by someone else gives that person a fresh account with no history. Covered by a `.db.test`.
- Terms and Privacy approved by the owner, in AR and EN.
- The CI job runs the 228 DB tests on every PR.

## Phase 30: organizations go public

**Depends on:** Phase 29 privacy and terms.

**Scope:**
- An `/organizations` (AR+EN) landing page explaining owned groups, hosted malls and compounds, and delegated managers.
- A contact-sales form that writes to admin and emails support@.
- `/for-business` gains a section for groups and malls.
- Header or footer link appears **only once at least one org directory is published**, so visitors never meet an empty page.
- An org help article.
- One production pilot with a fictional org, cleaned up afterwards.

**Acceptance criteria:**
- A visitor reaches the org offer within two clicks from home.
- A sales lead lands in the admin within a minute.
- The pilot run: register → approve → invite a business → booking attributed → check-in, all on production, then removed.

## Phase 31: organization commercial model

**Depends on:** an owner decision on pricing.

**Scope:**
- An org plan or contract tier: per org, per member business, or a revenue share.
- Billing through the existing Stripe integration.
- `/pricing` gains an "Organizations" tab with "contact us" pricing.
- Fit `OrganizationContract` limits to the tiers.

**Acceptance criteria:** an org can be invoiced. Plan limits are enforced and tested.

## Phase 32: visitor access with a real provider

**Depends on:** a signed partner and their API credentials.

**Scope:** implement one `partnerAdapters` entry and run the end-to-end sync against the partner's sandbox.

**Acceptance criteria:** pass issue and revoke round-trip in the partner sandbox; reconcile tests pass.

## Phase 33: mobile store release

**Depends on:** Apple and Google developer accounts.

**Scope:**
- Build and submit to TestFlight and Play internal testing.
- Footer "coming soon" becomes real store badges.
- Maestro flows on EAS.

**Acceptance criteria:** both apps installable from the stores. The footer links to real listings.

## Phase 34: quality automation and performance

**Scope:**
- Lighthouse CI and axe budgets (Q-9).
- Weekly live-content scan (Q-10).
- Cron overlap lock (Q-4).
- Reminders starvation fix (Q-5).
- Mobile polling backoff (Q-6).
- Stripe stale-claim recovery (Q-7).
- `eslint .` scoped so it can gate CI (Q-11).

**Acceptance criteria:** CI fails on a performance score under 0.8 or accessibility under 0.95. The concurrency tests for Q-4, Q-5 and Q-7 pass.
