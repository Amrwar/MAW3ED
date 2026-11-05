# External dependencies

Final audit, 2026-11-05, `main` at `d9e8ece` plus branch `final-audit`.
What MAW3ED depends on outside this repository, what each one blocks, and
who must act. "Verified" means verified with evidence in this audit or a
recorded phase; nothing here is assumed.

## Services in production

| Service | Used for | State (evidence) | Blocks | Owner action |
|---|---|---|---|---|
| Vercel (`maw-3-ed`, `maw3ed-staging`) | Hosting, crons, logs | Production serves `d9e8ece` (`/api/version`); all 64 sitemap URLs 200 (2026-11-05) | — | Uptime monitor on `/api/health`; firewall rules for `/api/auth/*`, public booking (S-08 in `docs/security/SECURITY_REPORT.md`) |
| Neon Postgres | Database (prod, staging separate) | Every migration through `phase28_enterprise.sql` applied and verified by the owner | — | Confirm point-in-time-restore retention on the plan |
| GitHub Actions | CI, weekly off-site backup, Android E2E | CI green on `main`. **Backup: the only scheduled run (2026-11-02) failed** (F-01, fixed on this branch, not yet re-run). Android E2E fails: no APK supplied | Backups; mobile E2E | After merge, run "Database backup" once by hand and confirm the artifact; supply `E2E_APK_URL` or an Expo plan |
| Sentry | Error reporting | `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` now set in production (names listed 2026-11-05; P17-12 resolved). Client render errors now reported (F-35) | — | Alert rules (see `POST_LAUNCH_MONITORING.md`) |
| Resend | Email | `RESEND_API_KEY` set | — | Domain authentication (SPF/DKIM) check |
| Meta WhatsApp Cloud API | OTP, confirmations, reminders | Token and three templates set in production. Live delivery to real customers not evidenced in this repository | Phone sign-in, WhatsApp notices | Confirm templates approved and a real send |
| Cloudinary | Images | Keys set | — | — |
| Stripe (Canadian account) | Plan payments, international cards | Test mode end-to-end PASSED on staging (2026-11-05); live keys and webhook set. **No real live payment yet**. Account showed "payouts paused — task past due" | Plan revenue | Clear the Stripe task; rename the public business name ("Booking" → Maw3ed); one real payment and refund |
| Paymob | Booking deposits, plan payments in EGP | **No real Paymob payment has ever succeeded** (`docs/payments-verification.md`). F-10 (duplicate order id) fixed in code; Paymob's real behaviour unverified | Online deposits | Sandbox test of two orders for one booking; one live payment and refund |
| Expo / EAS | Mobile builds, push | One Android test APK built 2026-11-04 against staging; no iOS build; no store listing | Both apps | Expo plan for Maestro; Apple developer account; Play console |
| Apple App Store / Google Play | Distribution, universal/app links | `APPLE_TEAM_ID`, `ANDROID_CERT_SHA` **not set** in production, so `/.well-known/*` serve no app | Deep links, store release | Set both after the first signed builds |
| Gate / access provider | Visitor passes at a real venue | **None.** Only the sandbox adapter exists (`partnerAdapters` empty, sandbox refused on Vercel) | Real visitor access | A written agreement and interface specification |
| Emaar / Eterna | Pilot venue | Concept only (owner decision). Nothing configured; no compatibility claimed anywhere in the code or the site | Real mall pilot | Partner agreement |

## Decisions and reviews that are not engineering

| Item | Why it blocks | Reference |
|---|---|---|
| Legal entity named on privacy and terms pages | A data controller must be identifiable; the privacy page carries `VERIFY` notes for entity, retention and minimum age | `src/app/privacy/page.tsx`, F-30 |
| Terms covering money (plans, deposits, refunds, cancellation, no-shows, liability, governing law) | The site takes money; the terms page has six generic sections | `src/app/terms/page.tsx`, P17-13, F-30b |
| How deposits collected on a business's behalf reach the business (payout) | No payout or remittance code exists | Payments section of `FINAL_READINESS_REPORT.md` |
| Processor terms when a business grants an organization customer access | `[DECISION]` in the privacy draft | `docs/legal/PRIVACY_POLICY_DRAFT.md` |
| Whether walk-in / business-entered bookings may carry reviews | An owner can review their own business through a walk-in (S-02, P17-24) | `FINAL_BUG_REGISTER.md` |
| Whether the mobile "preview" profile should point at production | It is labelled staging but talks to production (M-07) | `mobile/eas.json` |
