import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Paging through a customer's history.
 *
 * The bug: getHistory skipped raw rows and only then dropped the
 * upcoming ones, while `total` counted every booking. Paging with
 * skip/take repeated some rows and never reached others. The fix puts
 * the filter in the query and counts the same set; this checks it
 * against an in-memory table that honours the where clause getHistory
 * actually sends, so it fails if the filter moves back out of the query.
 */

type Row = {
  id: string;
  customerPhoneE164: string;
  status: string;
  date: Date;
  startTime: string;
  endTime: string;
  endsAt: Date | null;
};

const table: Row[] = [];

type Where = {
  customerPhoneE164: string;
  OR: Array<
    | { status: { notIn: string[] } }
    | { endsAt: { lte: Date } }
    | { endsAt: null; date: { lt: Date } }
  >;
};

function matches(r: Row, w: Where): boolean {
  if (r.customerPhoneE164 !== w.customerPhoneE164) return false;
  return w.OR.some((c) => {
    if ("status" in c) return !c.status.notIn.includes(r.status);
    if (c.endsAt === null) return r.endsAt === null && r.date < (c as { date: { lt: Date } }).date.lt;
    return r.endsAt !== null && r.endsAt <= (c.endsAt as { lte: Date }).lte;
  });
}

function sorted(rows: Row[]): Row[] {
  return [...rows].sort(
    (a, b) =>
      b.date.getTime() - a.date.getTime() ||
      b.startTime.localeCompare(a.startTime) ||
      b.id.localeCompare(a.id),
  );
}

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({
  db: {
    booking: {
      findMany: async (q: { where: Where; take: number; skip: number }) =>
        sorted(table.filter((r) => matches(r, q.where)))
          .slice(q.skip, q.skip + q.take)
          .map((r) => ({
            ...r,
            reference: null,
            accessToken: null,
            partySize: null,
            totalPrice: 100,
            depositAmount: null,
            currency: "EGP",
            service: { nameAr: "قص", nameEn: null, duration: 30 },
            staffMember: null,
            resource: null,
            branch: null,
            review: null,
            business: {
              slug: "s",
              nameAr: "ن",
              nameEn: null,
              phone: null,
              whatsapp: null,
              address: null,
              logoImage: null,
              coverImage: null,
              category: { slug: "c" },
              city: { nameAr: "ق", nameEn: "Cairo" },
              neighborhood: null,
            },
          })),
      count: async (q: { where: Where }) => table.filter((r) => matches(r, q.where)).length,
    },
  },
}));

import { getHistory } from "./queries";
import { cairoWallClock } from "@/lib/bookings/instants";

const PHONE = "+201000000777";

function add(id: string, dayOffset: number, startTime: string, status: string) {
  const now = cairoWallClock();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset));
  const [h, m] = startTime.split(":").map(Number);
  const endMin = h * 60 + m + 30;
  table.push({
    id,
    customerPhoneE164: PHONE,
    status,
    date: day,
    startTime,
    endTime: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`,
    endsAt: new Date(day.getTime() + endMin * 60_000),
  });
}

describe("getHistory paging", () => {
  beforeEach(() => {
    table.length = 0;
    // 40 past bookings, several sharing a day and a time so the id
    // tie-break matters, in assorted final and live statuses.
    const statuses = ["COMPLETED", "CANCELLED", "NO_SHOW", "CONFIRMED", "PENDING"];
    for (let i = 0; i < 40; i++) {
      add(`past-${String(i).padStart(2, "0")}`, -1 - Math.floor(i / 3), i % 2 ? "10:00" : "09:00", statuses[i % 5]);
    }
    // Upcoming, interleaved by date with nothing: these must never appear.
    add("up-1", 1, "10:00", "CONFIRMED");
    add("up-2", 2, "11:00", "PENDING");
    add("up-3", 5, "12:00", "PENDING_PAYMENT");
    // A cancelled future booking is history, not upcoming.
    add("cancelled-future", 3, "10:00", "CANCELLED");
    // Another customer's booking.
    table.push({ ...table[0], id: "other", customerPhoneE164: "+201999999999" });
  });

  it("pages through every past booking exactly once, in a stable order", async () => {
    const seen: string[] = [];
    let total = -1;
    for (let skip = 0; skip < 200; skip += 7) {
      const page = await getHistory(PHONE, { take: 7, skip });
      total = page.total;
      if (page.bookings.length === 0) break;
      seen.push(...page.bookings.map((b) => b.id));
    }

    expect(total).toBe(41); // 40 past + the cancelled future one
    expect(seen).toHaveLength(41);
    expect(new Set(seen).size).toBe(41);
    expect(seen.some((id) => id.startsWith("up-"))).toBe(false);
    expect(seen).toContain("cancelled-future");
    expect(seen).not.toContain("other");

    // Pages concatenate to the same list as one big read.
    const all = await getHistory(PHONE, { take: 100, skip: 0 });
    expect(all.bookings.map((b) => b.id)).toEqual(seen);
  });

  it("counts the same set it returns", async () => {
    const { bookings, total } = await getHistory(PHONE, { take: 100 });
    expect(total).toBe(bookings.length);
  });
});
