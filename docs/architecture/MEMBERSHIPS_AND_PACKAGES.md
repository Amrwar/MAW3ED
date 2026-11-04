# Memberships and packages

Phase 27. Code: `src/lib/entitlements/rules.ts` (pure), `src/lib/entitlements/ledger.ts`
(every write). Schema: `PackagePlan`, `CustomerPackage`, `MembershipPlan`,
`CustomerMembership`, `MembershipPeriod`, `EntitlementUse`; `Payment.kind` PACKAGE and
MEMBERSHIP (`phase27_enums.sql`, `phase27_operations.sql`).

## What they are

- **Package**: N sessions bought ahead (e.g. 5 haircuts), for named services (or any),
  usable until it expires (`validityDays`, 7–730).
- **Membership**: a fee per period (`periodDays`, 7–366) that includes visits per period
  (`includedVisits`). Each paid period is a `MembershipPeriod` row with its own `used`
  count; a visit counts against the period its **appointment** falls in.

A sale copies the plan's sessions, services, visits and price, so changing or switching off
a plan never changes what a customer already bought.

## Selling

At the desk only in Phase 27: cash or card at the counter, recorded as a `Payment` with
`provider = MANUAL`, `kind = PACKAGE | MEMBERSHIP` and a receipt number
(`POST /api/business/packages/sell`). `Payment_target_chk` ties each kind to exactly one
target. **Selling online through Paymob is not built** — see the report.

## Using

A booking uses one session or visit through `consumeEntitlement`, **inside the booking's
own transaction** (`createBooking`, and the desk route). Each is one conditional UPDATE
whose WHERE carries every rule:

- package: same business, same phone, `ACTIVE`, `sessionsUsed < sessionsTotal`, not expired
  at the appointment's real start, service covered → `sessionsUsed + 1` (EXHAUSTED at the last);
- membership: same business, same phone, membership `ACTIVE` (not paused), a period
  containing the appointment's real start with `used < includedVisits`, service covered.

If no row matches, `EntitlementGone` rolls the booking back (`entitlement-gone`). The CHECKs
`CustomerPackage_sessions_chk` and `MembershipPeriod_use_chk` are the floor: no negative balance,
never more than bought. `EntitlementUse.bookingId` is unique: a booking consumes at most
once. A booking that uses one costs 0 and takes no offer, points or deposit.

The appointment's **real instant** is compared (`wallToInstant`), not the stored wall-clock
`startsAt`: package expiry and periods are instants, and mixing the two frames was off by
Cairo's offset (fixed during the phase).

From the public page, using one needs a proven phone number (signed in and verified, or a
phone proof), exactly like points.

## Giving back

`releaseEntitlement` runs in `releaseBookingHold` (cancellation, failed payment, the
reaper): it marks the use `reversedAt` conditionally (once), and decrements the package or
period. An EXHAUSTED package becomes ACTIVE again if it has not expired. A **no-show keeps
the session used** — the time was held.

## Membership life

| Action | Rule |
|---|---|
| Renew | Under a row lock. Extends from `paidThrough` if still running (paying early never resets the current period); starts now if lapsed (EXPIRED → ACTIVE). At most one period ahead (`paid-ahead`). |
| Pause | ACTIVE with paid time left; allowance 60 days over the membership's life. No visits are taken while paused. |
| Resume | Every period not over when the pause began moves on by the pause (whole days, within the allowance); `paidThrough` moves with them. The cron resumes a pause that used up its allowance. |
| Cancel | At period end (`cancelAtPeriodEnd`, ends as CANCELLED when paid time runs out) or now. |
| Expire | Cron: ACTIVE with `paidThrough` ≤ now → EXPIRED (or CANCELLED if asked). |

Packages: the cron expires ACTIVE/EXHAUSTED packages past `expiresAt`; the owner can cancel.

## Refunds

`refundAtDesk` (money handed back in person): refused while an upcoming booking still holds
one of its sessions (`live-bookings` — cancel those first, or the customer keeps a prepaid
visit they were refunded for); never more than paid, reserved by a conditional update per
payment, newest payment first; a `Refund` row with the actor; the package becomes REFUNDED,
the membership CANCELLED. The suggested package amount is pro rata to unused sessions,
rounded down (`unusedPackageRefund`).

## Deleting a business

The plan foreign keys are `ON DELETE NO ACTION`, not RESTRICT: a plan with sales cannot be
deleted on its own, but deleting a business cascades through everything it sold (RESTRICT is
checked mid-cascade and blocked it — found and fixed during the phase, with a test).

## Tests

`src/lib/loyalty/rules.test.ts` (renewal, pause bounds, refund suggestion),
`src/lib/phase27.db.test.ts` (four bookings racing for two sessions, wrong service, cancel
once, refund refused while booked, expiry vs appointment date, periods/pause/renew),
`src/lib/phase27-ops.db.test.ts` (expiry and cancel-at-period-end, business deletion),
`scripts/qa-phase27.mjs` (over HTTP).
