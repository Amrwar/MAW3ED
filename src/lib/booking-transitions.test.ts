import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Keeps the buttons the app offers in step with the moves the API
 * accepts.
 *
 * The mobile bookings screen offered "وصل" (ARRIVED) and "ابدأ"
 * (IN_PROGRESS). Both are real members of BookingStatus, both are
 * named in the labels, and both are counted by the booking_no_overlap
 * constraint — and neither is reachable: bookingStatusSchema does not
 * list them and VALID_TRANSITIONS never produces them. Two of the five
 * buttons returned 422 every time.
 *
 * The lists live in two codebases that build separately, so they are
 * compared by reading both files rather than importing across the
 * boundary.
 *
 * Which buttons the app shows for a booking is the server's call (the
 * detail response carries `actions`, filtered by role, so moves out of
 * a final state never arrive); the app only holds a label for each
 * status it can draw. That label map is what is checked here: a label
 * for a status the API never accepts is a button that would 422.
 */

const ROOT = process.cwd();

const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** The statuses PATCH /api/business/bookings/[id] will accept. */
function schemaStatuses(): Set<string> {
  const source = read("src/lib/validations.ts");
  // A generous window: the schema is multi-line and carries a comment
  // explaining why ARRIVED and IN_PROGRESS are in it.
  const match = source.match(/bookingStatusSchema[\s\S]{0,800}?z\.enum\(\[([^\]]+)\]\)/);
  if (!match) throw new Error("bookingStatusSchema not found");
  return new Set([...match[1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]));
}

/** Every status VALID_TRANSITIONS can actually move a booking into. */
function reachableStatuses(): Set<string> {
  const source = read("src/app/api/business/bookings/[id]/route.ts");
  const match = source.match(/VALID_TRANSITIONS[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  if (!match) throw new Error("VALID_TRANSITIONS not found");
  return new Set([...match[1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]));
}

/** The statuses the mobile app can draw as buttons. */
function mobileOffered(): Set<string> {
  const source = read("mobile/app/manage/booking/[id].tsx");
  const match = source.match(/const ACTION[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!match) throw new Error("ACTION map not found");
  return new Set([...match[1].matchAll(/^\s*([A-Z_]+):/gm)].map((m) => m[1]));
}

describe("the booking actions the app offers", () => {
  it("finds all three lists", () => {
    // Guards the comparisons below from passing because a regex broke
    // and matched nothing.
    expect(schemaStatuses().size).toBeGreaterThan(3);
    expect(reachableStatuses().size).toBeGreaterThan(3);
    expect(mobileOffered().size).toBeGreaterThan(1);
  });

  it("offers only statuses the API's schema accepts", () => {
    const accepted = schemaStatuses();
    const rejected = [...mobileOffered()].filter((s) => !accepted.has(s));
    // Named, because the fix is specific: drop the button, or add the
    // status to bookingStatusSchema and VALID_TRANSITIONS.
    expect(rejected).toEqual([]);
  });

  it("offers only statuses a transition can actually reach", () => {
    const reachable = reachableStatuses();
    const unreachable = [...mobileOffered()].filter((s) => !reachable.has(s));
    expect(unreachable).toEqual([]);
  });
});
