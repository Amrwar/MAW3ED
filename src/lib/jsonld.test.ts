import { describe, expect, it } from "vitest";

import { buildLocalBusinessJsonLd, type LocalBusinessInput } from "./jsonld";

const base: LocalBusinessInput = {
  slug: "salah",
  nameAr: "محمد صلاح للحلاقة",
  nameEn: "Salah barbershop",
  about: null,
  taglineAr: null,
  phone: null,
  coverImage: null,
  logoImage: null,
  address: null,
  city: { nameAr: "مدينة نصر" },
  category: { nameAr: "صالونات حلاقة" },
  availability: [],
  services: [{ price: 150, currency: "EGP" }, { price: 300, currency: "EGP" }],
};

describe("buildLocalBusinessJsonLd", () => {
  it("adds the map pin when there is one, and nothing when there is not", () => {
    expect(buildLocalBusinessJsonLd({ ...base, geo: { latitude: 30.05, longitude: 31.33 } }).geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 30.05,
      longitude: 31.33,
    });
    expect(buildLocalBusinessJsonLd(base)).not.toHaveProperty("geo");
  });

  it("states a price range from the services", () => {
    expect(buildLocalBusinessJsonLd(base).priceRange).toBe("150–300 EGP");
  });

  it("does not publish an unfilled price as 0 EGP", () => {
    // Live on two listings: "priceRange": "0 EGP".
    expect(buildLocalBusinessJsonLd({ ...base, services: [{ price: 0, currency: "EGP" }] })).not.toHaveProperty(
      "priceRange",
    );
    expect(
      buildLocalBusinessJsonLd({ ...base, services: [{ price: 0, currency: "EGP" }, { price: 500, currency: "EGP" }] })
        .priceRange,
    ).toBe("500 EGP");
  });
});

describe("organization and venue JSON-LD (Phase 26)", () => {
  it("a mall is a ShoppingCenter with absolute sameAs links and no rating", async () => {
    const { buildOrganizationJsonLd } = await import("./jsonld");
    const ld = buildOrganizationJsonLd({
      slug: "m", kind: "MALL", nameAr: "مول", nameEn: "Mall",
      website: "www.example.com", instagram: "@mall", facebook: "https://facebook.com/mall",
    });
    expect(ld["@type"]).toBe("ShoppingCenter");
    expect(ld.sameAs).toEqual(["https://www.example.com/", "https://instagram.com/mall", "https://facebook.com/mall"]);
    expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|reviewCount/);
  });
  it("drops a website that is not one", async () => {
    const { buildOrganizationJsonLd } = await import("./jsonld");
    expect(buildOrganizationJsonLd({ slug: "g", kind: "BUSINESS_GROUP", nameAr: "ج", nameEn: null, website: "not a site" }).sameAs).toBeUndefined();
  });
});
