import { describe, expect, it } from "vitest";

import {
  cn,
  formatDuration,
  formatPrice,
  formatRating,
  getInitials,
  slugify,
} from "./utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops a falsy class", () => {
    expect(cn("a", false && "b", undefined)).toBe("a");
  });

  it("lets a later tailwind class win over an earlier one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("is empty when given nothing", () => {
    expect(cn()).toBe("");
  });
});

describe("formatPrice", () => {
  // formatPrice is a deprecated wrapper pinned to Arabic. Arabic output
  // carries the Arabic currency label; the ISO code is what the English
  // path returns. See money() in lib/fmt.ts.
  it("labels Egyptian pounds in Arabic", () => {
    expect(formatPrice(100)).toBe("100 ج.م");
  });

  it("takes another currency", () => {
    expect(formatPrice(100, "USD")).toBe("100 دولار");
  });

  it("falls back to the raw code for a currency it has no label for", () => {
    expect(formatPrice(100, "GBP")).toBe("100 GBP");
  });

  it("puts the figure before the currency", () => {
    expect(formatPrice(100).indexOf("100")).toBe(0);
  });

  it("renders zero rather than an empty string", () => {
    expect(formatPrice(0).trim().length).toBeGreaterThan(3);
  });

  it("groups a large figure with separators", () => {
    expect(formatPrice(1000000)).toBe("1,000,000 ج.م");
  });

  it("uses Western digits, not Arabic-Indic ones", () => {
    // The point of lib/fmt: ar-EG alone renders ٣٠٠, which Egyptian
    // users do not read in an app.
    expect(formatPrice(300)).toContain("300");
    expect(formatPrice(300)).not.toMatch(/[٠-٩]/);
  });
});

describe("formatDuration", () => {
  it("gives minutes under an hour", () => {
    expect(formatDuration(30)).toBe("30 دقيقة");
  });

  it("treats fifty-nine minutes as minutes", () => {
    expect(formatDuration(59)).toBe("59 دقيقة");
  });

  // Arabic does not count to one or two the way English does: a single
  // hour is "ساعة" with no numeral, and two is the dual "ساعتين". Writing
  // "1 ساعة" or "2 ساعة", as this helper used to, is not Arabic.
  it("writes a single hour without a numeral", () => {
    expect(formatDuration(60)).toBe("ساعة");
  });

  it("uses the dual form for two hours", () => {
    expect(formatDuration(120)).toBe("ساعتين");
  });

  it("numbers three hours and above", () => {
    expect(formatDuration(180)).toBe("3 ساعات");
  });

  // The conjunction و binds to the word after it, with no space.
  it("joins hours and minutes with a bound conjunction", () => {
    expect(formatDuration(90)).toBe("ساعة و30 دقيقة");
  });

  it("is written in Arabic", () => {
    expect(formatDuration(45)).toMatch(/[؀-ۿ]/);
  });
});

describe("formatRating", () => {
  it("shows one decimal place", () => {
    expect(formatRating(4.5)).toBe("4.5");
  });

  it("pads a whole number to one place", () => {
    expect(formatRating(5)).toBe("5.0");
  });

  it("rounds to one place", () => {
    expect(formatRating(4.26)).toBe("4.3");
  });

  it("shows a zero rating rather than nothing", () => {
    expect(formatRating(0)).toBe("0.0");
  });
});

describe("getInitials", () => {
  it("takes the first letter of two names", () => {
    expect(getInitials("Amr Hefny")).toBe("AH");
  });

  it("stops at two however long the name", () => {
    expect(getInitials("Amr Mohamed Ali Hefny")).toBe("AM");
  });

  it("takes one letter from a single name", () => {
    expect(getInitials("Amr")).toBe("A");
  });

  it("works on Arabic names", () => {
    expect(getInitials("عمرو حفني")).toBe("عح");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hair Salon")).toBe("hair-salon");
  });

  it("drops punctuation", () => {
    expect(slugify("Nour's Salon!")).toBe("nours-salon");
  });

  it("collapses a run of spaces into one dash", () => {
    expect(slugify("a   b")).toBe("a-b");
  });

  it("keeps digits", () => {
    expect(slugify("Salon 24")).toBe("salon-24");
  });

  it("is stable when run twice", () => {
    const once = slugify("Hair Salon");
    expect(slugify(once)).toBe(once);
  });
});
