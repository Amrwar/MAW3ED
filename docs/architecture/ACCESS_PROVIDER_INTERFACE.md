# Access providers: the provider-neutral interface

Maw3ed does not open gates. A venue's gates belong to an access provider: the operator's own system, or a vendor's. Maw3ed decides who may *ask* for entry (lib/access/eligibility.ts). The provider decides whether to issue a credential, issues it, and admits or refuses people at its gates.

This document is the contract between the two. It names no real operator, endpoint, field or credential, and none is written in the code. **No real provider integration exists.** The only implementation is the sandbox, which imitates one for development and tests.

## The adapter (`lib/access/provider.ts`)

```ts
interface AccessProviderAdapter {
  kind: "SANDBOX" | "PARTNER";
  provision(req: PassRequest, ctx: CallContext): Promise<IssueResult>;            // ask for a credential
  update(providerRef, req: PassRequest, ctx): Promise<IssueResult>;               // window / gates / re-entry changed
  revoke(providerRef, reason, ctx): Promise<{ revoked: true }>;                   // withdraw it (idempotent)
  status(providerRef, ctx): Promise<RemoteStatus>;                                // what the provider holds (reconciling)
  parseEvent(rawBody, headers): ProviderEvent | null;                             // a signed callback, validated
  health(signal): Promise<{ ok: boolean; detail: string }>;                       // integration health
}
```

| Prompt operation | Where |
|---|---|
| Provision access request | `provision` |
| Obtain issued credential | `IssueResult.outcome = "active"` carries the token, or a later `CREDENTIAL_ACTIVE` event does |
| Check authorization status | `status` |
| Revoke credential | `revoke` |
| Receive validated events | `parseEvent` → `POST /api/access/providers/:slug/events` |
| Reconcile provider state | `reconcileAccess()` (cron) using `status` |
| Report integration health | `health` → `AccessProvider.lastHealth*`, shown on the venue desk |

**What Maw3ed sends** (`PassRequest`) is data-minimised:

* `externalRef`: Maw3ed's credential id.
* `siteRef`: the venue's reference at the provider, `Venue.accessSiteRef`.
* `holderLabel`: a first name only.
* `holderPhone`: only when the venue requires a phone.
* The window: `validFrom`, `validUntil`, `entryUntil`.
* `gateCodes`: the venue's own gate codes (`VenueGate.code`), not Maw3ed ids.
* `reentryAllowed` and the entitlement `version`.

Never sent: the service, the price, the booking reference or the business's customer record.

**Every call carries:**

* an **idempotency key** (`<credentialId>:<KIND>:<version>`), so a retried call is the same call;
* a **correlation id**, shared by every job, event and log line about one credential;
* an **AbortSignal**, because the caller bounds every call.

**Errors:**

* `TransientProviderError` means the call may succeed later (timeouts, outages, 5xx), so it is retried.
* `ProviderUnavailableError` (`not-configured`, `sandbox-not-allowed`, `disabled`) means it never will here. The job goes dead at once and the credential is `FAILED`.
* `outcome: "refused"` means the provider said no, and the credential is `FAILED`.

## Configuration, scoped per venue

* `AccessProvider` is one row per integration: slug, kind, enabled, last health. **It holds no secret.** A partner's credentials would come from the environment (`ACCESS_PROVIDER_<SLUG>_SECRET`), never the database.
* `Venue.accessProviderId` and `Venue.accessSiteRef` are set by a **platform administrator only** (`venue.access.provider`).
* `Venue.accessEnabled` is switched by the venue's operators (`venue.access.enable`), only when the venue's provider can be used here. A database CHECK refuses "enabled without a provider".
* Policy (`VenuePolicy`) holds:
  * who is admitted by booking;
  * the window before and after;
  * the guest limit;
  * re-entry;
  * allowed gates;
  * the identity requirement;
  * the late-entry cut-off;
  * the no-show cut-off;
  * the escalation contact;
  * the published instructions.

## Calling providers boundedly (`lib/access/sync.ts`)

Every call is an `AccessSyncJob` row first, written in the same transaction as the change that needs it.

