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
    expect(get("/ar/faq", "?a=1", "en")).toEqual({ type: "redirect", to: "/faq?a=1", remember: "ar" });
    expect(get("/ar")).toEqual({ type: "redirect", to: "/", remember: "ar" });
  });

  it("turns ?lang= into the twin's address, keeping the rest of the query", () => {
    expect(get("/privacy", "?lang=en")).toEqual({ type: "redirect", to: "/en/privacy", remember: "en" });
    expect(get("/en/privacy", "?lang=ar&x=1", "en")).toEqual({ type: "redirect", to: "/privacy?x=1", remember: "ar" });
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
