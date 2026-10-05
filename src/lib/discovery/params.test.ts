import { describe, expect, it } from "vitest";

import {
  EMPTY_QUERY,
  buildDiscoveryParams,
  discoveryHref,
  hasActiveFilters,
  pageWindow,
  parseDiscoveryQuery,
} from "./params";

describe("parsing the URL", () => {
  it("returns the defaults for an empty query string", () => {
    expect(parseDiscoveryQuery({})).toEqual(EMPTY_QUERY);
  });

  it("reads the whole contract", () => {
    const q = parseDiscoveryQuery({
      q: "  أسنان  ",
      category: "medical",
      subcategory: "dentists",
      city: "new-cairo",
      neighborhood: "tagamoa",
      minPrice: "100",
      maxPrice: "500",
      rating: "4.5",
      available: "open-now",
      verified: "1",
      instant: "1",
      online: "1",
      sort: "rating",
      page: "3",
    });

    expect(q).toEqual({
      q: "أسنان",
      category: "medical",
      subcategory: "dentists",
      city: "new-cairo",
      neighborhood: "tagamoa",
      minPrice: 100,
      maxPrice: 500,
      rating: 4.5,
      availability: "open-now",
      verified: true,
      instant: true,
      online: true,
      sort: "rating",
      page: 3,
    });
  });

  it("falls back rather than throwing on a hand-edited URL", () => {
    const q = parseDiscoveryQuery({
      sort: "by-vibes",
      available: "next-century",
      rating: "9",
      page: "-4",
      verified: "yes",
    });
    expect(q.sort).toBe("recommended");
    expect(q.availability).toBe("any");
    expect(q.rating).toBeNull();
    expect(q.page).toBe(1);
    // Only "1" is true — "yes" is not the contract.
    expect(q.verified).toBe(false);
  });

  it("rejects a slug that is not a slug, so nothing odd reaches the query", () => {
    expect(parseDiscoveryQuery({ city: "new cairo; drop table" }).city).toBe("");
    expect(parseDiscoveryQuery({ category: "../../etc" }).category).toBe("");
    expect(parseDiscoveryQuery({ city: "New-Cairo" }).city).toBe("new-cairo");
  });

  it("swaps a price range dragged past itself", () => {
    const q = parseDiscoveryQuery({ minPrice: "800", maxPrice: "200" });
    expect(q.minPrice).toBe(200);
    expect(q.maxPrice).toBe(800);
  });

  it("drops a negative or absurd price", () => {
    expect(parseDiscoveryQuery({ minPrice: "-50" }).minPrice).toBeNull();
    expect(parseDiscoveryQuery({ maxPrice: "99999999" }).maxPrice).toBeNull();
  });

  it("caps the page so an offset cannot be asked for that the database will not serve", () => {
    expect(parseDiscoveryQuery({ page: "999999" }).page).toBe(500);
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parseDiscoveryQuery({ city: ["cairo", "giza"] }).city).toBe("cairo");
  });

  it("truncates a very long search term", () => {
    expect(parseDiscoveryQuery({ q: "ا".repeat(500) }).q).toHaveLength(100);
  });
});

describe("building the URL", () => {
  it("leaves defaults out, so a plain listing has a clean address", () => {
    expect(discoveryHref(EMPTY_QUERY)).toBe("/businesses");
    expect(buildDiscoveryParams(EMPTY_QUERY).size).toBe(0);
  });

  it("round-trips everything that is set", () => {
    const original = parseDiscoveryQuery({
      q: "spa",
      category: "beauty",
      city: "cairo",
      rating: "4",
      available: "today",
      verified: "1",
      sort: "price-asc",
      page: "2",
    });
    expect(parseDiscoveryQuery(Object.fromEntries(buildDiscoveryParams(original)))).toEqual(
      original,
    );
  });

  it("writes the shape the brief asks for", () => {
    expect(
      discoveryHref({ category: "dentists", city: "new-cairo", rating: 4.5, page: 2 }),
    ).toBe("/businesses?category=dentists&city=new-cairo&rating=4.5&page=2");
  });

  it("omits page 1, so the first page has one canonical address", () => {
    expect(discoveryHref({ city: "cairo", page: 1 })).toBe("/businesses?city=cairo");
  });
});

describe("hasActiveFilters", () => {
  it("is false for an untouched listing", () => {
    expect(hasActiveFilters(EMPTY_QUERY)).toBe(false);
  });

  it("ignores sort and page, which narrow nothing", () => {
    expect(hasActiveFilters({ ...EMPTY_QUERY, sort: "rating", page: 4 })).toBe(false);
  });

  it("notices a price floor of zero", () => {
    expect(hasActiveFilters({ ...EMPTY_QUERY, minPrice: 0 })).toBe(true);
  });
});

describe("pageWindow", () => {
  it("renders every page while they fit", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, "gap", 5]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps both ends reachable", () => {
    const w = pageWindow(50, 100);
    expect(w[0]).toBe(1);
    expect(w[w.length - 1]).toBe(100);
    expect(w).toContain(50);
  });

  it("collapses the gaps rather than listing a hundred numbers", () => {
    expect(pageWindow(50, 100)).toEqual([1, "gap", 49, 50, 51, "gap", 100]);
  });

  it("never places two gaps next to each other", () => {
    for (let total = 1; total <= 30; total++) {
      for (let page = 1; page <= total; page++) {
        const w = pageWindow(page, total);
        for (let i = 1; i < w.length; i++) {
          expect(w[i] === "gap" && w[i - 1] === "gap").toBe(false);
        }
      }
    }
  });

  it("handles one page and none", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 0)).toEqual([]);
  });
});
