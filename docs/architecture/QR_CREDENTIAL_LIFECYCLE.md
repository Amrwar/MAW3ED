# QR credentials: three kinds, kept apart

Maw3ed shows three different QR codes. They look alike to a phone camera, so the product keeps them strictly separate: different payloads, different issuers, different verifiers, and different words on screen.

| | A. Directory QR | B. Booking check-in QR | C. Visitor pass |
|---|---|---|---|
| What it is for | Opening a business's or organization's public page | The business's front desk marking the customer arrived | A venue's gate letting a visitor in |
| Who issues it | Maw3ed (Phase 22b) | Maw3ed | The venue's access provider, never Maw3ed |
| What it holds | A public URL with a source tag | `https://<site>/c/<43-char code>` | Whatever the provider issued (the sandbox's start `SANDBOX-`) |
| Who verifies it | Nobody: it is a link | The business's own signed-in staff, through `POST /api/business/check-in` | The provider's gate system |
| Personal data in it | None | None | None that Maw3ed adds; the provider decides its own format |
| Code | `api/business/qr`, `api/organizations/[id]/qr` | `lib/access/check-in.ts` | `lib/access/passes.ts`, `lib/access/sync.ts` |

A booking check-in code never opens a gate, and a visitor pass never checks anybody in. The customer screen labels them separately: "كود تسجيل الوصول" for B, and "تصريح دخول <venue>" for C, which explains that it is issued by the venue's system. A confirmed booking alone never produces a visitor pass.

## B. The booking check-in code

### Issuing

* The customer's booking page (and the app, through `GET /api/booking/:token/access`) asks for the code. One is issued on first view, for a booking that is `CONFIRMED`, `ARRIVED` or `IN_PROGRESS`. Pending, unpaid, cancelled and finished bookings get none.
* The code is `HMAC-SHA256(check-in key, bookingId + "." + nonce)`, written as 43 base64url characters (256 bits). The database stores only the nonce and `SHA-256(code)` (`BookingCheckIn`). A copy of the database without the server key cannot produce a working code.
* The key comes from `ACCESS_CREDENTIAL_KEY`, or failing that is derived from `AUTH_SECRET` by HKDF. If the key changes, the next view re-issues the code (the stored hash is brought up to date), so the code on screen always scans.
* The QR holds our URL and the code, nothing else: no booking id, name, phone, service or price. It is not the booking's manage link (`Booking.accessToken`, which can cancel), and it cannot be turned into one.

### Verifying and checking in

`POST /api/business/check-in { code, action: "verify" | "check-in" }`. A scan with a plain phone camera lands on `/c/<code>`, which shows the same desk to the business's own signed-in staff and nothing to anyone else.

1. The caller must work for a business (owner, staff, or a delegate). The scan is rate-limited per account: 60 a minute.
2. The code is looked up by hash, **within the caller's own diary** (`bookingScope`). Another business's code, or (for a provider) a colleague's booking, reads exactly like a code that never existed: `not-found`. A scan never confirms anything outside the caller's own bookings.
3. Whether it is good is decided now, from the booking as it is:

| Booking | Result |
|---|---|
| `CONFIRMED`, from 30 minutes before the start to 30 minutes after the end | `valid` |
| `CONFIRMED`, earlier | `too-early` (with the time it opens) |
| `CONFIRMED`, later | `expired` |
| `ARRIVED` / `IN_PROGRESS` | `checked-in` |
| `COMPLETED` | `completed` |
| `CANCELLED` / `FAILED_PAYMENT` | `cancelled` |
| `NO_SHOW` | `no-show` |
| `PENDING` / `PENDING_PAYMENT` | `not-confirmed` |
| code replaced or withdrawn | `not-found` |

4. Checking in needs `bookings.progress`, the same permission as marking arrived by hand. It goes through the booking state machine (`CONFIRMED → ARRIVED`), conditional on the status just read, so a scan racing a cancellation cannot revive the booking. It is recorded in the audit log (`booking.check_in`).
5. **Idempotent.** A second scan, or a colleague's at the same moment, answers `checked-in` with the time and changes nothing. The move succeeds once and is audited once.

What staff see is enough to recognise the booking: customer name, service, time, staff member, party size, reference. They do not see the phone, the price or the manage link.

### Following the booking

Nothing has to be pushed anywhere when a booking changes, because the scan reads the booking as it is:

* **Cancelled, no-show, completed:** the scan says so. In the same transaction as the status move, the code is also marked `REVOKED` (`lib/access/hooks.ts`), so the record shows it was withdrawn.
* **Rescheduled:** the window follows the new time.
* **Replaced by the customer** ("someone else saw my code"): `POST /api/booking/:token/access/check-in` issues a new nonce, and the old code stops scanning at once.

### Exceptions the desk handles by hand

The check-in page tells staff what to do when a code will not scan: find the booking by name in today's list and mark it arrived there, the existing manual action. The booking's status is the single record of check-in. `BookingCheckIn.checkedInAt` adds only that it was done by QR, by whom and when, so the two can never disagree.

## C. The visitor pass lifecycle

```
asked for (holder or named guest)
   │
   ▼
entitlement ELIGIBLE ──► credential PENDING_PROVIDER ──provider confirms──► ACTIVE
   │                         │                                               │
   │                         └─ provider refuses / gives up ─► FAILED ──retry (bounded)
   │                                                                         │
   ├─► SUSPENDED (can clear) ────────────────────────────────────────────────┤
   ├─► REVOKED   (final)     ──────────────────────────────► REVOKE_PENDING ─► REVOKED
   └─► EXPIRED   (final)     ──────────────────────────────► EXPIRED
```

**Two records, never confused.**

* `AccessEntitlement` is Maw3ed's decision that a person may *ask* for entry: the window, gates and re-entry, versioned.
* `AccessCredential` is what the *provider* issued. It is `ACTIVE` only once the provider confirms it.

**Who may ask.** Only someone who asked for a pass: the booking holder (`POST /api/booking/:token/access/pass`) and named guests the holder adds (`POST …/guests`), within the venue's guest limit. Each guest gets their own invitation link to their own pass (`/pass/<inviteToken>`), which shows that guest's pass and the venue's instructions, nothing about the booking or the other guests.

**The decision** (`lib/access/eligibility.ts`, pure and unit-tested) needs all of these:

* the booking is `CONFIRMED`, `ARRIVED` or `IN_PROGRESS`, and not a test booking;
* the business is open (`APPROVED`);
* the business, or the booking's branch, is an approved tenant of an `ACTIVE` venue;
* the venue has passes switched on, with a provider usable here, and its policy admits visitors by booking;
* the visitor is the holder or a guest within the limit, with the identity the venue requires (a name, or a name and a mobile number);
* the window has not passed: `accessBeforeMinutes` before the appointment to `accessAfterMinutes` after it;
* for someone who never arrived, the venue's no-show cut-off has not run out.

**Final versus recoverable.** Only an ending booking (cancelled, no-show, failed payment), a removed guest or a test booking revokes a pass for good. Everything that can clear *suspends* it instead, and the pass is issued again when it clears:

* the booking waiting for re-confirmation after a customer's move;
* the business paused by the platform;
* the venue switching passes off;
* a venue notice (`ACCESS_SUSPENDED` or `CLOSED`) on the day;
* the tenant listing withdrawn;
* a guest limit lowered;
* a security hold.

Expiry is final.

**Keeping in step.** `syncBookingAccess` is the only place that moves any of this. It re-reads everything, decides again, and queues provider calls in the same transaction. It runs:

* inside every booking status move (`lib/bookings/state.ts`);
* after both reschedule routes;
* after venue policy, notice, tenancy and access-switch changes (bounded, after the response);
* for every live pass from the five-minute cron.

A per-booking advisory lock serialises it, so concurrent runs cannot issue two credentials. A partial unique index enforces at most one live credential per entitlement in the database as well.

**Rescheduling.** A change of window, gates or re-entry bumps the entitlement version, and an `UPDATE` call carries it to the provider. Until the provider confirms the new version, the customer sees "active — being updated". An older confirmation arriving late never replaces a newer one.

**Failure and recovery.** A provision call that fails is retried with backoff. When the retries run out the credential is `FAILED`, the customer sees why, and they may ask again ("اطلب التصريح تاني"). This is capped at 5 credentials per pass, after which the screen tells them to contact the venue. A failed pass is never re-issued behind the customer's back.

**Withdrawal.** On Maw3ed's side a withdrawal takes effect immediately: the pass stops being shown, and the desk sees it as withdrawn. The provider is then told (`REVOKE`). The credential becomes `REVOKED` only when the provider acknowledges it, and the `AccessRevocation` row records both moments. If the provider never acknowledges, an `ESCALATION` event asks a person to follow up. Maw3ed never claims a withdrawal the provider has not confirmed.

**Expiry.** When the window ends, the cron marks entitlement and credential `EXPIRED` without calling the provider, whose own validity ends at the same moment.
