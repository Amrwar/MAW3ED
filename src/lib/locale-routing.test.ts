import { describe, expect, it } from "vitest";

import { routeLocale } from "./locale-routing";

const get = (pathname: string, search = "", cookieLang?: string) =>
  routeLocale({ pathname, search, method: "GET", cookieLang });

describe("routeLocale", () => {
  it("serves a bare public page in Arabic to a visitor with no choice saved, as a crawler is", () => {
    expect(get("/businesses")).toEqual({ type: "next", lang: "ar" });
    expect(get("/")).toEqual({ type: "next", lang: "ar" });
  });

  it("serves /en/x as /x in English, remembering it only when nothing was chosen", () => {
    expect(get("/en/faq")).toEqual({ type: "rewrite", to: "/faq", lang: "en", remember: "en" });
    expect(get("/en", "?q=1")).toEqual({ type: "rewrite", to: "/?q=1", lang: "en", remember: "en" });
    expect(get("/en/faq", "", "en")).toEqual({ type: "rewrite", to: "/faq", lang: "en" });
    // Somebody who chose Arabic reads this one link in English, and that is all.
    expect(get("/en/faq", "", "ar")).toEqual({ type: "rewrite", to: "/faq", lang: "en" });
  });

  it("never redirects to another site", () => {
    for (const [path, search, cookie] of [["/ar//evil.com/x", ""], ["//evil.com/a", "?lang=ar"], ["//evil.com/a", "", "en"], ["/en//evil.com", ""]] as const) {
      const action = get(path, search, cookie);
      expect(action.type, path).toBe("next");
    }
  });

  it("sends somebody who chose English from a bare link to the English page", () => {
    expect(get("/company/x", "?src=qr", "en")).toEqual({ type: "redirect", to: "/en/company/x?src=qr" });
  });

  it("never redirects a post, which would drop its body", () => {
    expect(routeLocale({ pathname: "/company/x", search: "", method: "POST", cookieLang: "en" })).toEqual({
      type: "next",
      lang: "en",
    });
  });

  it("sends /ar/x to the bare page", () => {
    expect(get("/ar/faq", "?a=1", "en")).toEqual({ type: "redirect", to: "/faq?a=1", remember: "ar", permanent: true });
    expect(get("/ar")).toEqual({ type: "redirect", to: "/", remember: "ar", permanent: true });
  });

  it("turns ?lang= into the twin's address, keeping the rest of the query", () => {
    expect(get("/privacy", "?lang=en")).toEqual({ type: "redirect", to: "/en/privacy", remember: "en", permanent: true });
    expect(get("/en/privacy", "?lang=ar&x=1", "en")).toEqual({ type: "redirect", to: "/privacy?x=1", remember: "ar", permanent: true });
  });

  it("keeps one address for single-address sections, in the saved language", () => {
    expect(get("/en/dashboard/bookings", "?a=1")).toEqual({
      type: "redirect",
      to: "/dashboard/bookings?a=1",
      remember: "en",
    });
    expect(get("/dashboard", "", "en")).toEqual({ type: "next", lang: "en" });
    expect(get("/dashboard")).toEqual({ type: "next", lang: "ar" });
    expect(get("/api/public/x", "?lang=en", "en")).toEqual({ type: "next", lang: "en" });
  });

  it("leaves files alone", () => {
    expect(get("/sitemap.xml", "", "en")).toEqual({ type: "next", lang: "en" });
  });
});

describe("redirect permanence (Phase 26)", () => {
  const go = (pathname: string, search = "", cookieLang?: string) =>
    routeLocale({ pathname, search, method: "GET", cookieLang });
  it("permanent only where the URL alone decides the target", () => {
    expect(go("/ar/faq")).toMatchObject({ type: "redirect", permanent: true });
    expect(go("/faq", "?lang=en")).toMatchObject({ type: "redirect", permanent: true });
    // The cookie decides these: temporary, so the server is asked every time.
    expect(go("/faq", "", "en")).not.toHaveProperty("permanent");
    expect(go("/en/dashboard")).not.toHaveProperty("permanent");
  });
  it("never redirects to itself: following a redirect once lands where no redirect is left", () => {
    for (const [p, q, c] of [["/ar/faq", "", undefined], ["/faq", "?lang=en", undefined], ["/faq", "", "en"], ["/en/dashboard", "", "en"], ["/ar", "?lang=en", undefined]] as const) {
      const first = go(p, q, c);
      if (first.type !== "redirect") continue;
      const u = new URL(first.to, "https://x.test");
      const second = go(u.pathname, u.search, first.remember ?? c);
      expect(second.type, `${p}${q} → ${first.to}`).not.toBe("redirect");
    }
  });
});
