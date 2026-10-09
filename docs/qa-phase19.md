# QA pass — three roles, end to end

> **Status:** every issue below is fixed. The CRITICAL and both HIGH
> issues were fixed in the QA commit; the MEDIUM and LOW ones in the
> follow-up. Each entry records what was done.

What was actually exercised, what broke, and what was not reached.

## How this was tested

Against an **isolated Postgres in Docker**, not production. A QA pass has
to create accounts, cancel bookings and attempt unauthorized actions,
and none of that belongs in a database holding real customers.

Getting there needed one change to the product: `src/lib/db.ts` spoke
only Neon's serverless protocol, so a local Postgres was unreachable and
running this project at all required production credentials. It now
picks the adapter from the host in `DATABASE_URL`.

Fixtures: two businesses with different owners (so cross-tenant access
can be attempted), one customer, and one account per admin role.
Everything tagged `qa`/`@qa.test`.

**Not tested:** real payment with a real card, real refund, real email
or WhatsApp delivery. See `docs/payments-verification.md`.

## Issues

### QA-C1 — CRITICAL — booking management page returns 500

**Role:** customer **Route:** `/booking/[token]`

The page every customer reaches from their confirmation, to view,
reschedule or cancel. It crashes.

`page.tsx` is a server component and passes an event handler to a
client component:

```tsx
{cancellable && (
  <CancelButton token={token} onCancelled={() => window.location.reload()} />
)}
```

React Server Components cannot serialise a function across that
boundary, so rendering throws:

```
Error: Event handlers cannot be passed to Client Component props.
  {token: ..., onCancelled: function onCancelled}
```

**Reproduction**
1. Book an appointment.
2. Open `/booking/<accessToken>`.

**Expected:** the booking with reschedule and cancel.
**Actual:** HTTP 500.

Proven by the `cancellable` condition:

| booking status | result |
|---|---|
| CONFIRMED (cancellable) | **500** |
| COMPLETED (not cancellable) | 200 |
| back to CONFIRMED | **500** |

So it fails exactly when the customer needs it, and works once the
appointment is past. That asymmetry is probably why it survived: a
casual check on an old booking looks fine.

**This is live in production** — the file is committed unmodified at
`c95eaf4`.

**Fixed.** The reload moved into `CancelButton`, which is already a
client component and already knows when the cancellation succeeded.
`router.refresh()` rather than a full reload, so the page keeps its
scroll position. Verified: 200, with cancel and reschedule rendering.

---

### QA-H1 — HIGH — confirmation claims an email was sent when none was

**Role:** customer **Route:** `/company/[slug]` booking widget

The confirmation screen says, unconditionally:

> تم إرسال تفاصيل الحجز ورابط الإدارة إلى بريدك الإلكتروني
> *(Booking details and the management link have been sent to your email)*

Hardcoded in `BookingWidget.tsx:1312`, with no reference to whether an
address was given, whether `RESEND_API_KEY` is set, or whether the send
succeeded. The email field is **optional**.

**Reproduction:** book without filling the email field.
**Expected:** no claim of an email, or a stated condition.
**Actual:** told to check an inbox for a link that was never sent.

The management link is how a customer cancels, which makes this worse
than a cosmetic lie — the same defect class as the password-reset
message fixed in Phase 17.

**Fixed.** Said only when there is an address. Without one it points at
the booking reference instead, which is what actually helps. Verified
by booking with the email field blank.

---

### QA-H2 — HIGH — mobile offers booking actions the API rejects

**Role:** business owner (mobile) **Route:** `PATCH /api/business/bookings/[id]`

The mobile bookings screen offers **وصل** (ARRIVED) and **ابدأ**
(IN_PROGRESS). Both return 422.

```
→ ARRIVED      422  {"error":"Invalid option: expected one of \"PENDING_PAYMENT\"…
→ IN_PROGRESS  422  …
```

