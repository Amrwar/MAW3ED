# Conversion funnels

Phase 26. Where each funnel is shown, who may see it, and how to read it.
Event definitions: `EVENT_TAXONOMY.md`. Code: `lib/analytics/funnel-report.ts`
(`getFunnelReport(scope, days)`), view `components/analytics/FunnelReportView.tsx`.

## 1. A business's booking funnel

**Where:** Dashboard → Reports → *Booking funnel* (`/dashboard/reports/funnel`).
**Who:** the owner, and a delegate whose grant includes `REPORTS`
(`reports.read`; the path is in the delegate allow-list).
**Window:** 7, 30, 90 or 365 Cairo days (`?days=`, clamped to 1–365).

| Step | Kind |
|---|---|
| Business page opened | reported |
| Service picked | reported |
| Booking started | reported |
| Time picked | reported |
| Bookings made | recorded |
| Cancelled since | recorded |
| Repeat bookings | recorded |
| Online payment: paid / failed (of checkouts started) | recorded |
| Bookings by channel | recorded (`Booking.source`) |

Each reported step shows its share of the step before. *Bookings made* can
exceed *Time picked*: app bookings and front-desk bookings are recorded but
reported by no browser.

## 2. An organization's directory funnel

**Where:** the organization console (`/org-admin/<id>`), figures for the last
30 days (`GET /api/organizations/:id/metrics?days=7|30|90`).
**Who:** organization members with `org.metrics`.

| Figure | Source |
|---|---|
| Page visits, by channel | `OrganizationView` |
| Business pages opened from the directory | `FunnelCount BUSINESS_VIEW` credited to the organization |
| Booking started / time picked from the directory | `FunnelCount` credited to the organization |
| Bookings the directory sent, per listed business | `OrganizationBookingAttribution` joined to real bookings (no test, no abandoned checkout) |
| Bookings per visit | the above over page visits (`null` with no visits; can exceed 100% because app bookings carry the organization too) |
| Categories visitors opened | `BUSINESS_VIEW` credited to the organization, by the business's category |
| Bookings at the organization's venues | `venueMetrics` (approved tenants, since they joined) |

### Permission boundary (OWNED / MANAGED / HOSTED)

The organization funnel is **the same for every relationship** and is
always counts of what the organization's *own* directory produced:

- no customer name, phone, email or account;
- no price, amount, payment status or revenue — the organization scope of
  `getFunnelReport` returns `payment: null`;
- no per-booking rows;
- businesses it no longer lists still count in the headline (the directory
  did send those bookings) but are not named.

Revenue and per-business operating figures for OWNED and MANAGED
businesses remain in the separate portfolio report (Phase 24), gated by the
business's own `REPORTS`/`FINANCE` grant. A HOSTED mall gets nothing beyond
the counts above (QA 6.5, 6.6).

## 3. The marketplace funnel (platform)

**Where:** Admin → Reports (`/admin/reports`), last 30 days. **Who:**
`reports.read` admins.

Listing seen → searched/filtered → business page → service → started →
time → bookings made / cancelled / repeat / paid / failed, platform-wide.

## 4. Business acquisition (platform)

**Where:** Admin → Reports, second funnel. Steps: `/for-business` →
`/pricing` → `/demo` → sign-up form (reported), then *business accounts
registered* in the same window (`LifecycleEvent BUSINESS_REGISTERED`,
recorded). Onboarding after registration is the existing onboarding funnel
(`lib/admin/funnel.ts`, Phase 21).

The four reported pages are not a strict sequence — a visitor may skip
pricing — so read each as "tabs that saw this page", not as a drop-off.

## Attribution rules

| Question | Answer |
|---|---|
| Which channel gets a reported step? | The tab's first page (`?src=` or referrer). |
| Which channel gets a booking? | `Booking.source`, set from the booking page's own `?src=`/referrer when made. |
| Which organization gets a booking? | The one in `?org=` when the booking was made, only if the business was listed in it then. Never changed afterwards; webhooks never touch it. |
| Which organization gets a reported step? | The one in `?org=`, only if the business is listed in it now. |
| Does a test booking count anywhere? | No. |
| Does an abandoned checkout count as a booking? | No; it is visible only as *payment failed* or not at all. |
