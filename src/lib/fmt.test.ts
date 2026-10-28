import { describe, it, expect } from "vitest";
import {
  localeFor,
  num,
  percent,
  money,
  currencyLabel,
  duration,
  clock,
  clock12,
  dayPart,
  time,
  timeRange,
  dateLong,
  weekday,
  rating,
  plural,
  countLabel,
  arCount,
  enCount,
  countIn,
  daysUntil,
} from "./fmt";

describe("localeFor", () => {
  // The whole reason this module exists: plain "ar-EG" renders
  // Arabic-Indic digits, which Egyptian users do not read in an app.
  it("pins Arabic to the Latin numbering system", () => {
    expect(localeFor("ar")).toBe("ar-EG-u-nu-latn");
  });

  it("uses US English for English", () => {
    expect(localeFor("en")).toBe("en-US");
  });
});

describe("num", () => {
  it("renders Western digits in Arabic", () => {
    expect(num(300, "ar")).toBe("300");
  });

  it("never emits an Arabic-Indic digit", () => {
    expect(num(1234567, "ar")).not.toMatch(/[٠-٩]/);
  });

  it("groups thousands", () => {
    expect(num(1234567, "ar")).toBe("1,234,567");
    expect(num(1234567, "en")).toBe("1,234,567");
  });

  it("renders zero", () => {
    expect(num(0, "ar")).toBe("0");
  });

  it("keeps a negative sign", () => {
    expect(num(-5, "ar")).toContain("5");
  });
});

describe("percent", () => {
  it("rounds and appends a percent sign", () => {
    expect(percent(72.4, "ar")).toBe("72%");
    expect(percent(72.6, "en")).toBe("73%");
  });
});

describe("currencyLabel", () => {
  it("gives the Arabic label in Arabic", () => {
    expect(currencyLabel("EGP", "ar")).toBe("ج.م");
  });

  it("gives the ISO code in English", () => {
    expect(currencyLabel("EGP", "en")).toBe("EGP");
  });

  it("falls back to the raw code when it has no label", () => {
    expect(currencyLabel("GBP", "ar")).toBe("GBP");
  });
});

describe("money", () => {
  it("puts the figure before the label", () => {
    expect(money(300, "ar")).toBe("300 ج.م");
    expect(money(300, "en")).toBe("300 EGP");
  });

  it("groups a large amount", () => {
    expect(money(1200000, "ar")).toBe("1,200,000 ج.م");
  });

  it("defaults to Egyptian pounds", () => {
    expect(money(50, "ar")).toContain("ج.م");
  });

  it("writes piastres to two places", () => {
    // A 25% deposit on 150 is 37.50; "37.5" read like a typo in every
    // payment message.
    expect(money(37.5, "ar")).toBe("37.50 ج.م");
    expect(money(37.5, "en")).toBe("37.50 EGP");
    expect(money(462.53, "en")).toBe("462.53 EGP");
    expect(money(1234.5, "en")).toBe("1,234.50 EGP");
    expect(money(0.1 + 0.2, "en")).toBe("0.30 EGP");
  });
});

describe("duration", () => {
  it("renders minutes under an hour", () => {
    expect(duration(45, "ar")).toBe("45 دقيقة");
    expect(duration(45, "en")).toBe("45 min");
  });

  it("uses the Arabic singular for one hour", () => {
    expect(duration(60, "ar")).toBe("ساعة");
  });

  it("uses the Arabic dual for two hours", () => {
    expect(duration(120, "ar")).toBe("ساعتين");
  });

  it("numbers three hours and above", () => {
    expect(duration(180, "ar")).toBe("3 ساعات");
  });

  it("binds the conjunction to the minutes", () => {
    expect(duration(90, "ar")).toBe("ساعة و30 دقيقة");
  });

  it("reads naturally in English", () => {
    expect(duration(60, "en")).toBe("1 hr");
    expect(duration(90, "en")).toBe("1 hr 30 min");
  });
});

describe("clock12", () => {
  it("reads the clock the way people say it", () => {
    expect(clock12("16:00")).toBe("4:00 م");
    expect(clock12("09:30", "en")).toBe("9:30 AM");
    expect(clock12("00:15", "en")).toBe("12:15 AM");
    expect(clock12("12:00")).toBe("12:00 م");
  });
});

describe("dayPart", () => {
  it("splits the day at noon and five", () => {
    expect(dayPart("11:59")).toBe("morning");
    expect(dayPart("12:00")).toBe("afternoon");
    expect(dayPart("16:59")).toBe("afternoon");
    expect(dayPart("17:00")).toBe("evening");
  });
});

describe("clock", () => {
  it("pads a single-digit hour", () => {
    expect(clock("9:05")).toBe("09:05");
  });

  it("leaves a padded time alone", () => {
    expect(clock("14:30")).toBe("14:30");
  });

  it("pads a missing minutes part", () => {
    expect(clock("9")).toBe("09:00");
  });
});

