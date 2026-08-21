import { describe, expect, it } from "vitest";

import { bookingPageUrl, siteUrl } from "./url";

/**
 * The base is read once, when the module loads, from AUTH_URL. These tests
 * work against whatever it resolved to rather than pinning the domain, so
 * they hold on a preview deployment as well as in production.
 */
const BASE = siteUrl("/").replace(/\/$/, "");

describe("the base url", () => {
  it("is absolute", () => {
    expect(BASE).toMatch(/^https?:\/\//);
  });

  it("carries no trailing slash, so joins cannot double up", () => {
    expect(BASE.endsWith("/")).toBe(false);
  });
});

describe("siteUrl", () => {
  it("joins a rooted path", () => {
    expect(siteUrl("/pricing")).toBe(`${BASE}/pricing`);
  });

  it("adds the missing slash rather than gluing two words together", () => {
    expect(siteUrl("pricing")).toBe(`${BASE}/pricing`);
  });

  it("spells both forms the same way", () => {
    expect(siteUrl("pricing")).toBe(siteUrl("/pricing"));
  });

  it("keeps a nested path intact", () => {
    expect(siteUrl("/business/cairo/salon")).toBe(`${BASE}/business/cairo/salon`);
  });

  it("never produces a double slash after the host", () => {
    const path = siteUrl("/pricing").replace(/^https?:\/\/[^/]+/, "");
    expect(path).not.toContain("//");
  });

  it("keeps a query string", () => {
    expect(siteUrl("/search?city=cairo")).toBe(`${BASE}/search?city=cairo`);
  });
});

describe("bookingPageUrl", () => {
  it("puts the token on the booking path", () => {
    expect(bookingPageUrl("abc123")).toBe(`${BASE}/booking/abc123`);
  });

  it("is absolute, since it is sent to customers", () => {
    expect(bookingPageUrl("abc123")).toMatch(/^https?:\/\//);
  });

  it("agrees with siteUrl for the same path", () => {
    expect(bookingPageUrl("abc123")).toBe(siteUrl("/booking/abc123"));
  });

  it("gives a different url for a different token", () => {
    expect(bookingPageUrl("one")).not.toBe(bookingPageUrl("two"));
  });

  it("does not swallow a token that looks like a path", () => {
    expect(bookingPageUrl("a/b")).toBe(`${BASE}/booking/a/b`);
  });
});
