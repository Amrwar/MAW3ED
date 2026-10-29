# Phase 18 report: premium UI/UX and unified booking system

Date: 2026-10-28. Branch `phase-18-ui`, on top of PR #33 (Phase 17),
which is on top of PR #32 (baseline). Read with
`docs/design/DESIGN_SYSTEM.md` (Part A) and the Phase 17 report.

## How this phase was run

The instruction was to refine, standardise and verify, not to rebuild.
So the phase began with evidence rather than opinion:

1. An inventory of the design system (tokens, utility classes, the
   `components/ui` kit) and a search for duplicated components and
   off-token styling.
2. A sweep of every key page — 37 routes × Arabic/English × 375, 768,
   1024, 1440 px — recording a screenshot, axe-core WCAG 2.1 A/AA,
   horizontal overflow, console errors, and a keyboard focus-ring pass
   (`scripts/qa-phase18.mjs`). The first run is the visual baseline;
   later runs compare pixel by pixel against it.
3. Reading the screenshots themselves, at phone and desktop widths.
4. Booking end to end through the real widget, in both languages,
   across the business shapes the fixtures have, by pointer and by
   keyboard, with validation, back-navigation, a dropped request, and
   cancellation (`scripts/qa-booking-e2e.mjs`).
5. Fixing what those found, plus the security item Phase 17 left for
   this phase (P17-10), then re-running everything on a fresh build.

## Existing functionality discovered

- **One design system already exists** ("Nasma": `src/app/globals.css`
  + `src/components/ui`). 98 tokens; **no raw Tailwind colour class
  anywhere in `src`**; a 26-piece primitive kit with a focus-trapping
  `Modal`, `Toast`, `EmptyState`, `Skeleton`, `StatusBadge`, `Table`
  with a keyboard-reachable scroll box. The public pages, dashboard and
  admin all draw from it.
- **One public business profile** (`src/app/company/[slug]` +
  `src/features/company/*`); the earlier generation (`CompanyHero`,
  `BusinessInfoRow`) was already deleted in PR #30. The mobile app has
  its own native profile over the same API, which is expected.
- **One booking widget** with configurable steps: service → provider /
  resource / branch (each only when the business has them) → day →
  time → details → review → done. State is kept on Back, errors are
  inline with `aria-invalid` + `aria-describedby`, retries reuse an
  idempotency key, focus moves to each new step and a live region
  announces it, and the end state distinguishes pending from confirmed.
- **Marketplace:** URL-synchronised query (search, city, category,
  filters, sort, page), real-link pagination, facets with counts,
  skeleton loading, an empty state that offers categories and the
  waitlist form.
- **Localisation:** Arabic default with English at `/en/...` on public
  pages; the dashboard and admin follow the language cookie (their URLs
  carry no prefix, and the sweep confirms `lang="en" dir="ltr"` there);
  key-parity tests between the two bundles.

Duplicates found: a second `StatusBadge` under
`features/dashboard/bookings` and `shared/StarRating.tsx`, both with
**zero importers**. Three pagers exist for three different jobs and
were kept on purpose (see the design-system doc).

## Changes implemented

### Design system (Part A)
- Removed the two dead duplicates.
- The booking widget and the error page set their own `font-family`
  to an undefined `--font-cairo`, so they rendered in a fallback font
  unlike the rest of the page. Both now inherit; the widget's shadow and
  border use tokens.
- `.only-ar` / `.only-en` for server-rendered fallbacks; the two
  `loading.tsx` files no longer announce in Arabic on English pages.
- `docs/design/DESIGN_SYSTEM.md` written: where everything lives, the
  rules, known debt.

### Homepage (Part B)
- Claims made true (continuing Phase 17): the "replies within 24 hours"
  promise (home, for-business, contact, 8 strings) is gone; the Pro
  badge says "Recommended" instead of "Most popular"; the "Most booked"
  row only calls itself that once at least four of six listings have
  ten or more bookings, otherwise "Newest"; the 24-hour stat tile is
  now the free plan's 30 auto-confirmed bookings, a rule the code
  enforces.
- The "Verified only" filter hint lists all of what the badge needs.

### Marketplace (Part C)
- Filter options with zero matches are no longer listed (the panel
  showed every city and category in the country with "0" beside most);
  an active zero option stays so a visitor can back out.
- "0 نشاط" is now "مفيش أنشطة" / "No businesses" (`CountForms.zero`).
- `/en` business pages show the city in English; the loading message is
  language-aware.

### Booking flow (Part E)
- Verified rather than rebuilt (19 checks, below). Test hooks added:
  `data-testid="booking-widget"` and `data-step` on the widget root.

