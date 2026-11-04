# Loyalty ledger

Phase 27. Code: `src/lib/loyalty/rules.ts` (pure arithmetic), `src/lib/loyalty/ledger.ts`
(every write), schema `LoyaltyProgram`, `LoyaltyParticipation`, `LoyaltyAccount`,
`LoyaltyEntry` (`prisma/migrations/phase27_operations.sql`).

## Model

- **Program.** A business's own (`businessId`), or an organization's (`organizationId`) —
  exactly one (`LoyaltyProgram_owner_chk`). The rules are points per completed visit,
  points per 100 EGP of completed value, the redemption rate (`redeemPoints` points =
  `redeemValueCents`), the most a booking can be paid in points (`maxRedeemPercent`),
  when points expire (`expiryDays`, null = never) and a daily earning cap per customer
  (`dailyEarnCap`). All of these are bounded by `LoyaltyProgram_rules_chk`.
- **Account.** One per program per phone number (E.164 digits, the identity every booking
  already carries). `balance` is the sum of its entries and can never go below zero
  (`LoyaltyAccount_balance_chk`).
- **Entry.** Append-only. `kind` ∈ EARN, EARN_REVERSAL, REDEEM, REDEEM_REVERSAL, EXPIRE,
  ADJUST, and its sign is fixed by kind (`LoyaltyEntry_sign_chk`). Entries that add points
  are **lots**: `remaining` (0 ≤ remaining ≤ points, `LoyaltyEntry_lot_chk`) and their own
  `expiresAt`. `sourceKey` is unique, which is what makes every event happen once.

## Which program applies

`programForBusiness(businessId)` decides:

1. The business's own program, if it is active.
2. If the business has its own program switched **off**, it has opted out: no program at all
   (it is not silently enrolled into another one).
3. Otherwise, an organization's program the business **accepted** (`acceptedAt`, not
   `leftAt`), and only while the organization **OWNS** the business (an APPROVED,
   unsuspended OWNED association). A mall hosting a tenant (HOSTED), or a company managing
   one (MANAGED), never reaches that business's loyalty, its customers or its payments.

## Events and their keys

| Event | Where | sourceKey | Notes |
|---|---|---|---|
| Earn | `applyMove` → COMPLETED, in the same transaction (in a savepoint, so a loyalty fault never blocks completing a visit) | `earn:<bookingId>` | Not for test bookings, bookings without a phone, or the owner's own number. Daily cap counted under the account lock (Cairo day). Earned on `totalPrice` — what was actually charged after offers and points, so points never earn points. |
| Redeem | `createBooking` and the desk route, inside the booking's transaction | `redeem:<bookingId>` | Account row locked (`SELECT … FOR UPDATE`), unexpired lots drawn soonest-expiry first. If they no longer cover it, `LoyaltyInsufficient` rolls the booking back (`loyalty-insufficient`). |
| Give back | `releaseBookingHold` (cancellation, failed payment, the reaper) | `redeem-reversal:<bookingId>` | A fresh lot with a fresh expiry. A no-show keeps the points spent. |
| Refund reversal | admin refund route, after the provider confirms | `earn-reversal:<bookingId>:<refundId>` | Proportional to the refunded share of the booking value, capped by what is left of the original earn. If the customer already spent the points, only what remains is taken and the shortfall is written in the note — never a negative balance. |
| Expire | operations cron, one lot per transaction, bounded per run | `expire:<lotId>` | |
| Adjust | owner, with a reason and their user id | `adjust:<businessId>:<formKey>` | Only the business's own program; removing points draws from lots and never below zero. |

**Replays never draw twice.** Every function that draws from lots checks its sourceKey
under the account lock **before** drawing, and if the insert still loses, it throws so the
transaction rolls the draw back. (The first version drew first and lost the insert after;
the database test caught a replayed refund reversal taking points twice.)

## Spending from the public page

Points, packages and memberships are balances tied to a phone number, and anybody can type
a number. So the public booking route spends them **only** for a proven number: the caller
is signed in with that number verified, or brings a phone proof (`phone-unverified`
otherwise). The price is worked out on the server (`redemptionFor`): whole units of
`redeemPoints`, capped by `maxRedeemPercent` of the price after any offer, and by the
spendable balance. The booking page shows exactly what `/api/account/wallet` computes.

## Fraud and abuse protections

- Unique sourceKey: no duplicate earn, redemption, reversal or expiry, whatever retries.
- Account row lock: two redemptions from one account are serialised; the second sees what
  the first spent.
- CHECKs: balance ≥ 0, lots within [0, points], signs by kind, rule bounds.
- Daily earn cap; no earning on test bookings or on the owner's own number.
- Earning is on the amount charged, so redeemed value earns nothing.
- Nothing reacts to a ledger entry: no reward can trigger another reward.

## Tests

`src/lib/loyalty/rules.test.ts` (arithmetic), `src/lib/phase27.db.test.ts` (racing
completions, three bookings racing for one balance, cancel once, refund twice, spent before
refund, expiry once, organization reach), `scripts/qa-phase27.mjs` (over HTTP: a guest
typing the number is refused, cancel gives back, double-submitted correction applies once).
