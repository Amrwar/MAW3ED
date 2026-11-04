/**
 * What an API key may read (docs/enterprise/INTEGRATION_GUIDE.md). Read-only
 * by design in Phase 28: an integration observes; changes to bookings,
 * businesses and memberships stay in the product, behind its own checks.
 */
export const API_SCOPES = [
  "organization:read",
  "businesses:read",
  "venues:read",
  "bookings:read",
  "reports:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(s: string): s is ApiScope {
  return (API_SCOPES as readonly string[]).includes(s);
}

/** The events an endpoint can subscribe to. */
export const WEBHOOK_EVENTS = ["booking.created", "booking.updated", "association.updated"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEvent(s: string): s is WebhookEventType {
  return (WEBHOOK_EVENTS as readonly string[]).includes(s);
}
