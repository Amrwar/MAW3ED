import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Keeps the mobile app able to call the API at all.
 *
 * There are two ways to be signed in here: the cookie the website
 * sends, and the bearer token the app sends. `auth()` reads only the
 * first. A route that calls it directly therefore answers 401 to every
 * request the app makes — and nothing about that is visible in review,
 * because the route is correct from the website's point of view and its
 * tests pass.
 *
 * When this was written that had happened to nine routes, including all
 * three under /api/account, which is the entire customer half of the
 * app. requireSession() and requireBusiness() accept both, so routes
 * use those.
 *
 * check-slug is the one exception: it is part of web onboarding, which
 * the app does not have.
 */

const ROOT = process.cwd();

/** Routes the mobile app is expected to be able to reach. */
const MOBILE_FACING = "src/app/api";

const EXEMPT = new Set([
  // Web onboarding only; the app never creates a business.
  "src/app/api/business/check-slug/route.ts",
]);

/** Walked rather than globbed: fs.globSync is not in this TS lib. */
function routeFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (name === "route.ts" && !EXEMPT.has(rel)) out.push(rel);
    }
  };
  for (const area of ["account", "business"]) walk(`${MOBILE_FACING}/${area}`);
  return out;
}

describe("routes the mobile app calls", () => {
  it("finds the route files at all", () => {
    // Without this the test below passes by finding nothing.
    expect(routeFiles().length).toBeGreaterThan(20);
  });

  it("never authenticates with auth() alone", () => {
    const cookieOnly: string[] = [];

    for (const file of routeFiles()) {
      const source = readFileSync(join(ROOT, file), "utf8");
      const usesBearerCapable = /require(Session|Business)\s*\(/.test(source);
      const callsAuthDirectly = /\bawait auth\s*\(\s*\)/.test(source);

      if (callsAuthDirectly && !usesBearerCapable) {
        cookieOnly.push(relative(ROOT, file).replace(/\\/g, "/"));
      }
    }

    // Named, not counted: the fix is per-route — swap auth() for
    // requireSession(), or requireBusiness() when it needs the business.
    expect(cookieOnly).toEqual([]);
  });

  it("gives the account routes a way to read, not only write", () => {
    // The app restores a session and renders screens by reading. These
    // three had only PATCH or POST handlers, so GET returned 404 and
    // the app read that as an expired session and signed the user out
    // on every cold start.
    for (const file of [
      "src/app/api/account/profile/route.ts",
      "src/app/api/account/notifications/route.ts",
      "src/app/api/account/bookings/route.ts",
    ]) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(source, file).toMatch(/export async function GET/);
    }
  });
});
