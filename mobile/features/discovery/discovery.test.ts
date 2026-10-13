import { describe, it, expect, vi } from "vitest";
import { DEFAULT_FILTERS, activeFilterCount, fromArrival, termProblem, toQuery } from "./searchState";
import { MAX_RECENT, pushRecent } from "./recentSearches";
import { mapPoints, regionFor } from "./map";

// Hoisted by vitest above the imports; written here to keep imports first.
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => undefined },
}));

describe("toQuery — the API's parameters", () => {
  it("sends nothing for the default search, so it shares one cache entry", () => {
    expect(toQuery("", DEFAULT_FILTERS)).toEqual({});
    expect(toQuery("  ", DEFAULT_FILTERS)).toEqual({});
  });

  it("uses the API's names — `available`, not `availability`", () => {
    const q = toQuery("", { ...DEFAULT_FILTERS, available: "today" });
    expect(q).toEqual({ available: "today" });
  });

  it("sends a subcategory instead of its parent, and a neighbourhood only with its city", () => {
    const f = { ...DEFAULT_FILTERS, category: "beauty", subcategory: "salons", neighborhood: "zamalek" };
    expect(toQuery("", f)).toEqual({ subcategory: "salons" });
    expect(toQuery("", { ...f, city: "cairo" })).toEqual({ subcategory: "salons", city: "cairo", neighborhood: "zamalek" });
  });

  it("sends every narrowing filter as the API spells it", () => {
    const q = toQuery(" barber ", {
      ...DEFAULT_FILTERS,
      rating: 4,
      minPrice: 100,
      maxPrice: 500,
      verified: true,
      instant: true,
      online: true,
      sort: "price-asc",
    });
    expect(q).toEqual({
      q: "barber",
      rating: "4",
      minPrice: "100",
      maxPrice: "500",
      verified: "1",
      instant: "1",
      online: "1",
      sort: "price-asc",
    });
  });

  it("does not send a one-letter search, and caps a long one", () => {
    expect(toQuery("a", DEFAULT_FILTERS)).toEqual({});
    expect(termProblem("a")).toBe("too-short");
    expect(termProblem("")).toBeNull();
    expect(toQuery("x".repeat(150), DEFAULT_FILTERS).q).toHaveLength(100);
  });
});

describe("filters", () => {
  it("counts what narrows the results, not the sort", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, sort: "rating" })).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, city: "cairo", minPrice: 10, maxPrice: 20, verified: true })).toBe(3);
  });

  it("a link from Home starts a new search and ignores values the API does not know", () => {
    expect(fromArrival({ category: "salons", sort: "rating" })).toEqual({
      term: "",
      filters: { ...DEFAULT_FILTERS, category: "salons", sort: "rating" },
    });
    expect(fromArrival({ sort: "cheapest", available: "someday" }).filters).toEqual(DEFAULT_FILTERS);
  });
});

describe("recent searches", () => {
  it("puts the newest first, once, ignoring case and spacing", () => {
    expect(pushRecent(["Salon", "gym"], "  salon ")).toEqual(["salon", "gym"]);
    expect(pushRecent(["gym"], "barber  shop")).toEqual(["barber shop", "gym"]);
  });

  it("ignores what is too short to have been a search, and keeps a short list", () => {
    const list = ["a1", "b2"];
    expect(pushRecent(list, "x")).toBe(list);
    const many = Array.from({ length: 20 }, (_, i) => `term ${i}`);
    expect(pushRecent(many, "new")).toHaveLength(MAX_RECENT);
  });
});

describe("map", () => {
  const pin = (lat: number, lng: number, branchId: string | null = null) => ({ lat, lng, branchId, branchNameAr: null, branchNameEn: null });
  const b = (pins: ReturnType<typeof pin>[]) => ({ id: "1", slug: "s", pins });

  it("places a business only where its owner pinned it, one point per pin", () => {
    expect(mapPoints([b([])])).toEqual([]);
    const points = mapPoints([b([pin(30.04, 31.23), pin(30.06, 31.22, "br1")])]);
    expect(points.map((p) => [p.key, p.lat, p.lng, p.branchId])).toEqual([
      ["1:main", 30.04, 31.23, null],
      ["1:br1", 30.06, 31.22, "br1"],
    ]);
  });

  it("keeps one marker where a branch sits exactly on the business's own pin", () => {
    const points = mapPoints([b([pin(29.96, 31.25), pin(29.96, 31.25, "maadi"), pin(30.06, 31.22, "zamalek")])]);
    expect(points.map((p) => p.branchId)).toEqual(["maadi", "zamalek"]);
  });

  it("drops impossible coordinates and the blank-form 0,0", () => {
    expect(mapPoints([b([pin(200, 31), pin(0, 0)])])).toEqual([]);
  });

  it("frames every point, and the person when given", () => {
    const r = regionFor([{ lat: 30, lng: 31 }, { lat: 30.1, lng: 31.2 }], { lat: 29.9, lng: 31 });
    expect(r?.latitude).toBeCloseTo(30);
    expect(r && r.latitudeDelta).toBeGreaterThan(0.2);
    expect(regionFor([])).toBeNull();
  });
});