### Dashboards (Part F)
- PROVIDER staff no longer receive the owner's private customer notes in
  the bookings list (P17-18).
- Admin: the data table is keyboard-reachable when it scrolls; a tab
  count that failed contrast fixed; the reviews page's star rows carry
  `role="img"` (axe `aria-prohibited-attr`).

### Security carried over from Phase 17
- **P17-10 fixed.** Changing an account's email no longer writes the
  new address; a confirmation link is sent to it and the address becomes
  the account's only when the link is followed. Uniqueness is checked
  case-insensitively, and the migration adds a unique index on
  `lower(email)` after lower-casing existing addresses. The web and
  mobile profile screens say a change is pending; the mobile client
  keeps the old address until then.
- **P17-19 fixed.** A re-opened verification link no longer republishes
  a suspended or rejected business.

## Files and migrations changed

- **Migration (new, run before deploy):**
  `prisma/migrations/phase18_email_change.sql`: adds
  `EmailVerificationToken."email"`; lower-cases `User.email` and adds
  the unique index on `lower(email)`, unless two accounts already differ
  only by case (then a NOTICE and the query to find them). Idempotent;
  applied twice to the QA database.
- **Schema:** `EmailVerificationToken.email`.
- **Auth/account:** `src/app/api/account/profile/route.ts`,
  `src/app/api/auth/verify-email/confirm/route.ts`,
  `src/app/verify-email/page.tsx`, `src/app/account/_components/ProfileForm.tsx`,
  `src/lib/account/queries.ts`; mobile `types/api.ts`,
  `features/customer/queries.ts`, `app/me/profile.tsx`.
- **UI:** `BookingWidget.tsx` (root), `ErrorPage.tsx`, `globals.css`,
  `businesses/loading.tsx`, `dashboard/loading.tsx`, `FilterPanel.tsx`,
  `CompanyContent.tsx`, `company/[slug]/page.tsx`, `types/business.ts`,
  `WhyJoin.tsx`, `app/page.tsx`, `admin/_components/AdminBits.tsx`,
  `admin/businesses/_components/BusinessesClient.tsx`,
  `dashboard/reviews/_components/ReviewsClient.tsx`,
  `api/business/bookings/route.ts`, `src/lib/i18n.ts`.
- **Removed:** `features/dashboard/bookings/StatusBadge.tsx`,
  `components/shared/StarRating.tsx`.
- **Tests (new):** `scripts/qa-phase18.mjs`, `scripts/qa-booking-e2e.mjs`,
  `api/account/profile/route.test.ts`,
  `api/auth/verify-email/confirm/route.test.ts`.
- **Docs:** `docs/design/DESIGN_SYSTEM.md`, this report, and the
  roadmap files.

## Architectural decisions

- **Verify the existing booking widget, do not replace it.** It already
  met Part E's list; a rewrite would have been the broad redesign the
  phase forbids.
- **English in the dashboard follows the cookie, not the URL.** Public
  pages have `/en` addresses for crawlers and sharing; private pages do
  not need them. Kept, and documented.
- **A pending email lives on the verification token**, not on a new
  `User` column: the token already has the lifetime, the hash and the
  send path, and the account's address is never in an unverified state.
- **Evidence scripts are committed**, with local-only guards, so the
  next phase re-runs them instead of trusting this report.

## Security implications

Two closed: pre-registration account takeover through an unverified
email change (P17-10), and republishing a taken-down business through
an old link (P17-19). One narrowed: private customer notes to PROVIDER
staff (P17-18). The migration's lower-casing changes stored addresses;
sign-in already matched case-insensitively, so nobody's login changes.

## Automated test results (actual commands, 2026-10-28, final build)

