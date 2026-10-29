import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUSES,
  BUSINESS_TRANSITIONS,
  CUSTOMER_TRANSITIONS,
  SYSTEM_TRANSITIONS,
  canTransition,
  isLive,
  isTerminal,
  releasesTime,
  transitionsFrom,
} from "./transitions";

describe("booking transitions", () => {
  it("lists every status in every table", () => {
    for (const table of [BUSINESS_TRANSITIONS, CUSTOMER_TRANSITIONS, SYSTEM_TRANSITIONS]) {
      expect(Object.keys(table).sort()).toEqual([...BOOKING_STATUSES].sort());
    }
  });

  it("never leaves a terminal status", () => {
    for (const s of ["COMPLETED", "CANCELLED", "NO_SHOW"]) {
      expect(isTerminal(s)).toBe(true);
      for (const by of ["business", "customer", "system"] as const) {
        expect(transitionsFrom(s, by)).toEqual([]);
      }
    }
  });

  it("does not let the business confirm a booking that is still waiting for its deposit", () => {
    expect(canTransition("PENDING_PAYMENT", "CONFIRMED", "business")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "CANCELLED", "business")).toBe(true);
    // The money does.
    expect(canTransition("PENDING_PAYMENT", "CONFIRMED", "system")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "PENDING", "system")).toBe(true);
  });

  it("lets the customer cancel, never progress or complete", () => {
    expect(canTransition("CONFIRMED", "CANCELLED", "customer")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "CANCELLED", "customer")).toBe(true);
    expect(canTransition("CONFIRMED", "COMPLETED", "customer")).toBe(false);
    expect(canTransition("ARRIVED", "CANCELLED", "customer")).toBe(false);
  });

  it("only revives a released hold by the system, and only to CONFIRMED", () => {
    expect(canTransition("FAILED_PAYMENT", "CONFIRMED", "system")).toBe(true);
    expect(canTransition("FAILED_PAYMENT", "CONFIRMED", "business")).toBe(false);
    expect(canTransition("FAILED_PAYMENT", "PENDING", "system")).toBe(false);
  });

  it("refuses unknown statuses outright", () => {
    expect(canTransition("CONFIRMED", "DONE", "business")).toBe(false);
    expect(canTransition("WHATEVER", "CANCELLED", "business")).toBe(false);
    expect(transitionsFrom("WHATEVER", "business")).toEqual([]);
  });

  it("knows which moves give the time back because the appointment is off", () => {
    expect(releasesTime("CONFIRMED", "CANCELLED")).toBe(true);
    expect(releasesTime("PENDING_PAYMENT", "FAILED_PAYMENT")).toBe(true);
    // Done or missed: the time is over, but nothing is undone — no
    // discount handed back, no refund flagged.
    expect(releasesTime("CONFIRMED", "COMPLETED")).toBe(false);
    expect(releasesTime("CONFIRMED", "NO_SHOW")).toBe(false);
    expect(releasesTime("PENDING", "CONFIRMED")).toBe(false);
    expect(releasesTime("CANCELLED", "CANCELLED")).toBe(false);
    expect(isLive("ARRIVED")).toBe(true);
    expect(isLive("NO_SHOW")).toBe(false);
  });
});
