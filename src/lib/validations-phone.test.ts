import { describe, it, expect } from "vitest";
import { bookingSchema, ownerBookingSchema } from "./validations";
import { PHONE_INVALID } from "./phone";

const base = {
  serviceId: "svc_1",
  date: "2026-10-20",
  startTime: "10:00",
  customerName: "Sara QA",
};

const phoneOk = (schema: { safeParse: (v: unknown) => { success: boolean } }, customerPhone: string) =>
  schema.safeParse({ ...base, customerPhone }).success;

describe("booking phone numbers", () => {
  it("takes a mobile from any country, written any way normalisePhone reads", () => {
    for (const n of ["01012345678", "+20 101 234 5678", "+966 50 123 4567", "+1 415 555 2671"]) {
      expect(phoneOk(bookingSchema, n)).toBe(true);
    }
  });

  it("refuses what reaches nobody — the eight digits that got into production", () => {
    const r = bookingSchema.safeParse({ ...base, customerPhone: "10800348" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe(PHONE_INVALID);
  });

  it("lets an owner enter a landline for a walk-in, still refusing nonsense", () => {
    expect(phoneOk(bookingSchema, "0223456789")).toBe(false);
    expect(phoneOk(ownerBookingSchema, "0223456789")).toBe(true);
    expect(phoneOk(ownerBookingSchema, "10800348")).toBe(false);
  });
});

describe("walk-ins at the desk", () => {
  it("needs no date or time for a walk-in, and both otherwise", () => {
    const { date: _d, startTime: _t, ...noTime } = base;
    expect(ownerBookingSchema.safeParse({ ...noTime, customerPhone: "01012345678", walkIn: true }).success).toBe(true);
    expect(ownerBookingSchema.safeParse({ ...noTime, customerPhone: "01012345678" }).success).toBe(false);
  });
});
