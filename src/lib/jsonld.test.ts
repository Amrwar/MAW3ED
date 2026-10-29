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
