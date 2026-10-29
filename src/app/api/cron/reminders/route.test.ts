import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The reminder cron compares a booking's startsAt, which is Cairo
 * wall-clock written as UTC, with "now". It used to compare it with the
 * real instant, so every appointment looked two to three hours further
 * away than it was: a three-hour reminder arrived with less than one to
 * go, and a "starting in 30 minutes" nudge went out after the
 * appointment had begun.
 */

const findMany = vi.fn();
const notify = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { booking: { findMany: (...a: unknown[]) => findMany(...a), update: vi.fn() } },
}));
vi.mock("@/lib/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));
vi.mock("@/lib/security/cron-auth", () => ({ authorizeCron: () => ({ ok: true }) }));
vi.mock("@/lib/payments/reap", () => ({
  reapAbandonedPayments: async () => ({ abandoned: 0, bookingsReleased: 0, plansReleased: 0 }),
}));

import { GET } from "./route";

/** 20:00 in Cairo on 1 July (summer time, UTC+3), in the startsAt frame. */
const STARTS_AT = new Date("2026-07-01T20:00:00Z");

function booking(over: { reminderLeadHours?: number; startingSoonLeadMins?: number } = {}) {
  return {
    id: "b1",
    startsAt: STARTS_AT,
    customerReminderSentAt: null,
    business: {
      id: "biz",
      reminderEnabled: true,
      reminderLeadHours: over.reminderLeadHours ?? 3,
      startingSoonEnabled: true,
      startingSoonLeadMins: over.startingSoonLeadMins ?? 30,
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
      trialEndsAt: null,
    },
  };
}

async function runAt(instant: string, b = booking()) {
  vi.setSystemTime(new Date(instant));
  findMany.mockImplementation(async (args: { where: { status: string } }) =>
    args.where.status === "CONFIRMED" ? [b] : [],
  );
  await GET(new Request("http://localhost/api/cron/reminders"));
  return notify.mock.calls.map(([e]) => (e as { type: string }).type);
}

beforeEach(() => {
  vi.useFakeTimers();
  notify.mockReset();
  notify.mockResolvedValue([{ status: "SENT" }]);
  findMany.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("reminders cron — Cairo wall clock", () => {
  it("sends the three-hour reminder at 17:30 Cairo, two and a half hours before", async () => {
    // 14:30Z is 17:30 in Cairo. Against the real instant the booking
    // looked 330 minutes away and the reminder waited.
    const sent = await runAt("2026-07-01T14:30:00Z");
    expect(sent).toContain("booking.reminder");
    expect(sent).not.toContain("booking.startingSoon");
  });

  it("sends 'starting soon' 25 minutes before, not after the start", async () => {
    const sent = await runAt("2026-07-01T16:35:00Z"); // 19:35 Cairo
    expect(sent).toContain("booking.startingSoon");
  });

  it("asks the database for appointments from Cairo's 'now', not the real instant", async () => {
    await runAt("2026-07-01T16:35:00Z");
    const where = findMany.mock.calls[0][0].where as { startsAt: { gte: Date } };
    expect(where.startsAt.gte.toISOString()).toBe("2026-07-01T19:35:00.000Z");
  });
});
