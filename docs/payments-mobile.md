# Mobile payments (deposits)

One ledger, one webhook, one Paymob integration — the app adds no payment
code of its own. `POST /api/public/[slug]/bookings` opens the Payment row
and the Paymob session exactly as for the website; the app shows Paymob's
hosted page in an in-app browser (card details never touch the app); the
**webhook** (`/api/webhooks/paymob`, HMAC-checked, idempotent per
transaction) is the only thing that marks money received or a booking
confirmed. The app reads the result back from
`GET /api/public/booking/[token]` and never declares success itself.

## Edge cases handled

| Case | What happens |
|---|---|
| App closed mid-payment | The page is kept on the device for an hour; Home shows "Finish paying your deposit" while the server still holds the booking; the booking screen offers "Continue to payment". |
| Page lost or expired | `POST /api/public/booking/[token]/pay` opens a new Paymob order — refused while an earlier page could still be paid (`payment-in-progress`), so nobody can pay twice. |
| Return from Paymob | The website's `/payment/return` hands app bookings back with `maw3ed://booking/<token>`; the app closes the browser and re-reads the status. |
| Delayed webhook | The app polls for 10 minutes, then offers "Check again"; re-reads on returning to the foreground. |
| Webhook after the hold was released | The money is always recorded. The booking is re-confirmed if its time is still free; otherwise it stays released, an AuditLog entry (`payment.paid_after_release`) flags it for a refund or new time, and the app says so honestly. |
| Duplicate webhook / duplicate tap | Ledger + webhook idempotency; booking idempotency key. |
| Payment failed | Webhook → FAILED_PAYMENT, slot released, `payment.failed` sent; app offers "Book again". |
| Refunds | Shown from the ledger (`refundedCents`) on the booking and in Account → Payments; nothing promised that the ledger does not record. |

## Local end-to-end (no Paymob keys needed)

`PAYMOB_FAKE=1` (development only — refused in production) swaps Paymob's
hosted page for `/api/dev/paymob/checkout`, which sends the same signed
callback Paymob sends to the real webhook. Verified locally: app booking →
deposit page → signed webhook → CONFIRMED + receipt number → in-app
notifications → app shows "Your booking is confirmed" with the deposit
paid; decline → FAILED_PAYMENT; late payment both ways;
`scripts/verify-payment-webhook.mjs` 50/50.

## Still to do on real devices (needs a person and Paymob test keys)

1. Set Paymob **test** keys in a staging environment; return URL →
   `https://<staging>/payment/return`; callback URL →
   `https://<staging>/api/webhooks/paymob`.
2. On an iPhone and an Android phone (development build), book a deposit
   service, pay with Paymob's test card, and confirm: the browser closes or
   returns to the app, the booking shows Confirmed, the push arrives.
3. Repeat with a declined test card, and once closing the app mid-payment.
