import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Every API route either checks who is calling or is on the list of
 * routes that are meant to be open. A new route that does neither
 * fails this test, so "forgot the guard" is caught before it ships
 * rather than by somebody probing production.
 *
 * The guards are the ones lib/api, lib/business-access, lib/admin/guard
 * and lib/security/cron-auth export. A route that authenticates in its
 * own way (a signed webhook, a booking's access token, the fake Paymob
 * gate) is named here with the reason.
 */

const ROOT = process.cwd();
const API = join(ROOT, "src/app/api");

const GUARDS = [
  "requireSession(",
  "requireBusiness(",
  "requireBusinessAccess(",
  "requireBusinessAccessAny(",
  "requireAdminApi(",
  "currentCaller(",
  "authorizeCron(",
  "requireVenueAccess(",
  "loadVenueCaller(",
  "requireOrgAccess(",
];

/** Routes open on purpose, with what protects them instead. */
const OPEN: Record<string, string> = {
  "auth/[...nextauth]": "NextAuth: its own CSRF token and providers",
  "auth/forgot-password": "public by design; rate-limited; same answer whether the account exists",
  "auth/mobile/login": "credentials in the body; rate-limited",
  "auth/mobile/logout": "the refresh token in the body is the credential",
  "auth/mobile/otp": "the one-time code is the credential; rate-limited per address and per number",
  "auth/mobile/refresh": "the refresh token is the credential; rotated; rate-limited",
  "auth/phone/send": "public by design; cooldown and hourly cap per number",
  "auth/reset-password": "the emailed token is the credential; rate-limited",
  "auth/signup": "public by design; rate-limited",
  "auth/verify-email/confirm": "the emailed token is the credential; rate-limited",
  "auth/verify-email/send": "reads the session itself via auth()",
  "booking/[token]/cancel": "the booking's access token in the path",
  "booking/[token]/reschedule": "the booking's access token in the path",
  "business/check-slug": "public read of slug availability; no data returned beyond taken/free",
  "dev/paymob/checkout": "fakePaymobEnabled(): local only",
  "public/[slug]/bookings": "public booking; rate-limited per address and per number; phone proof when enabled",
  "public/[slug]/quote": "public read",
  "public/[slug]/reviews": "public read",
  "public/[slug]/route": "public read",
  "public/[slug]/slots": "public read",
  "public/[slug]/view": "public write of an aggregate counter; rate-limited",
  "public/booking/[token]/calendar": "the booking's access token in the path",
  "public/booking/[token]/pay": "the booking's access token in the path",
  "public/booking/[token]/review": "the booking's access token in the path",
  "public/booking/[token]/route": "the booking's access token in the path",
  "public/booking/[token]/slots": "the booking's access token in the path",
  "public/businesses/nearby": "public read",
  "public/businesses/route": "public read",
  "public/venues/route": "public read of published venues only",
  "public/groups/route": "public read of published organizations only",
  "public/groups/[slug]/route": "public read of a published organization and its approved directory only",
  "public/groups/[slug]/view": "public write of an aggregate counter; rate-limited per organization and address",
  "public/org-invites/[token]": "the unguessable invitation token is the credential; shows only who invited",
  "public/venues/[slug]": "public read of a published venue and its approved directory only",
  "public/facets": "public read",
  "public/phone-proof": "public by design; rate-limited per number and address",
  "public/reviews/[id]/helpful": "public; rate-limited; vote keyed on a signed anonymous identity",
  "public/reviews/[id]/report": "public; rate-limited",
  "public/waitlist/confirm": "the emailed token is the credential",
  "public/waitlist/route": "public by design; rate-limited",
  "realtime/bookings": "requireBusiness-style check inline (see route)",
  "version": "public read of the build id",
  "webhooks/paymob": "HMAC signature, verifyWebhookHmac()",
};

function routes(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routes(p));
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

const key = (file: string) => {
  const rel = relative(API, file).replace(/\\/g, "/").replace(/\/route\.ts$/, "");
  // "public/[slug]" and "public/[slug]/route" are distinct keys only when
  // a directory has both a route and child routes; keep the explicit form.
  const dir = join(API, rel);
  const hasChildren = readdirSync(dir).some((n) => statSync(join(dir, n)).isDirectory());
  return hasChildren ? `${rel}/route` : rel;
};

describe("every API route is guarded or deliberately open", () => {
  const all = routes(API);

  it("finds the routes", () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it("has a guard, or a reason not to", () => {
    const unguarded: string[] = [];
    for (const file of all) {
      const source = readFileSync(file, "utf8");
      const guarded = GUARDS.some((g) => source.includes(g));
      const k = key(file);
      if (!guarded && !(k in OPEN)) unguarded.push(k);
    }
    expect(unguarded).toEqual([]);
  });

  it("does not list a route as open when it is in fact guarded, or no longer exists", () => {
    const keys = new Set(all.map(key));
    const stale = Object.keys(OPEN).filter((k) => !keys.has(k));
    expect(stale).toEqual([]);
    const guardedButListed = all
      .filter((f) => GUARDS.some((g) => readFileSync(f, "utf8").includes(g)))
      .map(key)
      .filter((k) => k in OPEN && !OPEN[k].startsWith("reads the session") && !OPEN[k].startsWith("requireBusiness-style") && !OPEN[k].startsWith("public booking"));
    expect(guardedButListed).toEqual([]);
  });
});
