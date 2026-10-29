# Data processing and integration requirements

Status: DRAFT for legal review, 2026-10-29. What each third party
receives from Maw3ed (fact, from the code), what agreement should be in
place (question for counsel), and what a business using Maw3ed must be
told.

## Processors

| Provider | Role | Data sent | Region | Agreement needed |
|---|---|---|---|---|
| Vercel | hosting, functions, logs, cron | every request; logs with personal data redacted by the app, but request URLs (may include `?lat=&lng=`) in Vercel's own access logs | US/EU regions [owner: record the function region] | DPA (Vercel offers a standard one) [LEGAL: transfer basis] |
| Neon | database | all stored data | [owner: record the region] | DPA [LEGAL] |
| Paymob | payments (Egypt) | amount, currency, order id, customer name, phone and email as billing data; card data stays with Paymob | Egypt | merchant agreement; refund policy they require (P17-13) |
| Meta WhatsApp Cloud API | messages | phone number, message text (booking details, one-time codes) | Meta | WhatsApp Business terms; template approval |
| Resend | email | address, message text | US | DPA |
| Cloudinary | images | files a business uploads (listing, staff, review photos) | [region] | DPA |
| Expo | push notifications | device token, notification title/body (no booking token) | US | terms |
| Sentry (if enabled) | error reports | stack traces with personal data redacted before sending | [region] | DPA |
| GitHub | source code | no personal data | — | — |

No provider receives card numbers, passwords, hashed or otherwise, or
one-time codes except Meta (which delivers them).

## What a business must be told (processor → controller)

Maw3ed processes customers' data on the business's behalf for the
booking relationship, and for its own purposes where it is the
controller (accounts, platform security, aggregate statistics) [LEGAL:
the split]. The business terms should state:

- what the business may use customer data for (the booking
  relationship; not marketing without consent);
- that staff access is the business's responsibility;
- that notes fields may contain sensitive data and should be used with
  care, especially by clinics [LEGAL: sensitive-data rules];
- how long records are kept (`DATA_RETENTION_POLICY.md`) and how a
  customer's deletion request is handled;
- that the business must answer customers' requests about its own
  record;
- the sub-processors above.

## Integration requirements for anyone building against the API

- Authenticate with a session or bearer token; never embed credentials
  in a client.
- Treat booking access tokens as secrets; never put them in push
  payloads, logs or analytics.
- Send state-changing requests from the site's own origin (the server
  refuses cross-site ones) or with a bearer token.
- Respect rate limits (`429` + `Retry-After`) and the `busy` answer.
- Validate webhooks you receive from us (none exist today) the way we
  validate Paymob's.
- For a future Eterna/venue integration: see `THREAT_MODEL.md` §
  "Eterna visitor credentials".