`bookingStatusSchema` does not list them, and `VALID_TRANSITIONS` never
reaches them. **Introduced by me** in the mobile phase: I wrote
`nextActionsFor()` from the status enum without checking which
transitions the API accepts.

**Expected:** every offered action works, or is not offered.
**Actual:** two of five buttons always fail.

**Fixed — by making them work.** Removing the buttons was the wrong
half to change: the states exist in `BookingStatus`, are labelled in
both languages and are counted by `booking_no_overlap`. See QA-M3.
`booking-transitions.test.ts` now compares the two lists on every run.

---

### QA-M1 — MEDIUM — raw English validation messages reach the client

**Role:** all **Routes:** `POST /api/public/[slug]/bookings`, `PATCH /api/business/bookings/[id]`

```json
{"error":"Invalid input: expected string, received undefined"}
{"error":"Invalid option: expected one of \"PENDING_PAYMENT\"…"}
```

Zod's default messages, in English, in a product whose every other
error is Arabic written for a person. The booking widget renders
`{error}` directly, so these are user-visible.

**Fixed.** A global error map in `zod-arabic.ts`, installed from both
`validations.ts` and `api.ts` so a route with its own inline schema is
covered too. Deliberately vague about which field: the message reaches
a customer, and "serviceId is required" is a sentence about our data
model. Verified: a malformed booking now returns
`في بيانات ناقصة، راجع الحقول المطلوبة`.

---

### QA-M2 — MEDIUM — page titles are never translated

**Role:** all **Route:** every page

| page | ar | en |
|---|---|---|
| `/` | موعد \| MAW3ED — احجز موعدك في ثوانٍ | *identical* |
| `/businesses` | تصفح الأعمال \| موعد MAW3ED | *identical* |
| `/pricing` | الأسعار \| موعد MAW3ED | *identical* |

The body translates and `dir` flips correctly; `generateMetadata` does
not read the language cookie. English users get Arabic browser tabs,
Arabic search results and Arabic link previews.

---

### QA-M3 — MEDIUM — ARRIVED and IN_PROGRESS are unreachable states

`BookingStatus` defines them, `booking_no_overlap` counts them as
blocking a slot, and `BOOKING_STATUS_LABEL` names them in both
languages — but no API can set them. Dead states that look implemented.

**Fixed by wiring them up**, which was the honest half: the data model
and the labels already assumed they worked. `CONFIRMED → ARRIVED →
IN_PROGRESS → COMPLETED` now works end to end, `COMPLETED` stays
reachable directly from `CONFIRMED` so a busy owner need not walk
through both, and terminal states still refuse. Verified against a
running server.

---

### QA-L1 — LOW — migrations silently skip on a `db push` schema

Setting up a fresh environment with `prisma db push` followed by the
SQL migrations leaves the database **quietly wrong**: `CREATE TABLE IF
NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` become no-ops because
`db push` already made the table, so the inline `CHECK` constraints and
the `customerPhoneE164` **generated** column are never created.

Observed here: `Payment_*_chk` absent, and `customerPhoneE164` created
as a plain column that is always NULL — which silently empties every
customer's account page, since bookings are matched on it.

Production is unaffected (built by migration, not by push). The hazard
is any new environment.

**Fixed.** `repair_push_gaps.sql` checks the real catalog rather than
trusting that a guard ran, and is safe against any database. Verified
on a fresh `db push`: Payment checks 0 → 3, `customerPhoneE164`
`NEVER` → `ALWAYS`, and running it twice changes nothing.

## Results by area

### Customer — tested

| | |
|---|---|
| Homepage, search, categories, cities | pass |
| Business profile, services, next slot | pass |
| Booking: service → staff → date → time → details → review → confirm | pass |
| Validation (empty, bad phone) | pass — refuses, names the field |
| Availability reflects real bookings | pass — 24 slots → 23, 10:00 removed |
| Confirmation screen | **QA-H1** |
| Account: upcoming, history, favourites, reviews, payments, profile | pass |
| Bookings isolated between customers | pass |
| Manage booking (reschedule/cancel) | **QA-C1 — blocked** |

