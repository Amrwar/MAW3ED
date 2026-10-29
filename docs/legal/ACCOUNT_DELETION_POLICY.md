# Account deletion policy

Status: DRAFT for legal review, 2026-10-29. The mechanics are facts of
the code (`src/lib/account/deletion.ts`, `/account-deletion`,
`/api/account/delete`); the retention of what stays is a decision
recorded in `DATA_RETENTION_POLICY.md`.

## How a customer deletes their account

In the app or on the site: Account → Delete account. A one-time code is
sent to the account's phone and must be typed with the word DELETE. The
deletion is immediate and cannot be undone.

## What is deleted at once

- The account itself (name, email, phone, preferences).
- Every signed-in device and browser session, and every push token.
- Saved businesses, the in-app notification feed.
- Sign-in codes, email verification and password-reset links still
  outstanding for the account.
- The phone number and email are removed from the notification delivery
  log (the log keeps that a message was sent, not to whom).

## What stays, and why

- **Bookings** made under the phone number, with the name and phone as
  typed at the time, and the notes typed with them. They are the
  business's record of appointments that took place (or were cancelled)
  and are needed for its accounts, disputes and no-show policy
  [LEGAL: lawful basis for keeping them after the customer withdraws;
  period in `DATA_RETENTION_POLICY.md`].
- **Payments and refunds** attached to those bookings: a financial
  record that must not be edited.
- **Reviews** the customer left, shown under the first name given
  [DECISION: anonymise the display name on deletion; the review's text
  stays].
- The business's own customer record (`Customer`) with the name and
  phone it has on file — it is the business's data [LEGAL].
- A keyed hash of the phone number (not the number) with the date, so
  that if the number is later assigned to somebody else, their new
  account is not shown your history.
- An audit entry that a deletion happened (no personal data in it).

## What a later account on the same number sees

Only bookings made after the deletion. Your name is not reused for the
new account.

## Owners and administrators

A business owner's account cannot be deleted from the app while it owns
a business: deleting it would remove every customer's appointment with
that business. Owners contact support to close the business first
[DECISION: the closing procedure]. Administrator accounts are removed by
a super admin.

## Requests by other means

A customer may also ask by email from the address on `/contact`; support
verifies the phone number by sending a code to it, then performs the
same deletion [DECISION: response time, e.g. 30 days; LEGAL: what the
law requires].

## Store listings

Apple and Google require the in-app path above and a public page; both
exist (`/account-deletion`). The listing text must match this policy.
