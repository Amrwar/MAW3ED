# Phase 20 — responsive, accessibility, and the journeys Phase 19 missed

Two passes in one branch:

1. **The gaps Phase 19 recorded but did not reach**: reschedule, cancel,
   completed bookings and reviews, coupons, booking links, QR codes,
   signup and email verification, and the error states it skipped.
2. **Responsive behaviour on real device profiles**, with accessibility
   and mobile performance.

Nothing here was tested on a physical phone. Every "phone" below is an
emulated device profile. See *How this was tested*.

## How this was tested

- **Database.** An isolated Postgres 17 in Docker (`maw3ed-qa`, port
  5450), never production. Schema by `db push` plus the SQL migrations
  and `repair_push_gaps.sql`. Data from `scripts/qa-fixtures.mjs`, plus
  the new `scripts/qa-layout-fixtures.mjs`. The second script adds 11
  businesses, long Arabic and English names, photos, 9 services,
  3 staff, 2 branches and reviews long enough to wrap. An empty page
  cannot overflow.
- **Server.** A production build (`next build && next start`). Every
  production key was overridden locally: Paymob, WhatsApp, Cloudinary
  and Sentry were blank.
  - Email went to a local stand-in for the Resend API, which recorded
    each message and could be told to fail.
- **Browsers.** Playwright 1.63.
  - iPhones and iPads ran in **WebKit** (Safari's engine), with the
    device's real viewport, pixel density, touch and mobile user agent.
  - Android and desktops ran in Chromium.
  - Every page reported its own `innerWidth`, and a mismatch counted as
    a failure. Resizing a desktop Chrome window cannot go below about
    500px, which is how an earlier pass came to believe it had tested
    phone widths.
- **Two artifacts of testing over plain http.** Neither affects
  production:
  - WebKit applies `upgrade-insecure-requests` and HSTS to `localhost`;
    Chromium exempts it. Over http, WebKit therefore loads no CSS or
    JS.
  - The harness strips those two directives from document responses and
    nothing else.
  - A few WebKit-only console errors on the dashboard come from
    background RSC prefetches being upgraded the same way. Chromium
    shows none.

### Devices

| Profile | Engine | Viewport |
|---|---|---|
| Small iPhone (SE 3rd gen) | WebKit | 375×667 @2x |
| Large iPhone (15 Pro Max) | WebKit | 430×739 @3x |
| Android (Pixel 7) | Chromium | 412×839 @2.6x |
| Narrow Android (Fold, folded) | Chromium | 344×882 @3x |
| Narrowest phone | Chromium | 320×568 @2x |
| Phone landscape (SE) | WebKit | 667×375 |
| Small tablet (iPad Mini) | WebKit | 768×1024 |
| Large tablet (iPad Pro 11, landscape) | WebKit | 1194×834 |
| Laptop / desktop / wide | Chromium | 1366, 1920, 2560 |

Every profile was run in Arabic (RTL) and English (LTR).

### Pages

- **Public:** home, search, categories, category, cities, city,
  city+category, business profile (rich and sparse), pricing,
  for-business, contact, FAQ, privacy, terms, login, signup,
  phone login, forgot password, 404.
- **Customer:** account overview, upcoming, history, favourites,
  notifications, reviews, payments, profile, settings, the
  notifications page, the booking management page, every step of the
  booking widget.
- **Business:** dashboard, bookings, calendar, customers, services,
  staff, branches, offers, links, reviews, reports, settings, billing,
  and the mobile menu.
- **Admin:** overview, businesses, bookings, customers, reviews,
  payments, audit, settings.

In all, about 900 page loads with layout measurement. axe-core
(WCAG 2.2 AA) ran on 25 pages at phone and laptop sizes in both
languages.

## Results

### Customer journeys (gap pass)

| Step | Result |
|---|---|
| Book through the widget: service → staff → branch → date → time → details → summary | pass |
| Booking stores the chosen staff and branch | pass |
| Confirmation email to the customer and the business | pass (captured) |
| Phone OTP login → account → upcoming lists the booking | pass |
| Reschedule from the booking page | **failed → fixed** (G4) |
| Cancel from the booking page; email sent; actions removed afterwards | pass |
| Booking completed by the owner → review form offered → review stored and shown on the profile | pass |
| Second review on the same booking | refused (409) |
| Review on a booking that is not completed | refused (400) |
| Booking page for every status | **failed → fixed** (G1) |
| Account links to `#reschedule`, `#cancel`, `#review` | **failed → fixed** (G6, G7) |

### Business

| Step | Result |
|---|---|
| Create a fixed-amount coupon | **failed → fixed** (G3) |
| Coupon applied in the widget; summary and done screen | **done screen failed → fixed** (G5) |
| Booking links page lists per-channel links | pass |
| QR code as SVG and PNG | pass |
| Booking through `?src=instagram` is attributed to INSTAGRAM | pass |
| Signup → verification email → link → verified; link reuse refused | pass |
| Staff accounts with limited permissions | **not testable.** There is no staff login: `StaffMember` has no user, and `requireBusiness` checks ownership only. |

### Error states

| Case | Result |
|---|---|
| Offline at the moment of confirming a booking | pass: says to check the connection, keeps the form |
| Email provider returning 500 | pass: the booking succeeds; the delivery is recorded `FAILED` |
| Session expiring mid-save on the dashboard | **issue** (G11) |
| Unknown or deleted booking token | 404 |
| Unknown service in `?service=` | page renders, no error |

### Payments and notifications

- No real card was charged and no real refund was made.
  `docs/payments-verification.md` still applies.
- Email: each event's message was captured. The failure path is
  recorded in `NotificationDelivery`.
- WhatsApp and SMS: not configured. The ledger records `SKIPPED`
  honestly.

### Responsive

- **Before:**
  - `/dashboard/branches` was 549px wide on a 375px phone, on every
    phone in both languages; Android zoomed the whole page out to fit.
  - Every other page fit at every width down to 320px.
- **After:** no page in the list overflows on any profile.
  - `scripts/qa-responsive.mjs` holds that check and fails the run if it
    stops being true.

### RTL and localization

- `dir` and `lang` are correct everywhere.
- Mirrored correctly: layout, icons, the booking date strip, sticky
  bars and tables.
- The dashboard's mobile menu was forced to RTL. Fixed (R5).
- Remaining: G12 and G13.

### Accessibility

- **Before:**
  - 3 critical rules: unnamed buttons, unlabeled selects.
  - Serious rules: contrast in about 250 places, list and definition
    list markup, a scroll region unreachable by keyboard.
  - A closed menu in the tab order.
- **After:** axe reports **zero violations** on all 25 pages scanned, at
  both sizes, in both languages.

## Issues

| ID | Severity | Role | Route | Issue | Status |
|---|---|---|---|---|---|
| G1 | CRITICAL | customer | `/booking/[token]` | **500 for `PENDING_PAYMENT` and `FAILED_PAYMENT`**: the status map had no entry. These are the customers whose payment just failed. | **fixed** |
| G2 | HIGH | customer | `/booking/[token]`, cancel and reschedule APIs | **The 2-hour cutoff read Cairo wall-clock as UTC**, so a booking 90 minutes away could still be cancelled, by the page and by the API. | **fixed** |
| G3 | HIGH | business | `/dashboard/offers` | **"50" under "المبلغ بالجنيه" was stored as 50 piastres**, so customers got 0.50 EGP off. 12.50 was refused. | **fixed** |
| G4 | HIGH | customer | `/booking/[token]` | **Reschedule offered times the server then refused (409)**: slots were fetched without the booking's staff and branch. | **fixed** |
| R1 | HIGH | customer | `/businesses` | **Every filter change moved focus to the sheet's Close button**; Enter in the price box closed the phone keyboard. Cause: the Modal re-ran its setup on every parent render. | **fixed** |
| R2 | HIGH | business | `/dashboard/branches` | **The page was 549px wide on a 375px phone.** An sr-only label escaped the table's scroll box. | **fixed** |
| R3 | HIGH | business | all `/dashboard` | **The closed mobile menu stayed in the tab order and the accessibility tree**: 25 invisible stops. | **fixed** |
| R4 | HIGH | business | all `/dashboard` | **Mobile menu links were #BACBC4 on white** (1.7:1). These were the dark sidebar's colours. | **fixed** |
| G5 | MEDIUM | customer | widget done screen | The total showed the list price after a coupon. | **fixed** |
| G6 | MEDIUM | customer | `/account` | Links to `#reschedule`, `#cancel` and `#review` had no target. | **fixed** |
| G7 | MEDIUM | customer | `/account` | Reschedule and cancel were offered on bookings that cannot be changed. | **fixed** |
| G8 | MEDIUM | customer | `/booking/[token]` | A link nested in a link threw away the server render (React #418). | **fixed** |
| G9 | MEDIUM | customer | widget | Sunday and Wednesday were both labelled "الأ"; 9px labels. | **fixed** |
| G10 | MEDIUM | customer | `/company/[slug]` (EN) | Services showed Arabic names even when an English one existed. | **fixed** |
| R5 | MEDIUM | business | all `/dashboard` (EN) | The mobile menu was hard-coded RTL. | **fixed** |
| R6 | MEDIUM | customer | `/company/[slug]` | The page scrolled itself ~120px on load, and the first Tab skipped the header. | **fixed** |
| R7 | MEDIUM | customer | `/company/[slug]` | The sticky "Book now" bar covered the booking form; ~19% of a landscape phone. | **fixed** |
| R8 | MEDIUM | all | 39 files | The "faint" token (#B6BEB9, 1.8:1) was used for text 62 times. | **fixed** |
| R9 | MEDIUM | all | site-wide | Brand jade on jade-soft measured 4.36:1. The token moved #0E7F5E → #0D7A5A (4.66:1). | **fixed** |
| R10 | MEDIUM | business | settings | Image change/remove controls appeared on hover only, so they were invisible on touch screens. | **fixed** |
| R11 | MEDIUM | business | settings | No field on the profile form had a label. | **fixed** |
| R12 | MEDIUM | business | dashboard | The notification bell and the image remove button had no name. | **fixed** |
| R13 | LOW | all | `/pricing` | The comparison table scrolled but could not be reached by keyboard. | **fixed** |
| R14 | LOW | various | — | List and definition-list markup; footer, pricing-header and status-text contrast. | **fixed** |
| G11 | MEDIUM | business | dashboard forms | An expired session mid-save shows "غير مصرح" with no route to log in. The typed data is kept. | remaining |
| G12 | MEDIUM | customer | widget, `/booking/[token]` | Hard-coded Arabic and `dir="rtl"` whatever the language. | remaining |
| G16 | MEDIUM | customer | `/account-login` | The OTP send answers `{sent:true}` even when WhatsApp did not send. | remaining |
| G13 | LOW | all | — | Arabic plurals: "7 تقييم", "9 خدمة". | remaining |
| G14 | LOW | customer | profile, booking page | A 0 EGP service reads "السعر غير محدد" rather than free. | remaining |
| R15 | LOW | customer | `/company/[slug]` landscape | The header and section tabs still take ~30% of a landscape phone. | remaining |
| R16 | LOW | all | breadcrumbs, back links | Touch targets are 16–20px tall (WCAG 2.5.8 minimum is 24px). | remaining |
| R17 | LOW | — | 13 components | `overflow-x-auto` boxes without `relative`. Same hazard as R2; nothing currently inside them escapes. | remaining |

### Recommended fixes for what remains

- **G11:** handle 401 in one place, a shared fetch wrapper for dashboard
  mutations. It should keep the form and offer to log in again.
- **G12:** move the widget's and the booking page's strings into
  `i18n.ts`.
- **G16:** return the send outcome, or at least log it, before telling
  the client a code went out.
- **R16:** give breadcrumb links vertical padding: `min-h-6` at least,
  `min-h-11` where space allows.
- **R17:** add `relative` when one of those boxes gets positioned
  content, or as a sweep.

## Performance

Measured on Pixel 7 emulation with a cold cache, against the production
build.

| | Before | After |
|---|---|---|
| JS per page (gzip) | ~280–300KB | unchanged |
| `/company/[slug]` HTML (decoded) | 156KB | 138KB, with one more review than before |
| `/company/[slug]` HTML (gzip) | 24KB | 24KB |
| Inline SVG on the profile | 128 elements, 64KB, 48 stars | stars are one masked shape |

The star change is a parse and DOM saving (about 100 fewer nodes on a
phone), not a bandwidth one. Repeated SVG compresses almost to nothing.

Where the shared JavaScript goes, per the Turbopack analyzer, on every
page including `/privacy`:

- **Next.js and React (~250KB):** the baseline.
- **Sentry (~75KB gzip):** shipped even when `SENTRY_DSN` is empty.
  *Recommendation:* load it only when a DSN is set.
- **`src/lib/i18n.ts` (~22KB gzip):** both languages, on every page.
  *Recommendation:* split by language and load the other on toggle.
  - This saves ~11KB on a first visit only, since the file is cached
    after, and makes the toggle asynchronous.
  - Not done in this phase.

The business profile's own JavaScript is ~22KB gzip. It is not the
problem the brief suspected. Its weight is the shared bundle above.

## Tests

- `src/lib/bookings/self-service.test.ts`: the Cairo-clock cutoff,
  including summer time, winter time and midnight.
- `src/lib/responsive-rules.test.ts` holds the construction behind each
  layout and focus fix:
  - Modal setup and the price input
  - the Table containing block and keyboard access
  - the date-strip labels
  - reschedule slot parameters
  - the sticky bar
  - booking page status coverage, anchors and link nesting
  - drawer `inert`, colours and direction
  - upload controls without hover
  - the profile tab scrolling
  - account card gating
- `src/lib/discounts/money-entry.test.ts`: pounds to piastres; the
  discounted total in the booking response.
- `scripts/qa-responsive.mjs`: the browser check itself. It runs 10
  device profiles in both languages and exits 1 if any page is wider
  than its screen or a viewport is not the size it claims.

695 tests pass (668 before), `tsc` is clean, and lint has no errors.

## Not done

- **Real devices:** no physical phone or tablet was used.
- **Real money:** no real card charge or refund.
- **Real delivery:** no real email or WhatsApp was delivered.
- **Admin:** the role matrix was not retested this phase. Phase 19's
  stands.
