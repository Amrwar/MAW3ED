# Privacy policy — draft for legal review

Status: DRAFT, 2026-10-29. Not published. Every bracket is a decision or
a question. The published policy must be in Arabic with an English
version; this draft is the English source.

---

**Who we are.** Maw3ed ("موعد") is operated by [LEGAL ENTITY NAME,
registration country and number — DECISION/LEGAL]. Contact: the email
and WhatsApp number shown on `/contact` [confirm the Egyptian number;
the Canadian details are for Meta review — DECISION].

**What this covers.** The website maw3ed.net, the Maw3ed mobile app,
and the booking pages businesses embed or link to.

## What we collect, and why

*Fact (code):*

| Data | When | Used for | Where in the code |
|---|---|---|---|
| Phone number | booking; signing in with a code | identifying your bookings, sending confirmations and reminders, letting you sign in | `Booking.customerPhone/E164`, `User.phone`, `lib/auth/login-code.ts` |
| Name | booking; account | shown to the business you booked with | `Booking.customerName` |
| Email (optional) | booking; business accounts | confirmations, receipts, account recovery | `Booking.customerEmail`, `User.email` |
| Notes you type with a booking | booking | passed to the business | `Booking.notes` — may contain anything you write, including health details; we do not ask for them |
| Booking details | booking | the appointment itself; the business's record | `Booking` |
| Payment records | deposits and subscriptions | the amount, status, receipt number and Paymob's identifiers; **no card numbers** reach us | `Payment`, `Refund` |
| Notification delivery records | every message we send | knowing it was sent; not sending it twice | `NotificationDelivery` (address kept until the account is deleted) |
| Device tokens | if you enable push in the app | push notifications | `DeviceToken` |
| Sessions | signing in | keeping you signed in; letting you sign out other devices | `MobileSession`, a web cookie |
| Approximate location | only if you allow "near me" | the search, once; **not stored** | `/api/public/businesses/nearby` |
| Profile-view counts | opening a business page | an aggregate per business, source and day; **no identifier** | `ProfileView` |
| Rate-limit counters | sign-in, booking, votes | abuse prevention; stored as a keyed hash, never the address | `RateLimit` |
| Reviews | after a completed booking | public, under your first name [DECISION: display name rule] | `Review` |
| Onboarding draft (business owners) | while filling in the sign-up wizard | resuming on any device; deleted when the business is created or the owner starts over | `OnboardingDraft` |
| Onboarding milestones (business owners) | registering, publishing, first booking, first paid plan | measuring whether onboarding works; one row per account and milestone, no visitor or customer data, no third party | `LifecycleEvent`, `lib/business/lifecycle.ts` |
| Venue roles and memberships (venue staff, business owners) | a venue role is granted, or an owner asks to be listed in a venue | who manages which venue; which business is listed where. Venue staff see business names and **booking counts only** — never customers, their details, bookings, notes or payments | `VenueRole`, `VenueMembership`, `src/lib/venues/metrics.ts` |
| Organization-page view counts | opening an organization's public directory page | an aggregate per organization, channel and day; **no identifier** | `OrganizationView` |
| Organization booking attribution | a booking made from an organization's directory page | the booking's id against the organization — a counter source. Organization staff see **counts per business only**, never who booked, their contact details or what was paid | `OrganizationBookingAttribution`, `src/lib/organizations/public.ts` |
| Import records (business owners) | importing a CSV of customers or services | undoing an import; holds the ids created, not the file | `ImportBatch` |

We do not collect: card data, precise location history, contacts,
photos (except images a business uploads to its listing), advertising
identifiers.

## Cookies

A session cookie when you sign in (`authjs.session-token`,
httpOnly), a language cookie, and a CSRF cookie on the sign-in form.
No advertising or analytics cookies [FACT today; DECISION if analytics
are added].

## Who sees your data

- **The business you book with** sees your name, phone, email if given,
  notes and your booking history with them. It is their customer record
  and they are responsible for it [LEGAL: controller/processor split
  under Law 151/2020].
- **Staff of that business** with manager access see the same; a
  provider sees only the bookings with them and not the owner's private
  notes.
- **Maw3ed administrators** see what support needs; every money action
  is logged.
- **Processors** (see `DATA_PROCESSING_REQUIREMENTS.md`): Vercel
  (hosting), Neon (database), Paymob (payments, Egypt), Meta WhatsApp
  Cloud API (messages), Resend (email), Cloudinary (images), Expo (push),
  Sentry if enabled (error reports, with personal data redacted before
  sending). Several are outside Egypt [LEGAL: cross-border transfer
  basis and notice].

We do not sell personal data.

## How long we keep it

See `DATA_RETENTION_POLICY.md`. *Fact:* the software applies no
automatic deletion today; booking and payment records are kept as the
businesses' and our financial records [DECISION: the periods].

## Your choices

- Sign in with your phone to see every booking made under your number,
  download a copy of your data (`/api/account/export` — the app and site
  will show a button [DECISION]), change notification preferences, and
  sign out of every device.
- Delete your account: `/account-deletion` describes exactly what goes
  and what stays (bookings stay with the businesses as their records; the
  number is released so a later holder of it cannot see your history).
- Ask the business directly to correct or erase the record it holds.
- [LEGAL: the rights Law 151/2020 grants and how a request is handled
  and within what time; the contact for the data protection officer if
  one is required.]

## Security

Transport encrypted (TLS, HSTS); passwords hashed (bcrypt); one-time
codes and reset links stored only as hashes; sessions revocable;
role and ownership checked on every request; personal data removed
from logs before they are written; database encrypted at rest by the
provider. Details in `docs/security/THREAT_MODEL.md`. No system is
perfectly secure; see `INCIDENT_RESPONSE_POLICY.md` for what we do if
something goes wrong.

## Children

[DECISION: minimum age — the code has no age gate; the store listings
say 18+. LEGAL: what the law requires.]

## Changes

We will post changes here with the date; material changes will be
announced in the app [DECISION: how].

Effective: [DATE]. Previous version: March 2025.
