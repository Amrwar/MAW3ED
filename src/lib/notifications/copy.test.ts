import { describe, it, expect } from "vitest";
import { copyFor, daysAr } from "./copy";

const c = {
  businessName: "صالون",
  serviceName: "قص",
  when: "الثلاثاء، 20 أكتوبر — 10:00",
  customerName: "منى",
};

describe("notification copy follows the booking's status", () => {
  it("a booking confirmed on creation is not 'waiting'", () => {
    const copy = copyFor({ type: "booking.created", bookingId: "b" }, "customer", { ...c, status: "CONFIRMED" });
    expect(copy.title).toContain("تأكيد");
    expect(copy.body).not.toContain("هيراجع");
  });

  it("a pending booking says the business will confirm it", () => {
    const copy = copyFor({ type: "booking.created", bookingId: "b" }, "customer", { ...c, status: "PENDING" });
    expect(copy.body).toContain("هيراجع");
  });

  it("a reschedule names the old time", () => {
    const copy = copyFor(
      { type: "booking.rescheduled", bookingId: "b", movedTo: "x" },
      "business",
      { ...c, status: "PENDING", previousWhen: "الاثنين، 19 أكتوبر — 09:00" },
    );
    expect(copy.body).toContain("كان الاثنين");
  });

  it("a failed deposit does not claim the time is still held", () => {
    const copy = copyFor({ type: "payment.failed", bookingId: "b" }, "customer", { ...c, status: "FAILED_PAYMENT" });
    expect(copy.body).not.toContain("لسه محجوز");
  });
});

describe("daysAr", () => {
  it("agrees with the number", () => {
    expect(daysAr(1)).toBe("يوم واحد");
    expect(daysAr(2)).toBe("يومين");
    expect(daysAr(3)).toBe("3 أيام");
    expect(daysAr(14)).toBe("14 يوم");
  });
});
