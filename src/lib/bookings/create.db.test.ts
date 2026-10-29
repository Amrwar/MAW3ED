import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * createBooking against a real Postgres, constraints and all.
 *
 * The Phase 17 defects only show with a database underneath: two
 * "anyone available" bookings for one barber, both accepted, and a
 * customer's emails sent to whichever address the first anonymous
 * booking for their number left on the Customer record.
 *
 * Needs a LOCAL database with every file in prisma/migrations applied
 * (phase17_booking_integrity.sql included); skipped otherwise:
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/bookings/create.db.test.ts
 *
 * Everything it creates is tagged p17test- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("createBooking on a real database", () => {
  let db: PrismaClient;
  let createBooking: typeof import("./create").createBooking;
  let loadBooking: typeof import("@/lib/notifications/dispatch").loadBooking;
  let loadAvailability: typeof import("./schedule").loadAvailability;
  const tag = `p17test-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[] };

  // Tomorrow in Cairo, far enough ahead that minimum notice never bites.
  const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  async function makeBusiness(staff: string[]) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({ data: { email: `${tag}-${ids.users.length}@example.test`, name: tag } });
    ids.users.push(owner.id);
    const business = await db.business.create({
      data: {
        slug: `${tag}-${ids.businesses.length}`,
        nameAr: tag,
        ownerId: owner.id,
        cityId: city.id,
        categoryId: category.id,
        minNoticeMinutes: 0,
        bufferMinutes: 0,
        availability: {
          create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "09:00", closeTime: "17:00" })),
        },
      },
    });
    ids.businesses.push(business.id);
    const service = await db.service.create({
      data: { businessId: business.id, nameAr: "قص", duration: 60, price: 100 },
    });
    const members = [];
    for (const name of staff) {
      members.push(await db.staffMember.create({ data: { businessId: business.id, nameAr: name, workingDays: [] } }));
    }
    const customer = await db.customer.create({
      data: { businessId: business.id, name: "زبون", phone: "01000000000" },
    });
    return { business, service, members, customer };
  }

  function book(
    f: Awaited<ReturnType<typeof makeBusiness>>,
    startTime: string,
    extra: { staffMemberId?: string; customerEmail?: string } = {},
  ) {
    return createBooking({
      businessId: f.business.id,
      serviceId: f.service.id,
      customerId: f.customer.id,
      customerName: "زبون",
      customerPhone: "01000000000",
      date,
      startTime,
      status: "CONFIRMED",
      totalPrice: 100,
      currency: "EGP",
      depositAmount: null,
      ...extra,
    });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ createBooking } = await import("./create"));
    ({ loadBooking } = await import("@/lib/notifications/dispatch"));
    ({ loadAvailability } = await import("./schedule"));
  });

  afterAll(async () => {
    if (!db) return;
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("gives 'anyone' to the barber, and will not seat a second customer in his chair", async () => {
    const f = await makeBusiness(["أحمد"]);
    const first = await book(f, "10:00");
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.booking.staffMemberId).toBe(f.members[0].id);

    const second = await book(f, "10:00");
    expect(second).toEqual({ ok: false, failure: { kind: "slot-unavailable", reason: null } });

    // Asking for him by name is refused as well.
    const named = await book(f, "10:00", { staffMemberId: f.members[0].id });
    expect(named.ok).toBe(false);
  });

  it("under a race, gives two barbers two bookings and refuses the third", async () => {
    const f = await makeBusiness(["سارة", "عمر"]);
    const results = await Promise.all([book(f, "11:00"), book(f, "11:00"), book(f, "11:00")]);
    const made = results.filter((r) => r.ok);
    // Two, not one: a request that lost the race for a barber is given
    // the other one rather than told the time has gone.
    expect(made.length).toBe(2);
    const assigned = made.map((r) => (r.ok ? r.booking.staffMemberId : null));
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(assigned.every((id) => id !== null)).toBe(true);

    const live = await db.booking.count({
      where: { businessId: f.business.id, startTime: "11:00", status: "CONFIRMED" },
    });
    expect(live).toBe(made.length);
  });

  it("still lets a booking with a since-deactivated barber be moved", async () => {
    const f = await makeBusiness(["أحمد", "عمر"]);
    const made = await book(f, "15:00", { staffMemberId: f.members[0].id });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    await db.staffMember.update({ where: { id: f.members[0].id }, data: { isActive: false } });

    const query = { businessId: f.business.id, serviceId: f.service.id, date, staffMemberId: f.members[0].id };
    // A new booking with him is refused...
    expect((await loadAvailability(query)).slots).toEqual([]);
    // ...but moving the one he has is not.
    expect((await loadAvailability({ ...query, excludeBookingId: made.booking.id })).slots).toContain("16:00");
  });

  it("refuses a staff member who is not this business's", async () => {
    const f = await makeBusiness(["أحمد"]);
    const other = await makeBusiness(["غريب"]);
    const r = await book(f, "12:00", { staffMemberId: other.members[0].id });
    expect(r).toEqual({ ok: false, failure: { kind: "slot-unavailable", reason: "staff-off" } });
  });

  it("sends a booking's emails to the address typed with it, never the Customer record's", async () => {
    const f = await makeBusiness(["أحمد"]);
    // Somebody else's address, left on the record by an earlier
    // anonymous booking for this number.
    await db.customer.update({ where: { id: f.customer.id }, data: { email: "planted@example.test" } });

    const withEmail = await book(f, "13:00", { customerEmail: "owner-of-phone@example.test" });
    const without = await book(f, "14:00");
    expect(withEmail.ok && without.ok).toBe(true);
    if (!withEmail.ok || !without.ok) return;

    expect((await loadBooking(withEmail.booking.id))?.booking?.customerEmail).toBe("owner-of-phone@example.test");
    expect((await loadBooking(without.booking.id))?.booking?.customerEmail).toBeNull();
  });
});
