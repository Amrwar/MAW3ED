# Stripe — plan payments

Businesses can pay for their Maw3ed plan (Pro, Premium; a month or a year)
by **international card through Stripe**, next to Paymob. Customer booking
payments are **not** on Stripe: they stay on Paymob, which takes Egyptian
cards, Meeza and wallets and pays out in Egypt.

The Stripe account is the owner's **Canadian** account. Egypt is not a
Stripe country (stripe.com/global), so the money from Stripe plan payments
lands in Canada, converted by Stripe from EGP to the account's settlement
currency. That is a business and tax decision for the owner; nothing in the
code depends on it.

## How it works

```
Owner, Settings → Subscription → "International card" → Pay
  POST /api/business/subscription/upgrade { plan, cycle, provider: "STRIPE" }
    1. Payment row opened (PENDING, provider STRIPE, plan, piastres)
    2. Checkout Session created: EGP, the plan's price, expires in 1 hour,
       metadata.paymentId, Idempotency-Key = the payment row
    3. Business: pendingPlan + the session id
    4. → Stripe-hosted checkout
Stripe → POST /api/webhooks/stripe            ← the only authority
    signature (HMAC-SHA256, 5-minute window) → claim the event id once →
    the session must be the one the payment row opened, for its amount
    and currency → the plan is activated by the same code as Paymob's
    (lib/payments/subscription-settle.ts): period extended from what is
    left, referral reward, FIRST_PAID_SUBSCRIPTION, "renewed" notice
Owner's browser → /payment/subscription/return (reads the database only)
```

| Stripe event | What happens |
|---|---|
| `checkout.session.completed`, `payment_status: paid` | Plan activated (once) |
| `checkout.session.completed`, `unpaid` | Waits (a delayed method) |
| `checkout.session.async_payment_succeeded` | Plan activated (once) |
| `checkout.session.async_payment_failed` | Payment FAILED, pending plan released |
| `checkout.session.expired` | Payment FAILED, pending plan released |
| `charge.refunded` | A refund made in the Stripe Dashboard is recorded on the ledger (never counted twice); the plan is not taken away |
| anything else | Acknowledged, ignored |

Refunds from **/admin/payments** go to Stripe for a Stripe payment (the
refund row's id is the idempotency key), Paymob otherwise.

A payment nobody hears back about is abandoned after two hours by the
existing reaper; the Stripe session has expired an hour before that, so
it can no longer be paid.

## Setup (owner)

1. **Database:** run `prisma/migrations/stripe_provider.sql` on production
   (adds `STRIPE` to the provider enum). Helper: `migrate-stripe.sh`.
2. **Stripe Dashboard → Developers → API keys → Create restricted key**:
   - Checkout Sessions: **Write**
   - Refunds: **Write**
   - PaymentIntents: **Read**
   - everything else: None
3. **Stripe Dashboard → Developers → Webhooks → Add endpoint**:
   - URL `https://www.maw3ed.net/api/webhooks/stripe`
   - events: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`,
     `checkout.session.expired`, `charge.refunded`
   - copy its **signing secret** (`whsec_…`)
4. **Vercel → maw-3-ed → Settings → Environment Variables (Production)**:
   `STRIPE_SECRET_KEY` = the restricted key, `STRIPE_WEBHOOK_SECRET` =
   the signing secret. Redeploy. Until both are set the option is hidden
   and the route refuses `provider: "STRIPE"`.
5. **Payment methods:** chosen in the Stripe Dashboard (Settings → Payment
   methods); the code does not restrict them.
6. **Test first** in a Stripe sandbox (test keys and a test webhook
   endpoint on a preview or the staging server), then live.

## Verified

| Check | How | Result |
|---|---|---|
| Signature: valid, rolled secrets, tampered body, wrong secret, missing, malformed, replay outside 5 min | `src/lib/services/stripe.test.ts` | PASS |
| Form encoding of the session request | same | PASS |
| Webhook on a real database: unsigned refused; paid → plan, receipt, period; redelivery and a second event change nothing; a year is a year; unpaid waits then async decides; failed and expired release the plan; wrong amount or currency never activate; another session ignored; Dashboard refunds recorded once; unknown events ignored | `src/app/api/webhooks/stripe/route.db.test.ts` (QA Postgres) | PASS 9/9 |
| Paymob unchanged after sharing the settlement code | `src/app/api/webhooks/paymob/route.db.test.ts` | PASS 9/9 |

## Not verified

- **A call to Stripe.** No key was available: the Checkout Session request
  and the refund request have never reached Stripe. Do one sandbox
  payment and one sandbox refund before going live (the runbook in
  `docs/payments-verification.md` applies).
- **EGP on a Canadian account.** EGP is accepted as a presentment currency
  for most accounts; if Stripe refuses it, session creation fails with
  Stripe's message and the owner sees "could not start the payment". The
  sandbox test settles this.
- **Egyptian cards paying a Canadian merchant** may be declined or charged
  a foreign-transaction fee by the issuing bank; that is why Paymob stays
  the default.
