# Visitor access and check-in: threat model

Scope: the booking check-in QR (B), visitor passes (C), the provider adapter and callbacks, the sandbox (D), and the venue security desk. The directory QR (A) is a public link and is not considered here.

## Assets

| Asset | Why it matters |
|---|---|
| A booking check-in code | Whoever holds it can be checked in as that customer at that business |
| A visitor pass token | Whoever holds it may get through a venue's gate (via the provider) |
| A booking's manage link (`accessToken`) | Can cancel, reschedule and manage passes for the booking |
| A guest's invitation link | Shows that guest's pass |
| Provider callbacks | Can confirm, withdraw or report entries |
| Keys | `ACCESS_CREDENTIAL_KEY` / `AUTH_SECRET` (codes, sealed tokens, sandbox signing); a partner's secret in the environment |
| Customer data | Names, phones, what was booked, payments |

## Actors and what they may do

| Actor | May | May not |
|---|---|---|
| Customer (manage link) | See their code and passes; ask for a pass; add or remove guests; retry; replace the code | See anyone else's; change any rule |
| Guest (invitation link) | See their own pass | See the booking, the business or other guests |
| Business staff (owner, manager, provider, delegate with reservations) | Scan and check in **their own diary's** bookings; see pass *states* (counts) on a booking | See another business's bookings; see gate events; override a venue |
| Venue security (`VENUE_SECURITY`) | See the venue's passes (names, windows, states, gate events); hold, restore, escalate, with a reason | See phones, services, prices, references or booking links; change venue settings or the provider; see metrics or tenancy decisions |
| Venue operator (manager or admin) | All of the above; switch passes on or off; set the policy | Choose the provider (platform only); see private booking or financial data |
| Platform administrator | Choose a venue's provider and site reference | (all actions audited) |
| Provider | Confirm, refuse, withdraw; report entries, through signed callbacks | Anything unsigned, stale or for credentials it does not hold |

## Threats and mitigations

| # | Threat | Mitigation | Verified by |
|---|---|---|---|
| T1 | Guessing a check-in code | 256-bit HMAC output; unknown codes are indistinguishable from other businesses' (`not-found`); scans rate-limited at 60/min per account | unit (crypto), DB 4/12/14, QA 14 |
| T2 | Forging a code from a database leak | Only the nonce and SHA-256(code) are stored; the code needs the server key | DB 2/3/25 (no plaintext stored), unit (no key, no code) |
| T3 | A shared or leaked screenshot of the code | Valid only in its window and only for the booking's own business; the customer can replace it, and the old one dies at once; check-in is idempotent, so a replay cannot double-count | DB 4/12/14 (replaced), DB 15 |
| T4 | Another business (or a provider-role colleague) reading a booking through its code | Lookup is scoped by `bookingScope`; out of scope is `not-found`; the `/c/` page shows nothing to anyone but the business's own staff | DB 4/12/14, QA 4/12, QA "/c/ shows no details" |
| T5 | Personal or medical data in a QR | B holds only our URL and an opaque code; C holds the provider's token. The provider is sent a first name, plus a phone only if the venue requires one | QA 2 (payload check), `passRequest` review |
| T6 | Check-in reviving a cancelled booking (race) | The move is conditional on the status read (`moveBooking`); a racing cancel wins and the scan reports it | state machine (Phase 17) + DB 15 (concurrent scans) |
| T7a | A security hold silently lifted by an unrelated change | A hold keeps its reason through every temporary ineligibility; only `securityReinstate` lifts it | DB R1 |
| T7 | Using a pass after cancellation | Withdrawn locally in the same transaction as the cancel (no longer shown, desk shows withdrawn), then revoked at the provider; the gate refuses once acknowledged | DB 7/8/25, QA 7/8 |
| T8 | Treating "booking confirmed" as "may enter" | Passes exist only when asked for; `ACTIVE` only on the provider's confirmation; pending stays pending | DB 5/10/11, QA C |
| T9 | Forged or replayed provider callback | HMAC-SHA256 over `timestamp.body`, a 5-minute window, constant-time compare; unique `(provider, eventId)` | unit 14, DB 14/16, QA 14/16/20 |
| T10 | A late or old confirmation reviving or rolling back | Activation is conditional on state (pending or active only) and version (never older than confirmed) | DB 19 |
| T11 | Callback flood | Body capped at 16 KB; failures rate-limited per address; cheap rejection before any write | route + QA 20 |
| T12 | Duplicate credentials from races | Per-booking advisory lock; partial unique index (one live credential per entitlement); idempotency keys on jobs and on provider calls | DB 21/23 |
| T13a | A pass left valid at the gate on old terms when an update fails | A dead UPDATE withdraws the pass, then re-issues one for the current rules | DB R5 |
| T13 | Infinite retries or polling hammering a provider | Leases, 8 s timeouts, exponential backoff, 6 attempts then DEAD, bounded batches and time budgets; the UI polls at most 10 times; no timer loop anywhere | unit 18/21/24, DB 17/18/24 |
| T14 | The sandbox reachable in production | `sandboxAllowed()` false on Vercel and in production builds without `ACCESS_SANDBOX=1`; the dev route 404s otherwise and needs the cron secret; tokens marked `SANDBOX-` | unit "sandbox stays out", QA 20 |
| T15 | Venue staff over-reach into booking or financial data | The desk query selects names, windows, states and events only; `VENUE_SECURITY` has exactly two actions (`venue.access.view`, `venue.access.override`), not `venue.view`, so the venue console's API and tenant list are closed to it; the business's private data is never joined | QA "data minimisation", QA "least privilege" ×2, unit 20 |
| T16 | A business overriding venue security | Business roles carry no venue authority; the desk and override routes 404 for them | QA 20 |
| T17 | Escalating privileges via the provider setting | Only `venue.access.provider` (platform) sets it; only usable providers are accepted; enabling without a provider is refused by API and DB CHECK | unit 20, API |
| T18 | Key compromise | Purpose-separated keys (HKDF); rotating `ACCESS_CREDENTIAL_KEY` re-issues every check-in code automatically and makes sealed pass tokens unreadable (holders ask again); `PSEUDONYM_SECRET` is untouched | unit (purpose keys) |
| T19 | Guest link enumeration | 144-bit random tokens; rate-limited per address; a removed guest's link stops working | API + DB |
| T20 | Missing audit trail | Check-ins in `AuditLog`; every pass transition, override (with actor and reason), escalation, provider error and gate event in `AccessEvent`; venue settings changes in `AuditLog` | DB 2/3/25, 7/8/25, 25 |

## Residual risks and decisions

* **Manage and invitation links are bearer links,** like the existing manage link. Anyone with the link can act as the customer or see the guest's pass. This is unchanged from the existing booking self-service model.
* **The guest invitation token is stored in plaintext** (as `Booking.accessToken` is) so it can be shown to the holder again. Hashing it would mean the holder could not re-share a link. [DECISION] Accept, or move both to hashed tokens with re-issue.
* **Check-in code key rotation:** rotating `ACCESS_CREDENTIAL_KEY` (or `AUTH_SECRET` when no dedicated key is set) invalidates screenshots already shared, which is intended.
* **A real provider's own threat model** (its token format, gate-side checks, offline gates) is out of scope until an integration exists (status E).
* **Provider withdrawal not acknowledged:** Maw3ed stops showing the pass and raises an escalation, but cannot prove the gate no longer accepts it. A person must follow up with the operator.
