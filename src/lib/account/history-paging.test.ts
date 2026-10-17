import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two tabs of a customer's bookings, and paging through history.
 *
 * Bugs this holds down:
 * - getHistory skipped raw rows and only then dropped the upcoming ones,
 *   while `total` counted every booking, so paging repeated some rows
 *   and never reached others;
 * - a legacy row (no endsAt) vanished from both tabs between its start
 *   and midnight, because the two tabs used different end rules;
 * - offset paging shifted when a booking moved into history mid-scroll.
 *
 * The db is an in-memory table that evaluates the where clauses the
 * queries actually send, so moving a filter back out of the query, or
 * letting the two tabs disagree, fails here.
 */

type Row = {
  id: string;
  customerPhoneE164: string;
  status: string;
  date: Date;
  startTime: string;
  endTime: string | null;
  endsAt: Date | null;
};

const table: Row[] = [];

type Where = Record<string, unknown>;

const cmp = (a: unknown, b: unknown) => {
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  return (x as number | string) < (y as number | string) ? -1 : (x as number | string) > (y as number | string) ? 1 : 0;
};
const eq = (a: unknown, b: unknown) => (a === null || b === null ? a === b : cmp(a, b) === 0);

function fieldMatches(value: unknown, cond: unknown): boolean {
  if (cond === null || cond instanceof Date || typeof cond !== "object") return eq(value, cond);
  return Object.entries(cond as Record<string, unknown>).every(([op, arg]) => {
    switch (op) {
      case "lt": return value !== null && cmp(value, arg) < 0;
      case "lte": return value !== null && cmp(value, arg) <= 0;
      case "gt": return value !== null && cmp(value, arg) > 0;
      case "gte": return value !== null && cmp(value, arg) >= 0;
      case "in": return (arg as unknown[]).includes(value);
      case "notIn": return value !== null && !(arg as unknown[]).includes(value);
      case "not": return !eq(value, arg);
      default: throw new Error(`unsupported op ${op}`);
    }
  });
}

function matches(r: Row, w: Where): boolean {
  return Object.entries(w).every(([k, v]) => {
    if (k === "AND") return (v as Where[]).every((x) => matches(r, x));
    if (k === "OR") return (v as Where[]).some((x) => matches(r, x));
    return fieldMatches(r[k as keyof Row], v);
  });
}

type Order = Array<Record<string, "asc" | "desc">>;
function sorted(rows: Row[], order: Order): Row[] {
  return [...rows].sort((a, b) => {
    for (const o of order) {
      const [k, dir] = Object.entries(o)[0];
      const c = cmp(a[k as keyof Row], b[k as keyof Row]);
      if (c) return dir === "asc" ? c : -c;
    }
    return 0;
  });
}

const decorate = (r: Row) => ({
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
    slug: "s", nameAr: "ن", nameEn: null, phone: null, whatsapp: null, address: null,
    logoImage: null, coverImage: null, category: { slug: "c" },
    city: { nameAr: "ق", nameEn: "Cairo" }, neighborhood: null,
  },
});

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({
  db: {
    booking: {
      findMany: async (q: { where: Where; take?: number; skip?: number; orderBy: Order }) => {
        const all = sorted(table.filter((r) => matches(r, q.where)), q.orderBy).map(decorate);
        const skip = q.skip ?? 0;
        return q.take === undefined ? all.slice(skip) : all.slice(skip, skip + q.take);
      },
      count: async (q: { where: Where }) => table.filter((r) => matches(r, q.where)).length,
    },
  },
}));

import { getHistory, getUpcoming } from "./queries";

const PHONE = "+201000000777";
// 2026-10-14 13:00 in Cairo (UTC+3).
const FIXED = new Date("2026-10-14T10:00:00Z");
const TODAY = Date.UTC(2026, 9, 14);

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function add(id: string, dayOffset: number, startTime: string, status: string, legacy: "none" | "no-endsAt" | "no-end" = "none") {
  const day = new Date(TODAY + dayOffset * 86_400_000);
  const [h, m] = startTime.split(":").map(Number);
  const endMin = h * 60 + m + 30;
  table.push({
    id,
    customerPhoneE164: PHONE,
    status,
    date: day,
    startTime,
    endTime: legacy === "no-end" ? null : hhmm(endMin),
    endsAt: legacy === "none" ? new Date(day.getTime() + endMin * 60_000) : null,
  });
}

