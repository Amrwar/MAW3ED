/**
 * The request schemas.
 *
 * These sit in front of every write the app makes, so the boundaries are
 * worth pinning: a minimum that quietly moves lets data through that the
 * rest of the code does not expect.
 */

import { describe, expect, it } from "vitest";

import { loginSchema, onboardingSchema, signUpSchema } from "./validations";

const validSignUp = {
  name: "Amr Hefny",
  email: "amr@example.com",
  password: "hunter2hunter2",
};

describe("signUpSchema", () => {
  it("accepts a complete sign-up", () => {
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true);
  });

  it("refuses a one-letter name", () => {
    expect(
      signUpSchema.safeParse({ ...validSignUp, name: "A" }).success,
    ).toBe(false);
  });

  it("accepts a two-letter name, the stated minimum", () => {
    expect(
      signUpSchema.safeParse({ ...validSignUp, name: "Ay" }).success,
    ).toBe(true);
  });

  it("refuses an address with no at sign", () => {
    expect(
      signUpSchema.safeParse({ ...validSignUp, email: "amr.example.com" })
        .success,
    ).toBe(false);
  });

  it("refuses a password of seven characters", () => {
    expect(
      signUpSchema.safeParse({ ...validSignUp, password: "1234567" }).success,
    ).toBe(false);
  });

  it("accepts a password of exactly eight", () => {
    expect(
      signUpSchema.safeParse({ ...validSignUp, password: "12345678" }).success,
    ).toBe(true);
  });

  it("refuses a missing field rather than defaulting it", () => {
    const { password, ...withoutPassword } = validSignUp;
    void password;
    expect(signUpSchema.safeParse(withoutPassword).success).toBe(false);
  });

  it("complains in Arabic, as the forms display", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/[؀-ۿ]/);
    }
  });

  it("names the field that failed", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, email: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["email"]);
    }
  });

  it("reports every bad field, not just the first", () => {
    const result = signUpSchema.safeParse({ name: "A", email: "no", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(1);
    }
  });
});

describe("loginSchema", () => {
  it("accepts an address and any non-empty password", () => {
    expect(
      loginSchema.safeParse({ email: "amr@example.com", password: "x" }).success,
    ).toBe(true);
  });

  it("refuses an empty password", () => {
    expect(
      loginSchema.safeParse({ email: "amr@example.com", password: "" }).success,
    ).toBe(false);
  });

  it("refuses a malformed address", () => {
    expect(
      loginSchema.safeParse({ email: "amr", password: "x" }).success,
    ).toBe(false);
  });

  it("does not hold logins to the sign-up password length", () => {
    // Existing accounts may predate the eight-character rule.
    expect(
      loginSchema.safeParse({ email: "amr@example.com", password: "short" })
        .success,
    ).toBe(true);
  });
});

