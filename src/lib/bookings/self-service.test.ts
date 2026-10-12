import { describe, expect, it } from "vitest";

import { customerMayChange, minutesUntilStart } from "./self-service";

const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("minutesUntilStart", () => {
  it("measures on Cairo's wall clock under summer time (UTC+3)", () => {
    // 18:00 UTC on 12 Oct is 21:00 in Cairo; a 22:30 booking is 90 minutes away.
    expect(minutesUntilStart(day("2026-10-12"), "22:30", new Date("2026-10-12T18:00:00Z"))).toBe(90);
  });

  it("measures on Cairo's wall clock in winter (UTC+2)", () => {
    // 10:00 UTC on 15 Jan is 12:00 in Cairo.
    expect(minutesUntilStart(day("2027-01-15"), "15:00", new Date("2027-01-15T10:00:00Z"))).toBe(180);
  });

  it("crosses midnight", () => {
    // 21:30 UTC on 12 Oct is 00:30 on 13 Oct in Cairo.
    expect(minutesUntilStart(day("2026-10-13"), "09:00", new Date("2026-10-12T21:30:00Z"))).toBe(510);
  });
});

describe("customerMayChange", () => {
  const now = new Date("2026-10-12T18:00:00Z"); // 21:00 Cairo

  it("refuses inside the two-hour window", () => {
    // Read as UTC, 22:30 looked 4.5 hours away and was allowed.
    expect(customerMayChange({ status: "CONFIRMED", date: day("2026-10-12"), startTime: "22:30" }, now)).toBe(false);
  });

  it("allows outside it", () => {
    expect(customerMayChange({ status: "CONFIRMED", date: day("2026-10-12"), startTime: "23:30" }, now)).toBe(true);
  });

  it("refuses statuses a customer cannot change", () => {
    for (const status of ["PENDING_PAYMENT", "FAILED_PAYMENT", "ARRIVED", "COMPLETED", "CANCELLED"]) {
      expect(customerMayChange({ status, date: day("2026-10-20"), startTime: "12:00" }, now)).toBe(false);
    }
  });
});
