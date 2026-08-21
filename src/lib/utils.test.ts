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
  it("defaults to Egyptian pounds", () => {
    expect(formatPrice(100)).toContain("EGP");
  });

  it("takes another currency", () => {
    expect(formatPrice(100, "USD")).toContain("USD");
  });

  it("puts the figure before the currency", () => {
    const formatted = formatPrice(100);
    expect(formatted.indexOf("EGP")).toBeGreaterThan(0);
  });

  it("renders zero rather than an empty string", () => {
    expect(formatPrice(0).trim().length).toBeGreaterThan(3);
  });

  it("groups a large figure", () => {
    // Arabic-Indic digits with separators; the point is that it is not the
    // bare Latin digit run.
    expect(formatPrice(1000000)).not.toBe("1000000 EGP");
  });
});

describe("formatDuration", () => {
  it("gives minutes under an hour", () => {
    expect(formatDuration(30)).toBe("30 دقيقة");
  });

  it("gives whole hours without a minutes part", () => {
    expect(formatDuration(120)).toBe("2 ساعة");
  });

  it("gives hours and minutes together", () => {
    expect(formatDuration(90)).toBe("1 ساعة و 30 دقيقة");
  });

  it("treats fifty-nine minutes as minutes", () => {
    expect(formatDuration(59)).toBe("59 دقيقة");
  });

  it("treats sixty as one hour", () => {
    expect(formatDuration(60)).toBe("1 ساعة");
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
