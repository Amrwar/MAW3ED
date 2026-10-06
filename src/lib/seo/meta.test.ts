import { describe, expect, it } from "vitest";

import { buildMetadata, canonicalFor, parsePage } from "./meta";

describe("canonical URLs", () => {
  it("is absolute, because a relative canonical is ignored", () => {
    expect(canonicalFor("/cairo/clinics")).toMatch(/^https?:\/\//);
  });

  it("treats page one as the page itself", () => {
    // /cairo/clinics and /cairo/clinics?page=1 are the same page. If
    // page one carried the parameter, the site would offer two
    // addresses for one thing and they would compete.
    expect(canonicalFor("/cairo/clinics", 1)).toBe(canonicalFor("/cairo/clinics"));
    expect(canonicalFor("/cairo/clinics", 1)).not.toContain("page=");
  });

  it("gives a later page its own canonical rather than pointing back at page one", () => {
    // Page two is not a duplicate of page one — it holds different
    // businesses. Canonicalising it to page one would tell Google those
    // businesses do not exist.
    const two = canonicalFor("/cairo/clinics", 2);
    expect(two).toContain("page=2");
    expect(two).not.toBe(canonicalFor("/cairo/clinics"));
  });

  it("drops any query string it was handed", () => {
    // The canonical identifies the page, not how somebody arrived at it.
    expect(canonicalFor("/businesses?sort=rating&city=cairo")).toBe(
      canonicalFor("/businesses"),
    );
  });

  it("carries nothing but the page number on a later page", () => {
    expect(canonicalFor("/businesses?sort=rating", 3)).toContain("?page=3");
    expect(canonicalFor("/businesses?sort=rating", 3)).not.toContain("sort=");
  });
});

describe("what gets indexed", () => {
  const base = { title: "عيادات في القاهرة", description: "وصف", path: "/cairo/clinics" };

  it("indexes the first page", () => {
    const m = buildMetadata(base);
    expect(m.robots).toEqual({ index: true, follow: true });
  });

  it("does not index later pages, but still follows them", () => {
    // Page four of a list is not a landing page: its worth is the links
    // on it. Indexing it makes a near-duplicate compete with page one;
    // not following it would strand the businesses only listed there.
    const m = buildMetadata({ ...base, page: 4 });
    expect(m.robots).toEqual({ index: false, follow: true });
  });

  it("says which page it is in the title, so two pages are not identical", () => {
    expect(String(buildMetadata({ ...base, page: 2 }).title)).toContain("2");
    expect(String(buildMetadata(base).title)).not.toContain("صفحة");
  });

  it("points OpenGraph at the same URL as the canonical", () => {
    // Two different URLs for one page, in one document, is the
    // duplicate-content problem written down twice.
    const m = buildMetadata({ ...base, page: 2 });
    expect(m.openGraph?.url).toBe(m.alternates?.canonical);
  });

  it("emits no hreflang, because there is no second URL to point at", () => {
    // Arabic and English share one address, chosen by a cookie. An
    // hreflang pointing back at itself claims two languages live at one
    // URL, which is worse than saying nothing.
    const m = buildMetadata(base);
    expect(m.alternates?.languages).toBeUndefined();
  });
});

describe("parsePage", () => {
  it("defaults to one for anything that is not a later page", () => {
    // "1e3" and " 2 " are the interesting ones: Number() reads them as
    // 1000 and 2, which would make several URLs ask for one page.
    for (const raw of [undefined, "", "1", "0", "-3", "abc", "2.5", "1e3", " 2 ", "0x10", "999999"]) {
      expect(parsePage(raw), String(raw)).toBe(1);
    }
  });

  it("refuses a page past the ceiling", () => {
    expect(parsePage("501")).toBe(1);
    expect(parsePage("500")).toBe(500);
  });

  it("accepts a real page number", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage("47")).toBe(47);
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parsePage(["3", "9"])).toBe(3);
  });
});