| Concern | How |
|---|---|
| Never two workers on one call | Claimed by a conditional update that sets a 60-second lease; a worker that dies releases it when the lease runs out |
| Bounded call time | `withTimeout`, 8 s by default: aborts the signal and stops waiting even if the adapter ignores it |
| Retries | Exponential backoff of 30 s, 1, 2, 4, 8 … minutes, capped at an hour |
| No infinite retry | After 6 attempts the job is `DEAD`. A dead `PROVISION` leaves the credential `FAILED` (visible, customer-retryable, capped at 5 failures per pass). A dead `REVOKE` raises one `ESCALATION`, and the cron asks again hourly, 24 rounds at most. A dead `UPDATE` raises `PROVIDER_ERROR` and **withdraws** the pass, because the provider's copy still carries the old window and gates; once withdrawn, a pass for the current rules is issued |
| Bounded runs | A run takes at most `limit` jobs within a time budget |
| No polling loop | Work runs when something changes (after the response) and on the five-minute cron (`/api/cron/access`); the customer screen re-checks a pending pass at most 10 times, 4 s apart, then offers a button |
| Lost answers | A `REVOKE` for a credential whose provision answer was lost re-asks `provision` with the *same* idempotency key to learn the reference, then revokes it. A credential the provider holds as active, but whose confirmation never arrived, is found by the cron's `status` check and recovered the same way (re-asked with the original key, which returns the same pass and token), not marked failed |
| Out-of-order and late answers | Confirmations are conditional on state and version: a late confirmation never revives a withdrawn credential, and an older version never replaces a newer one |

## Callbacks (`POST /api/access/providers/:slug/events`, `lib/access/events.ts`)

1. The body is capped at 16 KB.
2. The adapter checks the signature, the timestamp (5 minutes either way, so a captured callback cannot be replayed later) and the shape. Anything else gets **401**. Unsigned or failed requests are rate-limited per address; signed callbacks never are, because a gate system reports every entry.
3. Effects are applied idempotently. Then the event is recorded once: `AccessEvent` is unique on `(providerId, providerEventId)`, so a provider's retried delivery answers **200 duplicate** and is not counted twice.
4. A callback for a credential Maw3ed does not know (yet) answers **409** and is not recorded, so the provider retries it: a confirmation can race the answer that tells Maw3ed the provider's reference. An unknown provider gets **404**. A provider not usable here gets **409**.
5. A provider withdrawing a credential on its own marks it `FAILED` ("revoked by the provider"). The holder sees it and may ask again; nothing re-issues it automatically.

Entry, denial and exit events are recorded for the venue's security desk. They change nothing about the booking, and the business does not see them.

## The sandbox provider (`lib/access/sandbox.ts`)

* It imitates an external system with its own store (`SandboxAccessPass`), which nothing else reads. Maw3ed learns about it only through adapter calls and signed events, as it would from a real provider.
* Its failure modes drive every path a real provider can take:

| Mode | Behaviour |
|---|---|
| `NORMAL` | Issues at once |
| `NO_CONFIRM` | Accepts, and confirms only when told |
| `DOWN` | Every call fails |
| `TIMEOUT` | Every call hangs |
| `REFUSE` | Refuses every new pass |

* Its gate checks, in order:
  1. the site (a pass is refused at another venue);
  2. the window;
  3. the late-entry cut-off;
  4. the allowed gates;
  5. anti-passback (one person inside per pass);
  6. re-entry.
* **Isolated from production.** `sandboxAllowed()` is false on Vercel (production *and* preview) and false in any production build unless `ACCESS_SANDBOX=1` marks the machine as a QA box. Every entry point checks it. Its tokens start `SANDBOX-`, and every screen showing one says it is valid at no real gate.
* Driven in QA by `POST /api/dev/access-sandbox` (404 unless the sandbox is allowed, and requires the cron secret).

## Adding a real provider (status E: BLOCKED)

This needs, in order:

1. An agreement with the operator.
2. Their written API specification.
3. Credentials issued to Maw3ed.
4. An approved integration test against their test environment.

Only then:

1. Write `lib/access/partners/<slug>.ts` implementing the adapter.
2. Register it in `partnerAdapters`.
3. Add its secret to the environment.
4. Create its `AccessProvider` row.
5. Have a platform administrator assign it to the venue.

Until all of that exists, a `PARTNER` provider is unusable. Assigning one is refused, a venue with one offers no passes, and any call to one fails as "not configured". Nothing claims compatibility with any real gate.
