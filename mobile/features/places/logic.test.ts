import { describe, expect, it } from "vitest";
import { businessRoute, categoriesOf, filterEntries, orgParam, sectionsOf } from "./logic";
import type { OrgDirectoryEntry, VenueDirectoryEntry } from "@/types/places";

const org = (n: string, cat: string | null, section: string | null): OrgDirectoryEntry => ({
  associationId: n, slug: n, nameAr: `اسم ${n}`, nameEn: `Name ${n}`, logoImage: null, ratingAvg: 0, ratingCount: 0, isVerified: false,
  relation: "HOSTED", section, sortOrder: 0, city: null, branch: null,
  category: cat ? { slug: cat, nameAr: cat === "restaurants" ? "مطاعم" : "صالونات", nameEn: cat } : null,
});
const venue = (n: string, zone: string | null): VenueDirectoryEntry => ({
  membershipId: n, slug: n, nameAr: n, nameEn: null, logoImage: null, ratingAvg: 0, ratingCount: 0, isVerified: false,
  category: null, unit: null, branch: null, zone: zone ? { id: zone, nameAr: zone, nameEn: null, level: 0 } : null,
});

describe("an organization's directory", () => {
  const list = [org("grill", "restaurants", "المطاعم"), org("cafe", "restaurants", "المطاعم"), org("barber", "salons", "التجميل"), org("x", null, null)];
  it("filters by category, section and search, together", () => {
    expect(filterEntries(list, { category: "restaurants" }).map((e) => e.slug)).toEqual(["grill", "cafe"]);
    expect(filterEntries(list, { section: "التجميل" }).map((e) => e.slug)).toEqual(["barber"]);
    expect(filterEntries(list, { q: "name gr" }).map((e) => e.slug)).toEqual(["grill"]);
    expect(filterEntries(list, { q: "مطاعم", section: "المطاعم" }).map((e) => e.slug)).toEqual(["grill", "cafe"]);
    expect(filterEntries(list, {})).toHaveLength(4);
  });
  it("offers the categories present, most common first, and the organization's own sections", () => {
    expect(categoriesOf(list).map((c) => [c.slug, c.count])).toEqual([["restaurants", 2], ["salons", 1]]);
    expect(sectionsOf(list)).toEqual(["المطاعم", "التجميل"]);
  });
  it("filters a venue's directory by floor or zone", () => {
    expect(filterEntries([venue("a", "z1"), venue("b", "z2"), venue("c", null)], { zone: "z2" }).map((e) => e.slug)).toEqual(["b"]);
  });
});

describe("booking from a directory is credited to the organization", () => {
  it("carries the organization's slug to the business page", () => {
    expect(businessRoute("grill", "palm-group")).toEqual({ pathname: "/business/[slug]", params: { slug: "grill", org: "palm-group" } });
  });
  it("never carries anything that is not a slug", () => {
    expect(businessRoute("grill", "../admin")).toEqual({ pathname: "/business/[slug]", params: { slug: "grill" } });
    expect(businessRoute("grill", null).params).toEqual({ slug: "grill" });
    expect(orgParam("palm-group")).toBe("palm-group");
    expect(orgParam(["mall", "x"])).toBe("mall");
    expect(orgParam("Bad Slug")).toBeUndefined();
    expect(orgParam(undefined)).toBeUndefined();
    // Only what the server would accept as an organization's slug (3–60, single hyphens).
    expect(orgParam("ab")).toBeUndefined();
    expect(orgParam("a".repeat(61))).toBeUndefined();
    expect(orgParam("palm--group")).toBeUndefined();
    expect(orgParam("palm_group")).toBeUndefined();
    expect(businessRoute("grill", "a".repeat(61))).toEqual({ pathname: "/business/[slug]", params: { slug: "grill" } });
  });
});
