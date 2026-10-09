# Verifying payments

What has been checked, how to check the rest, and what nobody has
checked yet.

## The flow, as built

```
1. Customer picks a service and a time
     src/lib/bookings/create.ts
     Booking created with status PENDING_PAYMENT.
     The slot is now held — overlap.ts counts PENDING_PAYMENT as blocking.

2. A Payment row is opened BEFORE the customer leaves
     src/lib/payments/ledger.ts  openPayment()
     status PENDING, amountCents in piastres, no provider ids yet.
     If they close the tab now, there is a row saying what they were
     trying to pay for rather than silence.

3. A Paymob session is created
     src/lib/services/paymob.ts
       authenticate()   → auth token
       createOrder()    → Paymob order id
       getPaymentKey()  → payment token, expires after 3600s
     attachProviderOrder() writes the order id onto the Payment.

4. The customer is redirected
     https://accept.paymob.com/api/acceptance/iframes/{id}?payment_token=…
     A full-page navigation, not an iframe we host.

5. Paymob calls the webhook          ← the only authority on payment
     POST /api/webhooks/paymob
       a. verify HMAC-SHA512 over 20 named fields, constant-time
       b. claim the delivery by transaction id (unique index)
       c. find the Payment by order id
       d. amount must equal what we opened the payment for
       e. currency must equal the payment's currency
       f. is_refunded / is_voided → record a reversal, do not re-settle
       g. settle, assign a receipt number, confirm the booking —
          all in one database transaction

6. The browser comes back
     /payment/return reads the booking's status from the database.
     It ignores ?success= entirely. The browser is never believed.
```

**One authority.** Only the webhook may move a payment to SUCCEEDED.
The return page displays; it does not decide. A customer whose
connection dies after paying still gets a confirmed booking, because
the webhook never depended on their browser.

## What is verified, and how

### Automatically, on every CI run

`src/lib/payments/webhook-rules.test.ts` — 19 tests over the signature
and the accept/reject rules, run against the real `verifyWebhookHmac`.
Includes tampering with the amount, the success flag and the currency
after signing, a wrong-length signature, and a missing secret.

`src/lib/payments/reap.test.ts` — the abandonment thresholds and which
booking statuses may be released.

`src/lib/payments/money.test.ts`, `subscription.test.ts` — the
arithmetic, including the rounding rule.

### By running the harness

```bash
set -a; . ./.env; set +a
npm run build && npm start &
node scripts/verify-payment-webhook.mjs
```

50 checks against a real database and the real route. It signs payloads
with `PAYMOB_HMAC_SECRET` and posts them to a **local** server. It never
calls Paymob and no money moves. Fixtures are tagged `wh_verify_` and
deleted at the end; the last line prints the payments left behind.

Covered: successful delivery, duplicate delivery, a second delivery for
an already-settled payment, wrong signature, unparseable body, missing
transaction object, non-TRANSACTION type, wrong amount, wrong currency
with the same number, unknown order, declined, pending, a reversal
performed at the provider, an attempt to orphan a payment, five
concurrent refunds, and the abandoned-checkout reaper.

## What nobody has verified

**A real card has never been charged through this system successfully.**
Three real subscription attempts exist in production: two FAILED with
`provider-error`, one abandoned. No payment has ever reached SUCCEEDED.

These cannot be tested without spending money, and are yours to perform:

| | |
|---|---|
| Successful payment | A real card, charged. |
| Failed payment | Partly covered — two real `provider-error` failures handled correctly. |
| Cancelled payment | Reaching Paymob and pressing back. |
| Real refund | `refundTransaction()` has never been called against Paymob's API. |

### Runbook for a real transaction

1. Pick the cheapest real service, or add a 5 EGP one temporarily.
2. Book it as a customer, with online payment, and pay with a real card.
3. Check, in order:
   - `/admin/payments` shows the payment **SUCCEEDED** with a receipt number
   - the booking is **CONFIRMED**
   - the customer received a confirmation
   - Vercel logs show `[paymob webhook] booking payment settled`
4. Then refund it from `/admin/payments`, and check:
   - the payment reads **REFUNDED**, `refundedCents` equals the amount
   - the money appears back in Paymob's dashboard
   - pressing refund a second time is refused

The amount is not the risk; the risk is finding out in front of a real
customer instead.

### Configuration only you can confirm

Set in the **Paymob dashboard**, not in this codebase — nothing here
sends a callback URL, so these are invisible to the code and to me:

- Transaction processed callback → `https://www.maw3ed.net/api/webhooks/paymob`
- Transaction response callback → `https://www.maw3ed.net/payment/return`

The first is **confirmed working**: two real webhooks arrived in
production and were processed in ~33ms. The second is unconfirmed.

## Known limitations

**No reconciliation sweep against Paymob.** Nothing periodically asks
Paymob "what do you think happened to these?" If a webhook is never
delivered at all, the payment is reaped as abandoned after two hours
even if the money was taken. The ledger would then disagree with
Paymob, and only a human comparing the two would notice. A sweep that
queries the provider for PENDING payments before abandoning them is the
right fix and is not built.

**Fees and net amounts are not tracked.** `Payment` records gross only.
Paymob's fee is not stored, so "what was actually received" cannot be
answered from this database.

**No business balance or payout ledger.** Payments are recorded against
a business, but there is no running balance and no payout accounting.

**`onDelete: SetNull` on `Payment.bookingId` contradicts
`Payment_target_chk`.** The constraint requires a non-subscription
payment to have a booking, so deleting a booking that has a payment
fails with a raw Postgres error. Nothing deletes bookings today —
cancellation is a status change — so this is latent. Anything that adds
a deletion path (GDPR erasure, admin cleanup) will hit it.

**Subscription renewals are not automatic.** There is no stored card
and no recurring charge; `/api/cron/subscriptions` expires and reminds,
and the owner pays again by hand.
