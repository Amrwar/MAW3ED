import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  initialDemoState, demoSlots, demoBook, demoSetStatus, demoReport,
  demoReply, demoAddOffer, demoToggleOffer, demoSetSettings, demoOverview, REMINDER_LEAD_CHOICES,
} from "./workspace";

describe("demo workspace", () => {
  it("cannot reach live data: no db, api, session or network in the demo code", () => {
    const files = [
      join(__dirname, "workspace.ts"),
      ...readdirSync(join(process.cwd(), "src/app/demo"), { recursive: true })
        .map(String)
        .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
        .map((f) => join(process.cwd(), "src/app/demo", f)),
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/@\/lib\/db|@\/lib\/api|@\/auth|next-auth|@prisma\/client|\bfetch\(|\/api\//);
    }
  });

  it("offers only free times from the real engine and books into local state", () => {
    const s = initialDemoState();
    // Karim is booked 17:00-17:30 for a haircut.
    const k = demoSlots(s, "s-cut", "t-1", 1, 9 * 60);
    expect(k.slots).not.toContain("17:00");
    expect(k.slots).toContain("10:00");
    const after = demoBook(s, { serviceId: "s-cut", staffId: "t-1", time: "10:00", customerName: "" });
    expect(demoSlots(after, "s-cut", "t-1", 1, 9 * 60).slots).not.toContain("10:00");
    // The original state is untouched.
    expect(s.bookings).toHaveLength(6);
    expect(after.bookings).toHaveLength(7);
  });

  it("does not offer a staff member on their day off", () => {
    // Both seeded team members work every day (the seeded bookings are on
    // "today", whatever weekday that is), so give Karim Fridays off here.
    const base = initialDemoState();
    const s = { ...base, staff: base.staff.map((st) => (st.id === "t-1" ? { ...st, workingDays: [0, 1, 2, 3, 4, 6] } : st)) };
    const any = demoSlots(s, "s-cut", null, 5, 0);
    expect(Object.values(any.assignments).every((id) => id === "t-2")).toBe(true);
    expect(demoSlots(s, "s-cut", "t-1", 5, 0).slots).toHaveLength(0);
  });

  it("reports revenue from completed visits only, and resets to fresh data", () => {
    const s = initialDemoState();
    expect(demoReport(s).revenue).toBe(120 + 170);
    const done = demoSetStatus(s, "b-4", "COMPLETED");
    expect(demoReport(done).revenue).toBe(120 + 170 + 300);
    expect(demoReport(initialDemoState()).revenue).toBe(290);
  });
});

describe("the demo's grow and insight features", () => {
  it("replies to a review, and an empty reply clears it, without touching the original", () => {
    const s = initialDemoState();
    const replied = demoReply(s, "r-2", "  Thanks, see you soon  ");
    expect(replied.reviews.find((r) => r.id === "r-2")?.reply).toBe("Thanks, see you soon");
    expect(demoReply(replied, "r-2", "   ").reviews.find((r) => r.id === "r-2")?.reply).toBeNull();
    expect(s.reviews.find((r) => r.id === "r-2")?.reply).toBeNull();
  });

  it("creates a discount code with the real form's rules", () => {
    const s = initialDemoState();
    const ok = demoAddOffer(s, " summer15 ", 15);
    expect("state" in ok && ok.state.offers.at(-1)).toMatchObject({ code: "SUMMER15", percent: 15, uses: 0, active: true });
    // The real API takes any code up to 40 characters, and 1 to 100%.
    expect("state" in demoAddOffer(s, "EID-2026", 100)).toBe(true);
    expect("state" in demoAddOffer(s, "AB", 1)).toBe(true);
    expect(demoAddOffer(s, "   ", 15)).toEqual({ error: "code" });
    expect(demoAddOffer(s, "X".repeat(41), 15)).toEqual({ error: "code" });
    expect(demoAddOffer(s, "SUMMER", 0)).toEqual({ error: "percent" });
    expect(demoAddOffer(s, "SUMMER", 101)).toEqual({ error: "percent" });
    expect(demoAddOffer(s, "SUMMER", 12.5)).toEqual({ error: "percent" });
    expect(demoAddOffer(s, "welcome10", 20)).toEqual({ error: "duplicate" });
    expect(s.offers).toHaveLength(1);
  });

  it("switches a code off and on", () => {
    const off = demoToggleOffer(initialDemoState(), "o-1");
    expect(off.offers[0].active).toBe(false);
    expect(demoToggleOffer(off, "o-1").offers[0].active).toBe(true);
  });

  it("changes settings, with lead times the real settings form offers", () => {
    const s = demoSetSettings(initialDemoState(), { reminderLeadHours: 2, reminderEnabled: false });
    expect(s.settings).toEqual({ reminderEnabled: false, reminderLeadHours: 2, autoConfirm: false });
    expect(REMINDER_LEAD_CHOICES).toContain(initialDemoState().settings.reminderLeadHours);
  });

  it("counts the overview from the bookings and reviews", () => {
    const s = initialDemoState();
    const o = demoOverview(s);
    expect(o.today).toBe(6);
    expect(o.pending).toBe(1);
    // Everything but the no-show: 120 + 170 + 300 + 120 + 170.
    expect(o.expected).toBe(880);
    expect(o.earned).toBe(290);
    expect(o.rating).toBe(4.7);
    expect(o.unanswered).toBe(2);
    const confirmed = demoOverview(demoSetStatus(s, "b-6", "CONFIRMED"));
    expect(confirmed.pending).toBe(0);
    expect(demoOverview(demoReply(s, "r-2", "Thanks")).unanswered).toBe(1);
  });
});
