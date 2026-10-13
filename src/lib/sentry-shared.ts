import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Settings shared by every Sentry runtime.
 *
 * Sentry stays OFF unless a DSN is configured, so the SDK is inert in
 * development, in CI and on any deploy that has not been given a DSN.
 */
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";

export const SENTRY_ENABLED = SENTRY_DSN.length > 0;

/**
 * Bookings carry Egyptian customers' names, phone numbers and email
 * addresses. The logger already redacts what it sends, but Sentry's SDK
 * collects request data, headers and breadcrumbs on its own, so it needs
 * its own scrubbing before anything leaves the app.
 */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/**
 * Phone numbers from any country: a "+"/"00" international number, or a
 * run of 10 to 15 digits (a local 01XXXXXXXXX, or one written without
 * its plus), even glued to letters ("user_01012345678"). Deliberately
 * broad: a 13-digit string ID is redacted too — losing an ID from a log
 * line costs less than leaking a number. It used to match Egyptian
 * mobiles only, so a customer from
 * elsewhere would have had their number written into Sentry.
 */
const PHONE_RE = /(?:\+|(?<!\d)00)\d(?:[\s-]?\d){6,14}|(?<!\d)\d{10,15}(?!\d)/g;

const SENSITIVE_HEADER = /authorization|cookie|x-api-key|token|secret/i;

function scrub(value: string): string {
  return value.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
}

function scrubDeep(input: unknown, depth = 0): unknown {
  if (depth > 6 || input == null) return input;
  if (typeof input === "string") return scrub(input);
  if (typeof input === "number" || typeof input === "boolean") return input;
  if (Array.isArray(input)) return input.map((v) => scrubDeep(v, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = SENSITIVE_HEADER.test(k) ? "[redacted]" : scrubDeep(v, depth + 1);
    }
    return out;
  }
  return input;
}

/**
 * Last gate before an event is sent. Returning null drops it.
 */
export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  if (!SENTRY_ENABLED) return null;

  // Identify the account, never the person.
  if (event.user) {
    event.user = { id: event.user.id };
  }

  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      event.request.headers = scrubDeep(event.request.headers) as Record<string, string>;
    }
    if (event.request.data) {
      event.request.data = scrubDeep(event.request.data);
    }
    if (event.request.query_string) {
      event.request.query_string = scrubDeep(event.request.query_string) as typeof event.request.query_string;
    }
    if (typeof event.request.url === "string") {
      event.request.url = scrub(event.request.url);
    }
  }

  if (event.extra) event.extra = scrubDeep(event.extra) as typeof event.extra;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? scrub(b.message) : b.message,
      data: scrubDeep(b.data) as typeof b.data,
    }));
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((v) => ({
      ...v,
      value: v.value ? scrub(v.value) : v.value,
    }));
  }

  return event;
}

export const sharedOptions = {
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  // Sampled, not exhaustive: traces are the expensive part of the quota
  // and this is an error tracker first.
  tracesSampleRate: 0.1,
  // PII is scrubbed in beforeSend; this stops the SDK volunteering more.
  sendDefaultPii: false,
  beforeSend,
};