Reschedule and cancellation **could not be exercised** — QA-C1 blocked
the only page that offers them. The page is fixed and renders both, but
neither flow has been driven end to end. They remain untested.

### Business — tested

All 13 dashboard routes render with content and no errors. Status
transitions work for the supported set; illegal ones are refused with a
clear Arabic message (`COMPLETED → PENDING` → 400). Two transitions are
rejected outright (QA-H2 / QA-M3).

Not exercised: coupons, QR codes, booking links beyond page render.

### Admin — tested

Permissions genuinely differ, verified with real sessions per role:

| route | MODERATOR | ADMIN | SUPER_ADMIN | customer | owner |
|---|---|---|---|---|---|
| `/admin` | 200 | 200 | 200 | 404 | 404 |
| `/admin/businesses` | 404 | 200 | 200 | 404 | 404 |
| `/admin/reviews` | 200 | 200 | 200 | 404 | 404 |
| `/admin/payments` | 404 | 404 | 200 | 404 | 404 |
| `/admin/subscriptions` | 404 | 404 | 200 | 404 | 404 |
| `/admin/settings` | 404 | 404 | 200 | 404 | 404 |
| `/admin/audit` | 404 | 200 | 200 | 404 | 404 |

Non-admins get **404, not 403**, so the panel does not announce itself.
All 15 admin pages render.

### Security — tested, no issues found

30 probes, all bypassing the UI:

- Unauthenticated access to six business endpoints → 401
- Customer reaching business endpoints → refused
- One business reading, cancelling, editing or deleting another's
  booking, service and staff → refused, and the records verified
  unchanged afterwards
- Listing endpoints leak nothing across tenants
- Manipulated ids — `../../etc/passwd`, `'; DROP TABLE "Booking"; --`,
  `%00` → refused, table intact
- A **validly signed** token claiming another business's `businessId` →
  gets nothing, because `requireBusiness` re-reads ownership
- A validly signed token claiming `SUPER_ADMIN` → 404, because the role
  is re-read from the database

One caveat on method: admin APIs authenticate by cookie only, so bearer
probes against them test the cookie requirement rather than role
differences. The role matrix above was therefore redone with real
sessions. The earlier bearer run passed for the wrong reason and is not
counted.

### Booking integrity — tested

- Same slot twice via API → 409 both times
- **8 simultaneous requests for one free slot → 1 succeeded, 7 refused,
  1 row in the database.** The GiST exclusion constraint holds under
  real concurrency.

### Responsive — tested

No horizontal overflow at 320, 375, 768 or 1920 px on `/`,
`/businesses` and `/company/[slug]`.

### RTL and localization — tested

`dir="rtl"`/`lang="ar"` and `dir="ltr"`/`lang="en"` both correct, nav
translates. Titles do not (QA-M2).

### Error states — tested

| | |
|---|---|
| Unknown business, category, city, token, page | 404 |
| Path traversal in a slug | 404 |
| `GET /api/public/<unknown>` | 404, Arabic message |
| Missing query parameters | 400, Arabic message |
| Malformed booking body | 422 — **English** (QA-M1) |

Not tested: offline behaviour, expired session mid-action, notification
delivery failure.

## Three false positives I nearly reported

Worth recording, because each looked like a defect:

1. `/admin` and `/dashboard/reports/performance` failed to prerender —
   caused by `NODE_ENV=development` in my own QA env file.
2. Customers saw an empty account — my fixture stored `User.phone`
   unnormalised; the app stores it canonical (`20…`).
3. A booked slot appeared available — my fixture omitted
   `startsAt`/`endsAt`, which `createBooking` sets and which the
   overlap constraint keys on.

All three were my environment, not the product.
