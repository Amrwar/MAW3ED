import { describe, it, expect } from "vitest";
import { dialable, formatPhone, normalisePhone } from "./phone";
// Shared with phone-sql.test.ts, which runs the same cases through Postgres.
import { PHONE_CASES } from "./phone-cases";

describe("normalisePhone", () => {
  it.each(PHONE_CASES)("%s → %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it("treats null and undefined as no number", () => {
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone(undefined)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups Egyptian numbers as people write them", () => {
    expect(formatPhone("201012345678")).toBe("+20 10 1234 5678");
  });

  it("shows other countries with a plus and no invented grouping", () => {
    expect(formatPhone("966501234567")).toBe("+966501234567");
  });
});

describe("dialable — numbers to message or link to", () => {
  it("takes everything normalisePhone takes", () => {
    expect(dialable("01012345678")).toBe("201012345678");
    expect(dialable("+1 415 555 2671")).toBe("14155552671");
  });

  it("reaches an Egyptian landline, which sign-in would refuse", () => {
    expect(normalisePhone("0223456789")).toBeNull();
    expect(dialable("0223456789")).toBe("20223456789");
  });

  it("never prepends 20 to a number that has its own country code", () => {
    // The old WhatsApp sender produced 201415… here.
    expect(dialable("+14155552671")).toBe("14155552671");
    expect(dialable("+44 20 7946 0958")).toBe("442079460958");
  });

  it("reads a local number in the given home country", () => {
    expect(dialable("0501234567", "966")).toBe("966501234567");
  });

  it("returns null for what cannot be dialled", () => {
    expect(dialable("abc")).toBeNull();
    expect(dialable("123")).toBeNull();
  });
});
