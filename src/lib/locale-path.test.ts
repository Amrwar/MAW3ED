import { describe, expect, it } from "vitest";

import { hasTwin, localizePath, splitLang } from "./locale-path";

describe("hasTwin", () => {
  it("is true for public pages", () => {
    for (const p of ["/", "/businesses", "/company/a-salon", "/cairo/clinics", "/privacy", "/login", "/account-login", "/account-deletion"]) {
      expect(hasTwin(p), p).toBe(true);
    }
  });

  it("is false for single-address sections, matched by whole segment", () => {
    for (const p of ["/dashboard", "/dashboard/bookings", "/account", "/account/upcoming", "/api/public/x", "/admin", "/booking/tok", "/ref/abc"]) {
      expect(hasTwin(p), p).toBe(false);
    }
  });

  it("is false for files", () => {
    for (const p of ["/sitemap.xml", "/robots.txt", "/og.png", "/manifest.webmanifest"]) {
      expect(hasTwin(p), p).toBe(false);
    }
  });
});

describe("splitLang", () => {
  it("reads the prefix as a whole segment", () => {
    expect(splitLang("/en")).toEqual({ lang: "en", path: "/" });
    expect(splitLang("/en/businesses")).toEqual({ lang: "en", path: "/businesses" });
    expect(splitLang("/ar/faq")).toEqual({ lang: "ar", path: "/faq" });
    expect(splitLang("/english")).toEqual({ lang: null, path: "/english" });
    expect(splitLang("/businesses")).toEqual({ lang: null, path: "/businesses" });
  });
});

describe("localizePath", () => {
  it("prefixes public pages for English, keeping query and hash", () => {
    expect(localizePath("/", "en")).toBe("/en");
    expect(localizePath("/businesses?sort=soonest", "en")).toBe("/en/businesses?sort=soonest");
    expect(localizePath("/company/x#booking", "en")).toBe("/en/company/x#booking");
    expect(localizePath("/?q=1", "en")).toBe("/en?q=1");
  });

  it("leaves Arabic bare", () => {
    expect(localizePath("/businesses", "ar")).toBe("/businesses");
  });

  it("leaves single-address sections, other sites and anchors alone", () => {
    for (const h of ["/dashboard", "/account/upcoming", "/api/x", "https://wa.me/1", "//cdn.x/y", "#main", "mailto:a@b.c", "/og.png"]) {
      expect(localizePath(h, "en"), h).toBe(h);
    }
  });

  it("never prefixes twice", () => {
    expect(localizePath("/en/faq", "en")).toBe("/en/faq");
    expect(localizePath("/en/faq", "ar")).toBe("/en/faq");
  });
});
