# Event taxonomy

Phase 26. Every figure Maw3ed shows about traffic and conversion comes from
one of the sources below, and nothing else. There is no third-party
analytics script, no cookie and no visitor identifier.

## Two kinds of number

| Kind | Source | Written by | Trust |
|---|---|---|---|
| **Reported** | `FunnelCount`, `ProfileView`, `OrganizationView` | the visitor's browser, after a page or step is reached | Deduplicated, rate-limited counts of tabs. Can be lower than reality (blockers, storage off, the app) and is never used to make a decision for anybody |
| **Recorded** | `Booking`, `Payment`, `OrganizationBookingAttribution`, `LifecycleEvent` | the server, as part of the action itself | Authoritative: the same rows the business works from |

Recorded steps are **never** reported by a browser. A booking is confirmed
because a `Booking` row exists, not because a page said so.

## Reported steps (`FunnelStep`)

Each is counted **once per browser tab, per subject, per Cairo day**.

| Step | Where it fires | Subject | Code |
|---|---|---|---|
| `MARKETPLACE_VIEW` | `/businesses` mounted | — | `BusinessesClient.tsx` |
| `SEARCH` | `/businesses` with a query or any filter | — | `BusinessesClient.tsx` (`hasActiveFilters`) |
| `ORGANIZATION_VIEW` | `/groups/<slug>` | the organization | `groups/[slug]/page.tsx` |
| `BUSINESS_VIEW` | `/company/<slug>` | the business (+ the organization from `?org=`) | `company/[slug]/page.tsx` |
| `SERVICE_SELECTED` | a service picked in the booking panel | business (+ org) | `BookingWidget.tsx` |
| `BOOKING_STARTED` | the panel moved past the service step | business (+ org) | `BookingWidget.tsx` |
| `TIME_SELECTED` | a time picked | business (+ org) | `BookingWidget.tsx` |
| `FOR_BUSINESS_VIEW` | `/for-business` | — | `for-business/page.tsx` |
| `PRICING_VIEW` | `/pricing` | — | `pricing/page.tsx` |
| `DEMO_VIEW` | `/demo` | — | `demo/page.tsx` |
| `SIGNUP_VIEW` | the sign-up form | — | `(auth)/signup/page.tsx` |

Payload (`POST /api/public/funnel`): `{ step, tab, source, business?, org? }`.

- `tab` — 16 random bytes, base64url, made in the browser and kept in
  `sessionStorage` (`mw:tab`). It dies with the tab. It is not a cookie,
  never tied to an account, and never stored by the server in the clear.
- `source` — the channel of the tab's **first** page (`?src=` or referrer,
  `lib/attribution/source.ts`), kept in `sessionStorage` (`mw:src`). A
  visitor who came from Instagram and browsed on is still an Instagram
  visit at the booking step.
- `business`, `org` — slugs. The server resolves them and **refuses**
  anything not public: an unpublished business is ignored; an organization
  is credited only when the business is listed in its public directory
  (the same rule as booking attribution), so a request cannot invent an
  affiliation. Site-wide steps are never tied to a business, whatever the
  request says.

## Deduplication

Two layers, either sufficient on its own:

1. **Browser** (`lib/analytics/funnel-client.ts`): a step already sent from
   this tab today (`sessionStorage` key `mw:f:<step>|<business>|<org>|<day>`)
   is not sent again — re-renders, React's double effects in development,
   back/forward, a reload, a language switch.
2. **Server** (`lib/analytics/funnel.ts`): one SQL statement inserts a keyed
   hash of `(tab, step, business, org, day)` into `FunnelSeen` and, only if
   that row is new, increments `FunnelCount`. The primary key decides races:
   eight simultaneous reports from one tab count once (QA 5.2).

`FunnelSeen` rows are deleted after two days by the daily cron
(`/api/cron/subscriptions` → `pruneFunnelSeen`).

## Recorded steps

| Step | Rule | Code |
|---|---|---|
| Booking made | a non-test `Booking` created in the window whose status is not `PENDING_PAYMENT`/`FAILED_PAYMENT` | `funnel-report.ts` |
| Payment started / paid / failed | the booking has a `Payment` of kind `BOOKING_DEPOSIT` or `BOOKING_FULL`; paid = any `SUCCEEDED`/`REFUNDED`/`PARTIALLY_REFUNDED`; failed = a `FAILED` and none paid | `funnel-report.ts` |
| Cancelled | of the bookings made, status `CANCELLED` now | `funnel-report.ts` |
| Repeat booking | an earlier non-abandoned, non-test booking at the same business by the same customer (account or E.164 phone) | `funnel-report.ts` |
| Booking channel | `Booking.source`, set when the booking is made | existing (Phase H) |
| Organization referral | `OrganizationBookingAttribution`, written once when the booking is made with `?org=` | `organizations/public.ts` |
| Business registered | `LifecycleEvent BUSINESS_REGISTERED` | existing (Phase 21) |

## Older counters, unchanged

- `ProfileView` — business page views by channel and day, rate-limited, not
  deduplicated per tab (it predates this phase; its figure is "views", the
  funnel's is "tabs").
- `OrganizationView` — the same for organization pages.

## What is never collected

IP address, cookie id, user agent, device id, account id or phone in any
counter; any third-party script; any cross-site identifier. Nothing in this
taxonomy needs consent, and nothing needs deleting on an account deletion.

## Known gaps

- The mobile app reports no funnel steps; its bookings appear in the
  recorded steps (made, paid, cancelled, repeat) and carry their channel.
- A visitor with `sessionStorage` disabled sends nothing.
- An owner viewing their own published page is counted, as in `ProfileView`.