describe("onboardingSchema", () => {
  const day = (dayOfWeek: number) => ({
    dayOfWeek,
    openTime: "09:00",
    closeTime: "17:00",
    isClosed: false,
  });

  const validOnboarding = {
    nameAr: "صالون",
    categoryId: "cat_1",
    cityId: "city_1",
    phone: "01000000000",
    slug: "salon-cairo",
    services: [{ nameAr: "قص شعر", duration: 30, price: 100 }],
    availability: [0, 1, 2, 3, 4, 5, 6].map(day),
  };

  it("accepts a complete onboarding", () => {
    expect(onboardingSchema.safeParse(validOnboarding).success).toBe(true);
  });

  it("insists on a full week of availability", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        availability: [0, 1, 2, 3, 4, 5].map(day),
      }).success,
    ).toBe(false);
  });

  it("refuses an eighth day", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        availability: [0, 1, 2, 3, 4, 5, 6, 0].map(day),
      }).success,
    ).toBe(false);
  });

  it("insists on at least one service", () => {
    expect(
      onboardingSchema.safeParse({ ...validOnboarding, services: [] }).success,
    ).toBe(false);
  });

  it("refuses a service shorter than five minutes", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        services: [{ nameAr: "قص شعر", duration: 4, price: 100 }],
      }).success,
    ).toBe(false);
  });

  it("refuses a service longer than eight hours", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        services: [{ nameAr: "قص شعر", duration: 481, price: 100 }],
      }).success,
    ).toBe(false);
  });

  it("accepts a free service", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        services: [{ nameAr: "استشارة", duration: 30, price: 0 }],
      }).success,
    ).toBe(true);
  });

  it("refuses a negative price", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        services: [{ nameAr: "قص شعر", duration: 30, price: -1 }],
      }).success,
    ).toBe(false);
  });

  it("refuses a day of week outside the week", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        availability: [0, 1, 2, 3, 4, 5, 7].map(day),
      }).success,
    ).toBe(false);
  });

  it("refuses a time that is not HH:MM", () => {
    const availability = [0, 1, 2, 3, 4, 5, 6].map(day);
    availability[0] = { ...availability[0], openTime: "9am" };
    expect(
      onboardingSchema.safeParse({ ...validOnboarding, availability }).success,
    ).toBe(false);
  });

  it("insists on a city and a category", () => {
    expect(
      onboardingSchema.safeParse({ ...validOnboarding, cityId: "" }).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({ ...validOnboarding, categoryId: "" }).success,
    ).toBe(false);
  });

  it("refuses a phone number too short to dial", () => {
    expect(
      onboardingSchema.safeParse({ ...validOnboarding, phone: "0100" }).success,
    ).toBe(false);
  });

  it("caps the tagline", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        taglineAr: "ا".repeat(121),
      }).success,
    ).toBe(false);
  });

  it("accepts a tagline at the cap", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        taglineAr: "ا".repeat(120),
      }).success,
    ).toBe(true);
  });

  it("caps the about text", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        about: "ا".repeat(601),
      }).success,
    ).toBe(false);
  });

  it("refuses a cover image that is not a url", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        coverImage: "not-a-url",
      }).success,
    ).toBe(false);
  });

  it("accepts an https cover image", () => {
    expect(
      onboardingSchema.safeParse({
        ...validOnboarding,
        coverImage: "https://example.com/a.png",
      }).success,
    ).toBe(true);
  });

  it("leaves the optional fields optional", () => {
    expect(onboardingSchema.safeParse(validOnboarding).success).toBe(true);
  });

  describe("the public slug", () => {
    const withSlug = (slug: string) =>
      onboardingSchema.safeParse({ ...validOnboarding, slug }).success;

    it("accepts lower-case letters, digits and dashes", () => {
      expect(withSlug("salon-cairo-2")).toBe(true);
    });

    it("refuses upper case, since the url is matched exactly", () => {
      expect(withSlug("Salon-Cairo")).toBe(false);
    });

    it("refuses spaces", () => {
      expect(withSlug("salon cairo")).toBe(false);
    });

    it("refuses Arabic script, which would need escaping in a url", () => {
      expect(withSlug("صالون")).toBe(false);
    });

    it("refuses underscores", () => {
      expect(withSlug("salon_cairo")).toBe(false);
    });

    it("refuses a leading dash", () => {
      expect(withSlug("-salon")).toBe(false);
    });

    it("refuses a trailing dash", () => {
      expect(withSlug("salon-")).toBe(false);
    });

    it("allows a dash in the middle", () => {
      expect(withSlug("a-b")).toBe(true);
    });

    it("refuses two characters", () => {
      expect(withSlug("ab")).toBe(false);
    });

    it("accepts three, the stated minimum", () => {
      expect(withSlug("abc")).toBe(true);
    });

    it("accepts fifty, the stated maximum", () => {
      expect(withSlug("a".repeat(50))).toBe(true);
    });

    it("refuses fifty-one", () => {
      expect(withSlug("a".repeat(51))).toBe(false);
    });

    it("is required", () => {
      const { slug, ...withoutSlug } = validOnboarding;
      void slug;
      expect(onboardingSchema.safeParse(withoutSlug).success).toBe(false);
    });
  });
});
