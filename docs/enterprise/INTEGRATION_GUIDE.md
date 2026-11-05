# Integration guide (developers)

For an organization connecting its own systems (BI, ERP, a mall's tenant portal) to Maw3ed.
Requires a contract with the platform (ask support); the organization's owner then creates
keys and webhooks in the console: **Organization console → Integrations**.

## Authentication

```
GET https://www.maw3ed.net/api/v1/organization
Authorization: Bearer mw_<prefix>_<secret>
```

- A key is shown **once**, when created or rotated. Maw3ed stores only its SHA-256.
- Keys carry scopes: `organization:read`, `businesses:read`, `venues:read`, `bookings:read`,
  `reports:read`. A missing scope → `403 insufficient-scope`.
- **Rotation**: rotating gives a new key; the old one keeps working for the grace you choose
  (0–72 h, default 24 h), then stops. **Revocation** is immediate.
- Errors are JSON `{ "error": { "code": "…" } }`: `401 unauthorized` (missing, unknown,
  revoked or expired key — deliberately one answer), `403 no-contract`, `403
  insufficient-scope`, `404 not-found`, `400 bad-range`, `429 rate-limited`, `503 api-disabled`.

## Rate limits and usage

Per key, per minute, as the contract says (default 120). Over it: `429` with `Retry-After`
(seconds). Usage is counted per key per day and shown in the console.

## Endpoints (v1, read-only)

| Endpoint | Returns |
|---|---|
| `GET /api/v1/organization` | the organization, relationship counts, contract limits, the key's scopes |
| `GET /api/v1/businesses?limit=&cursor=` | approved associations: relation, granted scopes, branch, public business fields |
| `GET /api/v1/venues?limit=&cursor=` | the organization's venues; whether visitor access is on |
| `GET /api/v1/bookings?businessId=&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=&cursor=` | one business, ≤ 31 days; ids, times, statuses, service/staff/resource ids — **never customer details** |
| `GET /api/v1/reports/portfolio?days=7\|30\|90` | per-business counts (REPORTS) and revenue (FINANCE) |

**Pagination**: `limit` 1–100 (default 50). Responses carry `nextCursor`; pass it back as
`cursor` until it is `null`. Cursors are stable under inserts (ordered by id or start time).

**Versioning**: the version is in the path. Within `v1` fields are only added, never removed
or renamed; a breaking change would be `v2`, with `v1` kept running for a published period.

## Webhooks

Events: `booking.created`, `booking.updated`, `association.updated` (plus `ping` from the
console's test button).

```
POST <your https URL>
Content-Type: application/json
Maw3ed-Event-Id: booking:<bookingId>:<updatedAtMs>
Maw3ed-Event-Type: booking.updated
Maw3ed-Signature: t=1793830000,v1=<hex>[,v1=<hex during a secret rotation>]

{"id":"…","type":"booking.updated","createdAt":"…","data":{ "id":"…", "status":"CANCELLED", … }}
```

- **Verify** every request: compute `HMAC-SHA256(secret, t + "." + rawBody)` as hex and compare
  (constant-time) with any `v1`; reject if `|now − t| > 300` seconds.
- **Idempotency**: an event id is unique; you may receive one more than once (at-least-once).
  Store the ids you processed and ignore repeats.
- **Order**: events for one booking arrive in change order within a run; across retries they
  may not — use `data.updatedAt`.
- **Answer 2xx within 5 seconds.** Anything else (or a timeout, or a redirect — redirects
  are not followed) is a failure: retried after 1 min, 5 min, 15 min, 1 h, 3 h, 6 h, 12 h —
  8 attempts in all, then abandoned (visible in the console as DEAD).
- **Auto-disable**: 20 failures in a row switch the endpoint off; switch it back on in the
  console when fixed.
- **Latency**: events are read from a change feed every 5 minutes.
- **Secret rotation**: rotating gives a new secret; for 24 hours both are signed with (two
  `v1` values), so you can deploy the new one without dropping events.
- **Addresses**: HTTPS, default port, a public host. Private, loopback, link-local and cloud
  metadata addresses are refused when saved and again before every send. Residual risk: a host
  whose DNS answer changes between the check and the connection (DNS rebinding) — mitigated by
  the per-send re-check and the short timeout; not eliminated.

## Privacy

Integrations receive what the business granted the organization and nothing about its
customers' identity. A mall (HOSTED relationship) never receives its tenants' bookings.