describe("time", () => {
  it("renders a 24-hour clock", () => {
    expect(time(new Date(2026, 9, 9, 9, 5))).toBe("09:05");
    expect(time(new Date(2026, 9, 9, 18, 30))).toBe("18:30");
  });

  it("renders a range", () => {
    const start = new Date(2026, 9, 9, 11, 30);
    const end = new Date(2026, 9, 9, 12, 15);
    expect(timeRange(start, end)).toBe("11:30 — 12:15");
  });
});

describe("dates", () => {
  it("keeps Arabic month names while using Western digits", () => {
    const out = dateLong("2026-10-09T00:00:00", "ar");
    expect(out).toMatch(/[؀-ۿ]/);
    expect(out).toMatch(/\d/);
    expect(out).not.toMatch(/[٠-٩]/);
  });

  it("gives an Arabic weekday", () => {
    expect(weekday("2026-10-09T00:00:00", "ar")).toMatch(/[؀-ۿ]/);
  });
});

describe("rating", () => {
  it("always shows one decimal", () => {
    expect(rating(4.84)).toBe("4.8");
    expect(rating(4.86)).toBe("4.9");
    expect(rating(5)).toBe("5.0");
    expect(rating(0)).toBe("0.0");
  });

  it("follows toFixed at the half-way point", () => {
    // 4.85 is not exactly representable in binary floating point — it
    // sits a hair below — so toFixed rounds it down. Pinned here so the
    // behaviour is a documented choice rather than a surprise.
    expect(rating(4.85)).toBe("4.8");
  });
});

describe("plural", () => {
  const forms = {
    zero: "لا حجوزات",
    one: "حجز واحد",
    two: "حجزان",
    few: "حجوزات",
    many: "حجزًا",
  };

  it("picks the Arabic form by count", () => {
    expect(plural(0, forms)).toBe("لا حجوزات");
    expect(plural(1, forms)).toBe("حجز واحد");
    expect(plural(2, forms)).toBe("حجزان");
    expect(plural(5, forms)).toBe("حجوزات");
    expect(plural(11, forms)).toBe("حجزًا");
  });

  it("treats 103 as the few form, following the hundreds rule", () => {
    expect(plural(103, forms)).toBe("حجوزات");
  });
});

describe("countLabel", () => {
  const ar = { one: "حجز واحد", two: "حجزان", few: "حجوزات", many: "حجزًا" };
  const en = { one: "booking", other: "bookings" };

  it("omits the numeral where the Arabic word carries it", () => {
    expect(countLabel(1, "ar", ar, en)).toBe("حجز واحد");
    expect(countLabel(2, "ar", ar, en)).toBe("حجزان");
  });

  it("prefixes the count from three upward", () => {
    expect(countLabel(5, "ar", ar, en)).toBe("5 حجوزات");
  });

  it("pluralises English the English way", () => {
    expect(countLabel(1, "en", ar, en)).toBe("1 booking");
    expect(countLabel(3, "en", ar, en)).toBe("3 bookings");
  });
});

describe("daysUntil", () => {
  const now = Date.UTC(2026, 9, 9);

  it("counts forward", () => {
    expect(daysUntil(new Date(Date.UTC(2026, 9, 12)), now)).toBe(3);
  });

  it("returns zero for the same instant", () => {
    expect(daysUntil(new Date(now), now)).toBe(0);
  });

  it("goes negative for a past date", () => {
    expect(daysUntil(new Date(Date.UTC(2026, 9, 7)), now)).toBe(-2);
  });
});

describe("arCount", () => {
  const place = { one: "مكان واحد", two: "مكانين", few: "أماكن", many: "مكان" };

  it("follows the Arabic counted-noun rules", () => {
    expect(arCount(1, place)).toBe("مكان واحد");
    expect(arCount(2, place)).toBe("مكانين");
    expect(arCount(3, place)).toBe("3 أماكن");
    expect(arCount(10, place)).toBe("10 أماكن");
    expect(arCount(11, place)).toBe("11 مكان");
    expect(arCount(100, place)).toBe("100 مكان");
    expect(arCount(105, place)).toBe("105 أماكن");
  });
});

describe("enCount / countIn", () => {
  it("pluralises English", () => {
    expect(enCount(1, "place")).toBe("1 place");
    expect(enCount(4, "place")).toBe("4 places");
    expect(enCount(2, "business", "businesses")).toBe("2 businesses");
  });

  it("picks the language", () => {
    const ar = { one: "يوم واحد", two: "يومين", few: "أيام", many: "يوم" };
    expect(countIn("ar", 7, ar, { one: "day" })).toBe("7 أيام");
    expect(countIn("en", 7, ar, { one: "day" })).toBe("7 days");
  });
});
