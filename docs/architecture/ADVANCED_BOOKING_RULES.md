# Advanced booking rules

Phase 27, module A and the vertical modules D–F, H. Everything here goes through the core
engine (`src/lib/bookings/create.ts`): the slot is re-derived on the server, writes are
queued per business, and the exclusion constraints (`booking_no_overlap`, `_resource`,
`_staff`) are the final word under a race. Nothing in this phase writes a booking any other
way except the desk route, which keeps its Phase 17 rule (no slot check, constraints only).

## Recurring appointments — `lib/bookings/series.ts`

- The same service and time every 1–4 weeks, 2–12 times. The database bounds it
  (`BookingSeries_bounds_chk`), so no series runs on for ever whatever writes it.
- Each occurrence is an ordinary booking made through `createBooking`, with its own slot
  check, idempotency key `series:<id>:<n>` and `(seriesId, seriesIndex)` unique — retrying
  makes only what is missing.
- An occurrence that cannot be had is **skipped and reported** (`skipped[{index, date, why}]`),
  never squeezed in.
- Ending a series cancels each upcoming occurrence through the state machine (so a
  discount, points or a session it used comes back) and marks it CANCELLED.
- Made at the desk (`POST /api/business/series`, `bookings.create`); customers do not create
  series online in Phase 27.

## Group and party bookings

- A group reservation is one booking with `partySize`, capacity-checked against tables or
  rooms (existing engine: `party-too-large` when no resource seats it) — restaurants and
  group visits.
- `companions` (0–5 per business, `maxCompanions`) records people accompanying the customer
  (a clinic visit); it holds no extra slot.
- **Not built:** classes where many separate customers share one capacity (a yoga class of
  12). The overlap constraints treat every booking of a resource as exclusive; shared
  capacity needs a different constraint design. Documented as out of scope.

## Multiple services

**Not built as one booking.** Several services back to back (cut + colour) would need an
all-or-nothing group of bookings in one transaction with staff continuity. In Phase 27 a
customer books them as separate bookings; the desk can do the same. Marked INCOMPLETE in
the acceptance matrix rather than half-built.

## Staff and resources

Unchanged engine rules: "anyone available" is given a free member of staff, "any table" the
smallest free one that fits; a named one must be free. The desk route now takes a staff
member and a resource (checked to belong to the business). Buffers remain the business's
`bufferMinutes`.

## Walk-ins

`POST /api/business/bookings` with `walkIn: true`: booked from now on the Cairo clock,
status ARRIVED, `walkIn = true`. Still needs a phone number (it is how history, points and
packages follow the customer); landlines are accepted at the desk. The overlap constraints
apply: a walk-in cannot take a chair that is already busy.

## Slot waitlist — `lib/bookings/slot-waitlist.ts`

- A customer leaves a window on a full day (`POST /api/public/:slug/waitlist`). One live
  entry per number per business per day (partial unique index), at most 50 live per day.
- When a time frees (a cancellation, a failed payment, the reaper), it is offered **after
  the transaction commits** (`after()`), and every 10 minutes by the operations cron in any
  case. One offering pass per business-day at a time (advisory try-lock — two concurrent
  passes could otherwise offer the same time to two people; caught by a database test).
- **Priority:** oldest entry first among those whose window and service fit. An offer holds
  nothing: it is a link, valid `waitlistOfferMinutes` (10–240). Accepting books through the
  engine; if somebody else took the time, the entry goes back to waiting.
- **Bounded:** at most 3 offers per entry (`SlotWaitlistEntry_offers_chk`), then EXPIRED;
  days that passed close their entries.
- Accepting is idempotent (`waitlist:<entry>:<offer n>`); a second tap returns the same
  booking. A number restricted by the no-show policy is told to call.
- Where the business takes deposits, a booking taken from the waitlist link has no online
  payment and waits for the owner (PENDING).

## Cancellation slot recovery

The waitlist above is the recovery: every path that releases a time (`releaseBookingHold`)
gives back offers, points and sessions and triggers offering.

## Cancellation rules, rebooking

- The existing per-business cutoff (`cancellationCutoffHours`) and transition tables are
  unchanged.
- Rebooking links carry the service and staff member (`rebookHref`), on the account's past
  bookings, the booking page and automation messages.

## No-show policy — `lib/bookings/no-show.ts`

Off by default. With `noShowLimit` set, a number with that many NO_SHOW bookings at the
business within `noShowWindowDays` (30–730) either must pay a deposit to book online
(`REQUIRE_DEPOSIT`: the business's deposit percentage; if its plan cannot take deposits,
the number is asked to call) or cannot book online (`BLOCK_ONLINE`, `no-show-blocked`).
The desk can always book them. Test bookings are exempt.

## Deposits and packages

Deposits are unchanged (a share of what is owed after offers and points; nothing on a zero
total). A booking paid by a package session or membership visit costs 0: no deposit.

## Automations — `lib/automations`

The operations cron (`/api/cron/operations`, every 10 minutes) runs, each bounded per run
and isolated from the others: waitlist sweep, loyalty lot expiry, package/membership
expiry, follow-ups, rebook nudges, membership renewal notices, points-expiring notices,
package-expiring notices, and retries of failed messages.

- Every message is claimed on the notification ledger (`NotificationDelivery`) under a
  unique key before it is sent: a cron that runs twice says it once.
- Failures retry on the outbox backoff and stop at 5 attempts (DEAD).
- **Consent:** follow-ups and rebook nudges are marketing: only to an account that switched
  marketing on (`User.marketingConsentAt`, off by default, `PATCH /api/account/profile`),
  at most 2 per number per business per week. Waitlist offers, renewal and expiry notices are
  transactional (about something the customer holds or asked for) and need no marketing
  consent, but honour the account's email switch.
- Channels: in-app, push and email. WhatsApp/SMS are not used for these (WhatsApp needs
  approved templates per message; SMS has no provider).
- Nothing reacts to a message being sent: no job feeds another.

## Verticals

| Vertical | What Phase 27 adds |
|---|---|
| Salon | staff commission % (owner-only), per-staff daily report with commission, chairs as resources, walk-ins, packages and memberships at the desk |
| Restaurant | tables and sections (`Resource.area`), party size and capacity (existing), guests and turnover per table and section in the operations report, no-show policy, waitlist |
| Clinic | service categories (`Service.groupName`), rooms as resources, recurring visits, companions, reminders (existing), cancellation rules (existing), a report that is counts only — no patient name or number. **No medical records** (EMR is out of scope) |