| Command | Result |
|---|---|
| `npx tsc --noEmit` (web) / `cd mobile && npx tsc --noEmit` | both exit 0 |
| `npx eslint` | 0 errors, 6 warnings (the baseline's 6) |
| `npx vitest run` | **978 passed**, 39 skipped (1017), 83 files |
| `cd mobile && npx vitest run` | 199 passed, 10 skipped |
| `api/account/profile/route.test.ts` against the old route | 4/6 FAIL (the new test catches the defect); new route 6/6 |
| `npm run build` | exit 0 |
| `node scripts/qa-booking-e2e.mjs` | **19/19**: Arabic staff business at 390 px (booked, assigned a real member, email on the booking, screen state = DB state); English restaurant (table + party size 3 stored); keyboard selection, Tab to Next, focus moved into the new step, live-region announcement; empty-form refusal with `aria-invalid` + described errors; bad phone refused, fix accepted; Back keeps name and time; dropped request → error shown, retry books exactly once; cancel from the manage link → CANCELLED and the button gone; 22 existing addresses answer as before |
| `node scripts/qa-phase18.mjs` (final) | **320 page loads** (anon 176, owner 96, admin 48): **0 overflow, 0 serious/critical axe violations, 0 missing focus rings**; console errors only on the deliberate 404 page (a 404 resource line) |
| Visual comparison, final vs previous run | 5 pages changed: `/` and `/en` at 375 (the stat tile), `/en/contact` (the copy). Everything else within 1% |
| Visual comparison, first run vs baseline | The search-result pages got 190 px shorter at ≥1024 px (the filter panel without empty options); nothing else |

Not run: Maestro (mobile E2E), real email delivery of the confirmation
link, screen-reader sessions with a real AT (semantics checked through
axe and the role/aria assertions only).

## Manual checks

Screenshots read at 375 and 1440 px in both languages: home, browse,
business page (salon, restaurant, staff business), pricing, manage-
booking page, dashboard home and bookings, booking summary/error/
cancelled states. No layout defects found beyond the ones fixed above.

## Unresolved issues

- Playwright and the two QA scripts still run by hand, not in CI (needs
  a Postgres service in the workflow).
- P17-11 (fire-and-forget notifications), P17-14 (deletion anonymising),
  P17-16/17 (status races, discounts), and the owner items (Sentry DSN,
  terms, secrets) remain open from Phase 17.
- The restaurant fixture has no opening hours; the E2E script adds them
  for its run. `scripts/qa-fixtures.mjs` should give it some.
- Design debt listed in `DESIGN_SYSTEM.md` (two oversized components,
  legacy colour aliases).

## Code review of this phase's changes

A review of the diff before handoff found ten problems in the first
version of the email-change work and the filter panel; all are fixed
and covered by tests:

| # | Problem | Fix |
|---|---|---|
| 1 | An email change did not publish a business held back at signup, so an owner who corrected a mistyped address could never go live | Any verified address publishes (a taken-down business still does not) |
| 2 | "Resend the link" wiped a pending change and mailed the old address | Resend goes to the pending address and keeps it a change (`send/route.test.ts`) |
| 3 | "Pending" kept showing for 24 h after the change was applied | `pendingEmailFor` excludes a token whose address is already the account's |
| 4 | Clearing or re-saving the address did not cancel a pending change | Both withdraw it |
| 5 | A throttled or failed link discarded the name edit sent with it | Other fields are saved first |
| 6 | The pending banner vanished after an unrelated save | PATCH echoes the live pending address |
| 7 | The `lower(email)` index is invisible to Prisma and would be dropped by `db push` | Documented in the schema and the migration; migrations here are hand-written SQL only |
| 8 | Hidden filter options left empty `<li>`s behind | Filtered at the list (`offered`) |
| 9 | The cooldown counted the signup link, refusing a correction made within a minute of signing up | Only change links count |
| 10 | The "changed"/"taken" result pages offered a resend button | They link to the account page |

## Deployment considerations

1. Merge #32 → #33 → this PR, in order.
2. Before this PR deploys, run `prisma/migrations/phase18_email_change.sql`
   on production (and `phase17_booking_integrity.sql` before #33). Read
   the NOTICE: if two accounts differ only by case, the index is not
   added and the listed accounts need merging by hand first.
3. Mobile app users on the current store build keep working: the profile
   API's response shape is unchanged, with `pendingEmail` added.

## Acceptance criteria

| Criterion | Status |
|---|---|
| One coherent design system | MET: documented; duplicates removed; stale fonts removed; no off-token colour |
| No conflicting generations of public business profiles | MET: one profile; the earlier one was already gone |
| No dead ends in core customer journeys | MET: booking, retry, cancel, 404, empty search all lead somewhere (E2E + sweep) |
| Booking works across supported business types | MET: staff, restaurant/table, plain; by pointer and keyboard |
| Arabic and English both verified | MET: every page in both languages at four widths; booking in both |
| Relevant accessibility regressions resolved | MET: 0 serious/critical axe findings on 320 loads; focus visible everywhere checked |
| Automated visual and behavioural tests passing | MET: sweep with pixel comparison, 19/19 journeys, 971 unit tests |
| No regressions in booking or accounts | MET: Phase 17's DB and route tests still pass; account tests added |

## Final verdict

**PASS** for code complete and locally verified. Production: NOT
VERIFIED until the PRs are merged and both migrations run. Staging: NOT
RUN (none exists).
