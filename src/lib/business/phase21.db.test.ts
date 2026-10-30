import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

// lib/business/preview and friends import lib/api, which pulls in
// next-auth; nothing here needs a session.
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/api", () => ({
  err: (message: string, status = 400) => Response.json({ error: message }, { status }),
  requireSession: async () => {
    throw new Error("no session in this test");
  },
  currentCaller: async () => null,
}));

/**
 * Phase 21 on a real Postgres: publishing through the readiness gate,
 * test bookings, CSV import with rollback across two businesses, and a
 * downgrade that keeps every record.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/business/phase21.db.test.ts
 *
 * Everything it creates is tagged p21- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("phase 21 on a real database", () => {
  let db: PrismaClient;
  let publish: typeof import("./publish");
  let createBooking: typeof import("@/lib/bookings/create").createBooking;
  let countedThisMonth: typeof import("@/lib/bookings/create").countedThisMonth;
  let importRun: typeof import("@/lib/import/run");
  let loadEntitlements: typeof import("./entitlements").loadEntitlements;
  let plans: typeof import("@/lib/plans");
  const tag = `p21-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[] };
  const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

  async function makeBusiness(opts: { ready?: boolean; emailVerified?: boolean } = {}) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const n = ids.businesses.length;
    const owner = await db.user.create({
      data: {
        email: `${tag}-${n}@example.test`,
        name: tag,
        emailVerified: opts.emailVerified === false ? null : new Date(),
      },
    });
    ids.users.push(owner.id);
    const ready = opts.ready !== false;
    const business = await db.business.create({
      data: {
        slug: `${tag}-${n}`,
        nameAr: tag,
        ownerId: owner.id,
        cityId: city.id,
        categoryId: category.id,
        isPublished: false,
        minNoticeMinutes: 0,
        phone: ready ? "01012345678" : null,
        address: ready ? "عنوان" : null,
        policiesReviewedAt: ready ? new Date() : null,
        availability: { create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "09:00", closeTime: "17:00" })) },
      },
    });
    ids.businesses.push(business.id);
    const service = await db.service.create({ data: { businessId: business.id, nameAr: "خدمة", duration: 30, price: 100 } });
    return { business, service, owner };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    publish = await import("./publish");
    ({ createBooking, countedThisMonth } = await import("@/lib/bookings/create"));
    importRun = await import("@/lib/import/run");
    ({ loadEntitlements } = await import("./entitlements"));
    plans = await import("@/lib/plans");
  });

  afterAll(async () => {
    if (!db) return;
    await db.lifecycleEvent.deleteMany({ where: { userId: { in: ids.users } } });
    await db.importBatch.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  /* ── Publishing ───────────────────────────────────────────── */

  it("refuses to publish an incomplete business and lists what is missing", async () => {
    const f = await makeBusiness({ ready: false });
    const r = await publish.requestPublish(f.business.id);
    expect(r.published).toBe(false);
    if (r.published || r.reason !== "missing") throw new Error("expected missing");
    expect(r.missing).toEqual(expect.arrayContaining(["phone", "address", "policies"]));
    const row = await db.business.findUniqueOrThrow({ where: { id: f.business.id } });
    expect(row.isPublished).toBe(false);
    expect(row.publishRequestedAt).not.toBeNull();
  });

  it("waits for the email, then the confirmation completes the publish", async () => {
    const f = await makeBusiness({ emailVerified: false });
    const r = await publish.requestPublish(f.business.id);
    expect(r).toMatchObject({ published: false, reason: "missing", waitingForEmail: true });
    await db.user.update({ where: { id: f.owner.id }, data: { emailVerified: new Date() } });
    expect(await publish.afterEmailVerified(f.owner.id)).toBe(true);
    expect((await db.business.findUniqueOrThrow({ where: { id: f.business.id } })).isPublished).toBe(true);
  });

  it("does not publish on email confirmation when the owner never asked", async () => {
    const f = await makeBusiness({ emailVerified: false });
    await db.user.update({ where: { id: f.owner.id }, data: { emailVerified: new Date() } });
    expect(await publish.afterEmailVerified(f.owner.id)).toBe(false);
    expect((await db.business.findUniqueOrThrow({ where: { id: f.business.id } })).isPublished).toBe(false);
  });

  it("never publishes a suspended business", async () => {
    const f = await makeBusiness();
    await db.business.update({ where: { id: f.business.id }, data: { status: "SUSPENDED" } });
    expect(await publish.requestPublish(f.business.id)).toMatchObject({ published: false, reason: "blocked" });
  });

  it("test bookings stay out of the monthly count, and are deleted on publish", async () => {
    const f = await makeBusiness();
    const base = {
      businessId: f.business.id,
      serviceId: f.service.id,
      customerName: "تجربة",
      customerPhone: "01012345678",
      date,
      status: "CONFIRMED" as const,
      totalPrice: 100,
      currency: "EGP",
      depositAmount: null,
    };
    const test = await createBooking({ ...base, customerId: null, startTime: "10:00", isTest: true });
    expect(test.ok).toBe(true);
    expect(await db.booking.count({ where: countedThisMonth(f.business.id) })).toBe(0);
    expect(await db.customer.count({ where: { businessId: f.business.id } })).toBe(0);

    // Nobody is told about it, and it is not in the account of whoever owns that number.
    const { loadBooking } = await import("@/lib/notifications/dispatch");
    expect(test.ok && (await loadBooking(test.booking.id))).toBeNull();
    const { ownedWhere } = await import("@/lib/account/queries");
    expect(await db.booking.count({ where: ownedWhere("201012345678") })).toBe(
      await db.booking.count({ where: { customerPhoneE164: "201012345678", isTest: false } }),
    );
    expect(await db.booking.count({ where: { ...ownedWhere("201012345678"), businessId: f.business.id } })).toBe(0);

    const r = await publish.requestPublish(f.business.id);
    expect(r).toMatchObject({ published: true, removedTestBookings: 1 });
    expect(await db.booking.count({ where: { businessId: f.business.id } })).toBe(0);

    // Once public, a test booking can no longer be made, even by a request already past the route's check.
    const late = await createBooking({ ...base, customerId: null, startTime: "11:00", isTest: true });
    expect(late).toEqual({ ok: false, failure: { kind: "business-published" } });
    const kinds = (await db.lifecycleEvent.findMany({ where: { userId: f.owner.id } })).map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(["PUBLISHED", "PROFILE_COMPLETED"]));
    expect(kinds).not.toContain("FIRST_BOOKING");
  });

  it("unpublishing hides the page, keeps bookings, and forgets the request", async () => {
    const f = await makeBusiness();
    await publish.requestPublish(f.business.id);
    const real = await createBooking({
      businessId: f.business.id,
      serviceId: f.service.id,
      customerId: null,
      customerName: "حقيقي",
      customerPhone: "01012345678",
      date,
      startTime: "11:00",
      status: "CONFIRMED",
      totalPrice: 100,
      currency: "EGP",
      depositAmount: null,
    });
    expect(real.ok).toBe(true);
    await publish.unpublish(f.business.id);
    const row = await db.business.findUniqueOrThrow({ where: { id: f.business.id } });
    expect(row.isPublished).toBe(false);
    expect(row.publishRequestedAt).toBeNull();
    expect(await db.booking.count({ where: { businessId: f.business.id } })).toBe(1);
    // A later email confirmation must not republish it.
    expect(await publish.afterEmailVerified(f.owner.id)).toBe(false);
  });

  /* ── Import ───────────────────────────────────────────────── */

  it("imports customers, skips existing ones, and rolls back only within its own business", async () => {
    const a = await makeBusiness();
    const b = await makeBusiness();
    await db.customer.create({ data: { businessId: a.business.id, name: "قديم", phone: "01112345678" } });

    const csv = "name,phone\nواحد,01012345671\nاتنين,+20 10 1234 5672\nقديم,01112345678\n";
    const plan = await importRun.planImport("CUSTOMERS", a.business.id, csv);
    expect(plan.rows).toHaveLength(2);
    expect(plan.duplicates).toEqual([{ line: 4, where: "existing", value: "01112345678" }]);

    const batch = await importRun.commitImport({ kind: "CUSTOMERS", businessId: a.business.id, userId: a.owner.id, fileName: "c.csv", plan });
    expect(batch).toMatchObject({ rowCount: 2, skipped: 1 });
    expect(await db.customer.count({ where: { businessId: a.business.id } })).toBe(3);

    // Business B cannot roll back business A's batch: it does not exist for B.
    expect(await importRun.rollbackImport(batch.id, b.business.id)).toEqual({ ok: false, reason: "not-found" });
    expect(await db.customer.count({ where: { businessId: a.business.id } })).toBe(3);

    // A customer who booked since the import is kept by the rollback.
    const imported = await db.customer.findFirstOrThrow({ where: { businessId: a.business.id, name: "واحد" } });
    await createBooking({
      businessId: a.business.id,
      serviceId: a.service.id,
      customerId: imported.id,
      customerName: "واحد",
      customerPhone: "01012345671",
      date,
      startTime: "12:00",
      status: "CONFIRMED",
      totalPrice: 100,
      currency: "EGP",
      depositAmount: null,
    });
    expect(await importRun.rollbackImport(batch.id, a.business.id)).toEqual({ ok: true, removed: 1, kept: 1 });
    expect(await importRun.rollbackImport(batch.id, a.business.id)).toEqual({ ok: false, reason: "already-rolled-back" });
    expect((await db.customer.findMany({ where: { businessId: a.business.id } })).map((c) => c.name).sort()).toEqual(["قديم", "واحد"].sort());
  });

  it("imports services after the existing ones and rolls them back", async () => {
    const f = await makeBusiness();
    const plan = await importRun.planImport("SERVICES", f.business.id, "name,duration,price\nخدمة,30,100\nجديدة,45,150\n");
    expect(plan.rows).toHaveLength(1);
    expect(plan.duplicates[0]).toMatchObject({ where: "existing", value: "خدمة" });
    const batch = await importRun.commitImport({ kind: "SERVICES", businessId: f.business.id, userId: f.owner.id, fileName: null, plan });
    const created = await db.service.findFirstOrThrow({ where: { businessId: f.business.id, nameAr: "جديدة" } });
    expect(Number(created.price)).toBe(150);
    expect(await importRun.rollbackImport(batch.id, f.business.id)).toEqual({ ok: true, removed: 1, kept: 0 });
    expect(await db.service.count({ where: { businessId: f.business.id } })).toBe(1);
  });

  /* ── Plans ────────────────────────────────────────────────── */

  it("a lapsed subscription keeps every record but refuses adding over the free ceiling", async () => {
    const f = await makeBusiness();
    await db.business.update({ where: { id: f.business.id }, data: { plan: "PRO", subscriptionStatus: "ACTIVE" } });
    for (const n of ["أ", "ب", "ج"]) {
      await db.staffMember.create({ data: { businessId: f.business.id, nameAr: n, workingDays: [] } });
    }
    let e = await loadEntitlements(f.business.id);
    expect(e).toMatchObject({ effectivePlan: "PRO", usage: { staffMembers: 3 }, limits: { staffMembers: 10 } });

    // The period lapses: nothing is deleted, the effective plan is FREE.
    await db.business.update({ where: { id: f.business.id }, data: { subscriptionStatus: "INACTIVE" } });
    e = await loadEntitlements(f.business.id);
    expect(e).toMatchObject({ plan: "PRO", effectivePlan: "FREE", usage: { staffMembers: 3 }, limits: { staffMembers: 0 } });
    expect(await db.staffMember.count({ where: { businessId: f.business.id } })).toBe(3);
    expect(plans.wouldExceed("FREE", "staffMembers", 3)).toBe(true);
    expect(e?.features.deposits).toBe(false);
    expect(e?.upgrades.deposits).toBe("PRO");
  });
});