async function pageAll(take: number, mode: "skip" | "cursor") {
  const seen: string[] = [];
  let skip = 0;
  let cursor: string | null = null;
  let total = -1;
  for (let i = 0; i < 100; i++) {
    const page = await getHistory(PHONE, mode === "skip" ? { take, skip } : { take, cursor });
    total = page.total;
    seen.push(...page.bookings.map((b) => b.id));
    if (mode === "skip") {
      if (page.bookings.length === 0) break;
      skip += take;
    } else {
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  }
  return { seen, total };
}

describe("history and upcoming", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
    table.length = 0;
    // 40 past bookings, several sharing a day and a time so the id
    // tie-break matters, in assorted final and live statuses.
    const statuses = ["COMPLETED", "CANCELLED", "NO_SHOW", "CONFIRMED", "PENDING"];
    for (let i = 0; i < 40; i++) {
      add(`past-${String(i).padStart(2, "0")}`, -1 - Math.floor(i / 3), i % 2 ? "10:00" : "09:00", statuses[i % 5]);
    }
    add("up-1", 1, "10:00", "CONFIRMED");
    add("up-2", 2, "11:00", "PENDING");
    add("up-3", 5, "12:00", "PENDING_PAYMENT");
    add("cancelled-future", 3, "10:00", "CANCELLED");
    // Legacy rows (no endsAt), today: one over (ended 12:30), one still
    // to come, one with no end at all that started at 12:00.
    add("legacy-today-over", 0, "12:00", "CONFIRMED", "no-endsAt");
    add("legacy-today-later", 0, "15:00", "CONFIRMED", "no-endsAt");
    add("legacy-today-noend", 0, "12:00", "CONFIRMED", "no-end");
    add("legacy-yesterday", -1, "18:00", "CONFIRMED", "no-endsAt");
    // A current-schema booking in progress right now (12:45–13:15).
    add("now-in-chair", 0, "12:45", "IN_PROGRESS");
    table.push({ ...table[0], id: "other", customerPhoneE164: "+201999999999" });
  });

  it("puts every booking in exactly one tab, legacy rows included", async () => {
    const upcoming = (await getUpcoming(PHONE)).map((b) => b.id);
    const { seen } = await pageAll(100, "skip");
    const mine = table.filter((r) => r.customerPhoneE164 === PHONE).map((r) => r.id);

    expect(upcoming.filter((id) => seen.includes(id))).toEqual([]);
    expect([...upcoming, ...seen].sort()).toEqual([...mine].sort());

    expect(seen).toContain("legacy-today-over");
    expect(seen).toContain("legacy-today-noend");
    expect(seen).toContain("legacy-yesterday");
    expect(upcoming).toEqual(["now-in-chair", "legacy-today-later", "up-1", "up-2", "up-3"]);
  });

  for (const mode of ["skip", "cursor"] as const) {
    it(`pages through every past booking exactly once by ${mode}, in a stable order`, async () => {
      const { seen, total } = await pageAll(7, mode);
      expect(total).toBe(44); // 40 past + cancelled future + 3 legacy over
      expect(seen).toHaveLength(44);
      expect(new Set(seen).size).toBe(44);
      expect(seen.some((id) => id.startsWith("up-"))).toBe(false);
      expect(seen).not.toContain("other");

      const all = await getHistory(PHONE, { take: 100 });
      expect(all.bookings.map((b) => b.id)).toEqual(seen);
      expect(all.nextCursor).toBeNull();
    });
  }

  it("does not repeat a row when a booking moves into history mid-paging (cursor)", async () => {
    const first = await getHistory(PHONE, { take: 10 });
    // 16:00 now: legacy-today-later (ended 15:30) and now-in-chair are history.
    vi.setSystemTime(new Date("2026-10-14T13:00:00Z"));
    const seen = first.bookings.map((b) => b.id);
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await getHistory(PHONE, { take: 10, cursor });
      seen.push(...page.bookings.map((b) => b.id));
      cursor = page.nextCursor;
    }
    expect(new Set(seen).size).toBe(seen.length);
    // Everything that was history when paging began is still reached.
    for (const id of first.bookings.map((b) => b.id)) expect(seen).toContain(id);
    expect(seen).toContain("past-39");
  });

  it("counts the same set it returns", async () => {
    const { bookings, total } = await getHistory(PHONE, { take: 100 });
    expect(total).toBe(bookings.length);
  });
});
