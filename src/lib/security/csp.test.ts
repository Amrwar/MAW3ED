import { describe, it, expect } from "vitest";
import { buildCsp, generateNonce } from "./csp";

/**
 * A CSP fails in two directions and both are quiet.
 *
 * Too loose and it is decoration — it passes review, ships, and stops
 * nothing. Too tight and it blocks the page's own scripts, which on a
 * booking site means the widget never hydrates and nobody can book.
 *
 * The enforced policy was checked in a browser against the production
 * build: the homepage, a full business profile and the login page load
 * with no console output at all, and clicking a service advances the
 * booking widget to step two. These tests hold the shape in place so
 * that stays true.
 */

const nonce = "dGVzdC1ub25jZS0xMjM0";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe("the policy", () => {
  it("carries the nonce into script-src", () => {
    const d = directives(buildCsp({ nonce }));
    expect(d.get("script-src")).toContain(`'nonce-${nonce}'`);
  });

  it("never allows eval in production", () => {
    // eval turns an injected string into running code, which is most of
    // what the policy is here to prevent.
    expect(buildCsp({ nonce })).not.toContain("unsafe-eval");
  });

  it("allows eval in development, where hot reloading needs it", () => {
    expect(buildCsp({ nonce, development: true })).toContain("'unsafe-eval'");
  });

  it("never allows inline script, in either mode", () => {
    // 'unsafe-inline' would make the nonce meaningless: browsers ignore
    // a nonce when it is present, so this would silently undo the whole
    // policy while still looking like a policy.
    for (const development of [false, true]) {
      const scriptSrc = directives(buildCsp({ nonce, development })).get("script-src")!;
      expect(scriptSrc, String(development)).not.toContain("'unsafe-inline'");
    }
  });

  it("shuts the doors that do not need to be open", () => {
    const d = directives(buildCsp({ nonce }));
    expect(d.get("object-src")).toEqual(["'none'"]);
    expect(d.get("base-uri")).toEqual(["'self'"]);
    expect(d.get("form-action")).toEqual(["'self'"]);
    expect(d.get("frame-ancestors")).toEqual(["'self'"]);
  });

  it("allows the two image hosts next.config.ts allows", () => {
    // If these disagree, next/image serves a URL the browser refuses
    // and every business logo breaks.
    const imgSrc = directives(buildCsp({ nonce })).get("img-src")!;
    expect(imgSrc).toContain("https://res.cloudinary.com");
    expect(imgSrc).toContain("https://images.unsplash.com");
  });

  it("upgrades insecure requests in production but not in development", () => {
    // On http://localhost this directive would upgrade every request to
    // https and nothing would load.
    expect(buildCsp({ nonce })).toContain("upgrade-insecure-requests");
    expect(buildCsp({ nonce, development: true })).not.toContain("upgrade-insecure-requests");
  });

  it("has a default to fall back to", () => {
    expect(directives(buildCsp({ nonce })).get("default-src")).toEqual(["'self'"]);
  });
});

describe("the nonce", () => {
  it("is different every time", () => {
    // A predictable or reused nonce is the one failure that makes the
    // whole policy decorative: an attacker who can guess it can author
    // a script tag that passes.
    const seen = new Set(Array.from({ length: 200 }, () => generateNonce()));
    expect(seen.size).toBe(200);
  });

  it("is long enough to be unguessable", () => {
    // 16 bytes, base64. Anything much shorter is brute-forceable.
    expect(generateNonce().length).toBeGreaterThanOrEqual(22);
  });

  it("contains nothing that would break out of the header", () => {
    // A nonce carrying a quote or a semicolon could terminate the
    // directive and rewrite the policy around it.
    for (let i = 0; i < 50; i++) {
      expect(generateNonce()).toMatch(/^[A-Za-z0-9+/=]+$/);
    }
  });
});
