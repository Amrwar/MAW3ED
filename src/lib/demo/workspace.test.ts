import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { initialDemoState, demoSlots, demoBook, demoSetStatus, demoReport } from "./workspace";

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
    const s = initialDemoState();
    // Karim does not work Fridays (5); the only slots go to Youssef.
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
