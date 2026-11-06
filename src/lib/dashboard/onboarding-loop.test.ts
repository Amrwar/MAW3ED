import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * /dashboard and /onboarding must not disagree about whether somebody
 * has a business.
 *
 * Each one sends you to the other when it decides you are in the wrong
 * place, so the moment their answers differ the browser bounces between
 * them until it gives up. Reported from production as a dashboard that
 * "keeps redirecting to the same page over and over" — on a phone and
 * not a laptop, because the phone was carrying an older session.
 *
 * The cause was an asymmetry. The dashboard looked the business up and
 * checked it existed; onboarding had a fast path that redirected
 * whenever session.user.businessId was merely set. A token naming a
 * business that had since been deleted satisfied one and failed the
 * other, permanently. A session token is minted at sign-in and lives
 * for days, which is plenty of time for the business it names to go
 * away.
 *
 * Reproduced before the fix by deleting a business while holding a
 * valid session: curl stopped after 12 redirects. After it, one
 * redirect and the onboarding form.
 *
 * The rule these tests hold: neither page may decide from the token
 * alone.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const ONBOARDING = "src/app/onboarding/page.tsx";
const DASHBOARD_LAYOUT = "src/app/dashboard/layout.tsx";
const DASHBOARD_GUARD = "src/lib/dashboard/guard.ts";

describe("the onboarding page", () => {
  const source = read(ONBOARDING);

  it("redirects away only after looking the business up", () => {
    const lookup = source.indexOf("db.business.findUnique");
    const redirectToDashboard = source.indexOf('redirect("/dashboard")');
    expect(lookup).toBeGreaterThan(-1);
    expect(redirectToDashboard).toBeGreaterThan(-1);
    // The lookup has to come first. The other way round is the bug.
    expect(lookup).toBeLessThan(redirectToDashboard);
  });

  it("never redirects on the token's businessId alone", () => {
    // The exact shape of the fast path that caused the loop:
    //   if (session.user.businessId) redirect("/dashboard");
    expect(source).not.toMatch(
      /if\s*\(\s*session\.user\.businessId\s*\)\s*redirect\(\s*["']\/dashboard["']\s*\)/,
    );
  });
});

describe("the dashboard", () => {
  it("falls back to ownerId when the token's business is gone", () => {
    // This is the half that was already right: a stale id must not
    // strand an owner who does have a business.
    for (const file of [DASHBOARD_LAYOUT, DASHBOARD_GUARD]) {
      const source = read(file);
      expect(source, file).toContain("ownerId");
      expect(source, file).toContain("db.business.findUnique");
    }
  });

  it("sends somebody with no business to onboarding", () => {
    // The other side of the pair. Both directions have to exist, or
    // one of the two pages becomes unreachable.
    // Both go through noBusinessDestination, which sends an owner to
    // onboarding and a customer (verified phone, no password) to their
    // account — a customer is not somebody about to set up a business.
    expect(read(DASHBOARD_LAYOUT)).toContain("redirect(await noBusinessDestination(");
    expect(read(DASHBOARD_GUARD)).toContain("redirect(await noBusinessDestination(");
    expect(read(DASHBOARD_GUARD)).toMatch(/:\s*"\/onboarding"/);
  });
});

describe("the pair, together", () => {
  it("both decide from the database", () => {
    // Stated once, plainly: whichever page is asked, the answer comes
    // from the same place, so they cannot disagree.
    for (const file of [ONBOARDING, DASHBOARD_LAYOUT, DASHBOARD_GUARD]) {
      expect(read(file), file).toContain("db.business.findUnique");
    }
  });
});

/**
 * Every dashboard page, not only the layout: a page that sends you to
 * /onboarding on the token's businessId alone loops just the same
 * (found in the post-Phase-28 audit on /dashboard, /dashboard/analytics
 * and /dashboard/referrals).
 */
describe("dashboard pages", () => {
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (name === "page.tsx") pages.push(rel);
    }
  };
  walk("src/app/dashboard");

  it("found the pages", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  it.each(pages)("%s never decides on the token's businessId alone", (p) => {
    const source = read(p);
    // Any spelling of "no businessId in the token, so onboarding".
    expect(source).not.toMatch(/businessId\)\s*(return\s+)?redirect\(\s*["'`]\/onboarding/);
    // A page that can send you to onboarding must have looked the
    // business up the way onboarding does: through a guard, or by owner.
    if (/redirect\(\s*["'`]\/onboarding/.test(source)) {
      expect(source).toMatch(/requireBusinessPage|requireDashboardAccess|ownerId/);
    }
  });
});
