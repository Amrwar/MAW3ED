/**
 * What crash reports must never carry: request bodies, auth headers and
 * phone numbers. Pure, so it is tested without the Sentry SDK.
 *
 * Phone numbers are the app's identity (sign-in is by phone), and they
 * turn up in error messages ("no account for +2010…"), URLs and
 * breadcrumbs. Anything that looks like one — 9 to 15 digits, optionally
 * with +, spaces or dashes — is replaced, wherever free text can appear.
 * Stack frames and debug metadata are left alone: they are code, not
 * people, and redacting them would break symbolication.
 */

const PHONE = /(^|[^\w.-])(\+?\d(?:[\s-]?\d){8,14})(?![\w-])/g;
const REDACTED = "[phone]";

export function redactPhones(text: string): string {
  return text.replace(PHONE, (_m, before: string) => `${before}${REDACTED}`);
}

/** Every string inside a value, redacted; depth-limited against cycles. */
export function redactDeep<T>(value: T, depth = 0): T {
  if (depth > 6) return value;
  if (typeof value === "string") return redactPhones(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v, depth + 1);
    return out as T;
  }
  return value;
}

/** The parts of a Sentry event this touches — structural, so no SDK import. */
type ScrubbableEvent = {
  message?: string;
  exception?: { values?: { value?: string }[] };
  request?: { data?: unknown; headers?: Record<string, string>; cookies?: unknown; url?: string; query_string?: unknown };
  breadcrumbs?: ScrubbableBreadcrumb[];
  extra?: Record<string, unknown>;
};
type ScrubbableBreadcrumb = { message?: string; data?: Record<string, unknown> };

/** Strips bodies and auth from a breadcrumb (fetch/xhr ones carry request data). */
export function scrubBreadcrumb<B extends ScrubbableBreadcrumb>(crumb: B): B {
  const out = { ...crumb };
  if (out.message) out.message = redactPhones(out.message);
  if (out.data) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out.data)) {
      if (/body|authorization|cookie|token/i.test(k)) continue;
      data[k] = redactDeep(v);
    }
    out.data = data;
  }
  return out;
}

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const out = { ...event };
  if (out.message) out.message = redactPhones(out.message);
  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) => (v.value ? { ...v, value: redactPhones(v.value) } : v)),
    };
  }
  if (out.request) {
    // No body and no headers at all: the Authorization header is the
    // obvious one, but a body is a phone number, a code or a name.
    const { data: _data, headers: _headers, cookies: _cookies, ...rest } = out.request;
    out.request = {
      ...rest,
      ...(rest.url ? { url: redactPhones(rest.url) } : {}),
      ...(rest.query_string !== undefined ? { query_string: redactDeep(rest.query_string) } : {}),
    };
  }
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);
  if (out.extra) out.extra = redactDeep(out.extra);
  return out;
}
