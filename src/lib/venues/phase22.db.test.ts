import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/api", () => ({
  err: (message: string, status = 400) => Response.json({ error: message }, { status }),
  requireSession: async () => {
    throw new Error("no session in this test");
  },
  currentCaller: async () => null,
}));

/**
 * Phase 22 on a real Postgres: venues, tenancy, isolation and the
 * constraints the schema language cannot express.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/venues/phase22.db.test.ts
 *
 * Everything it creates is tagged p22- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("phase 22 on a real database", () => {
  let db: PrismaClient;
  let m: typeof import("./memberships");
  let pub: typeof import("./public");
  let metrics: typeof import("./metrics");
  let access: typeof import("./access");
  let createBooking: typeof import("@/lib/bookings/create").createBooking;
  const tag = `p22-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[], orgs: [] as string[], compounds: [] as string[], venues: [] as string[] };
  const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

  async function owner(n: string) {
    const u = await db.user.create({ data: { email: `${tag}-${n}@example.test`, name: `${tag} ${n}`, emailVerified: new Date() } });
    ids.users.push(u.id);
    return u;
  }

  async function business(n: string, opts: { published?: boolean; branches?: string[] } = {}) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const o = await owner(`owner-${n}`);
    const b = await db.business.create({
      data: {
        slug: `${tag}-${n}`,
        nameAr: `${tag} ${n}`,
        ownerId: o.id,
        cityId: city.id,
        categoryId: category.id,
        isPublished: opts.published ?? true,
        minNoticeMinutes: 0,
        availability: { create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "09:00", closeTime: "17:00" })) },
        branches: { create: (opts.branches ?? []).map((name, i) => ({ nameAr: name, sortOrder: i })) },
      },
      include: { branches: true },
    });
    ids.businesses.push(b.id);
    const service = await db.service.create({ data: { businessId: b.id, nameAr: "خدمة", duration: 30, price: 100 } });
    return { business: b, owner: o, service };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    m = await import("./memberships");
    pub = await import("./public");
    metrics = await import("./metrics");
    access = await import("./access");
    ({ createBooking } = await import("@/lib/bookings/create"));
  });

  afterAll(async () => {
    if (!db) return;
    await db.auditLog.deleteMany({ where: { resourceType: "Venue", resourceId: { in: ids.venues } } });
    await db.venue.deleteMany({ where: { id: { in: ids.venues } } });
    await db.compound.deleteMany({ where: { id: { in: ids.compounds } } });
    await db.venueOrganization.deleteMany({ where: { id: { in: ids.orgs } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.lifecycleEvent.deleteMany({ where: { userId: { in: ids.users } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  async function setup() {
    const city = await db.city.findFirstOrThrow();
    const org = await db.venueOrganization.create({ data: { slug: `${tag}-org`, nameAr: "جهة تجريبية" } });
    ids.orgs.push(org.id);
    const compound = await db.compound.create({ data: { slug: `${tag}-cmp`, nameAr: "كمبوند تجريبي", cityId: city.id, organizationId: org.id } });
    ids.compounds.push(compound.id);
    const mk = async (n: string, compoundId: string | null) => {
      const v = await db.venue.create({
        data: { slug: `${tag}-${n}`, nameAr: `مول ${n}`, cityId: city.id, organizationId: org.id, compoundId, status: "ACTIVE", isPublished: true, policy: { create: {} } },
      });
      ids.venues.push(v.id);
      return v;
    };
    return { org, compound, mallA: await mk("a", compound.id), mallB: await mk("b", null) };
  }

  let ctx: Awaited<ReturnType<typeof setup>>;

  it("creates an organisation with two venues, one in a compound and one outside it", async () => {
    ctx = await setup();
    const venues = await db.venue.findMany({ where: { organizationId: ctx.org.id } });
    expect(venues).toHaveLength(2);
    // Defaults: an empty, open policy; no tenants.
    expect(await db.venuePolicy.count({ where: { venueId: { in: venues.map((v) => v.id) } } })).toBe(2);
    expect((await pub.loadPublicVenue(ctx.mallA.slug))?.directory).toEqual([]);
  });

  it("a draft or suspended venue has no public page", async () => {
    const city = await db.city.findFirstOrThrow();
    const draft = await db.venue.create({ data: { slug: `${tag}-draft`, nameAr: "مسودة", cityId: city.id } });
    ids.venues.push(draft.id);
    expect(await pub.loadPublicVenue(draft.slug)).toBeNull();
    await db.venue.update({ where: { id: draft.id }, data: { status: "SUSPENDED", isPublished: true } });
    expect(await pub.loadPublicVenue(draft.slug)).toBeNull();
  });

  it("a branch is listed only after the venue approves, and leaves when removed", async () => {
    const cafe = await business("cafe", { branches: ["فرع المول", "فرع تاني"] });
    const branch = cafe.business.branches[0];
    const req = await m.requestMembership({ businessId: cafe.business.id, userId: cafe.owner.id, venueId: ctx.mallA.id, branchId: branch.id, unit: "G-12" });
    expect(req.status).toBe("REQUESTED");
    expect((await pub.loadPublicVenue(ctx.mallA.slug))!.directory).toHaveLength(0);

    // The same branch cannot ask twice while one request is live.
    await expect(
      m.requestMembership({ businessId: cafe.business.id, userId: cafe.owner.id, venueId: ctx.mallA.id, branchId: branch.id, unit: null }),
    ).rejects.toMatchObject({ code: "already-live" });

    const zone = await db.venueZone.create({ data: { venueId: ctx.mallA.id, nameAr: "الدور الأرضي", level: 0 } });
    const otherZone = await db.venueZone.create({ data: { venueId: ctx.mallB.id, nameAr: "دور في مول تاني" } });
    // A zone from another venue is refused.
    await expect(
      m.decideMembership({ venueId: ctx.mallA.id, membershipId: req.id, decision: "approve", userId: "x", zoneId: otherZone.id }),
    ).rejects.toMatchObject({ code: "zone-not-in-venue" });
    // Venue B cannot decide on venue A's membership.
    await expect(
      m.decideMembership({ venueId: ctx.mallB.id, membershipId: req.id, decision: "approve", userId: "x" }),
    ).rejects.toMatchObject({ code: "not-found" });

    await m.decideMembership({ venueId: ctx.mallA.id, membershipId: req.id, decision: "approve", userId: "x", zoneId: zone.id });
    const listed = (await pub.loadPublicVenue(ctx.mallA.slug))!.directory;
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ slug: cafe.business.slug, unit: "G-12", zone: { id: zone.id }, branch: { id: branch.id } });
    // Not in the other venue.
    expect((await pub.loadPublicVenue(ctx.mallB.slug))!.directory).toHaveLength(0);
    // Approving twice is refused.
    await expect(
      m.decideMembership({ venueId: ctx.mallA.id, membershipId: req.id, decision: "approve", userId: "x" }),
    ).rejects.toMatchObject({ code: "invalid-transition" });

    // The business page knows its venue.
    expect((await pub.venuesOfBusiness(cafe.business.id)).map((v) => v.venue.slug)).toEqual([ctx.mallA.slug]);

    // An unpublished business is not shown even though approved.
    await db.business.update({ where: { id: cafe.business.id }, data: { isPublished: false } });
    expect((await pub.loadPublicVenue(ctx.mallA.slug))!.directory).toHaveLength(0);
    await db.business.update({ where: { id: cafe.business.id }, data: { isPublished: true } });

    await m.decideMembership({ venueId: ctx.mallA.id, membershipId: req.id, decision: "remove", userId: "x" });
    expect((await pub.loadPublicVenue(ctx.mallA.slug))!.directory).toHaveLength(0);
    // After removal it may ask again.
    const again = await m.requestMembership({ businessId: cafe.business.id, userId: cafe.owner.id, venueId: ctx.mallA.id, branchId: branch.id, unit: null });
    expect(again.status).toBe("REQUESTED");
  });

  it("an owner can only use their own branches and withdraw their own requests", async () => {
    const a = await business("clinic", { branches: ["فرع"] });
    const b = await business("salon");
    await expect(
      m.requestMembership({ businessId: b.business.id, userId: b.owner.id, venueId: ctx.mallB.id, branchId: a.business.branches[0].id, unit: null }),
    ).rejects.toMatchObject({ code: "branch-not-yours" });
    const req = await m.requestMembership({ businessId: a.business.id, userId: a.owner.id, venueId: ctx.mallB.id, branchId: null, unit: null });
    await expect(m.withdrawMembership({ businessId: b.business.id, membershipId: req.id, userId: b.owner.id })).rejects.toMatchObject({ code: "not-found" });
    await m.withdrawMembership({ businessId: a.business.id, membershipId: req.id, userId: a.owner.id });
    expect((await db.venueMembership.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("REMOVED");
    // Both sides of tenancy are in the audit trail.
    const audit = await db.auditLog.findMany({ where: { actorId: a.owner.id, resourceType: "Venue" }, select: { action: true, actorRole: true } });
    expect(audit.map((x) => x.action).sort()).toEqual(["venue.membership.request", "venue.membership.withdraw"]);
    expect(audit.every((x) => x.actorRole === "BUSINESS_OWNER")).toBe(true);
  });

  it("a business with several branches must name the branch; whole-business and branch rows cannot overlap", async () => {
    const chain = await business("chain", { branches: ["فرع ١", "فرع ٢"] });
    await expect(
      m.requestMembership({ businessId: chain.business.id, userId: chain.owner.id, venueId: ctx.mallB.id, branchId: null, unit: null }),
    ).rejects.toMatchObject({ code: "pick-a-branch" });

    const one = await business("one-branch", { branches: ["الفرع"] });
    await m.requestMembership({ businessId: one.business.id, userId: one.owner.id, venueId: ctx.mallB.id, branchId: null, unit: null });
    await expect(
      m.requestMembership({ businessId: one.business.id, userId: one.owner.id, venueId: ctx.mallB.id, branchId: one.business.branches[0].id, unit: null }),
    ).rejects.toMatchObject({ code: "overlaps-existing" });
  });

  it("a rejected request cannot be re-sent for a week", async () => {
    const r = await business("rejected");
    const req = await m.requestMembership({ businessId: r.business.id, userId: r.owner.id, venueId: ctx.mallA.id, branchId: null, unit: null });
    await m.decideMembership({ venueId: ctx.mallA.id, membershipId: req.id, decision: "reject", userId: "x", note: "not here" });
    await expect(
      m.requestMembership({ businessId: r.business.id, userId: r.owner.id, venueId: ctx.mallA.id, branchId: null, unit: null }),
    ).rejects.toMatchObject({ code: "recently-rejected" });
  });

  it("a draft venue takes no requests", async () => {
    const city = await db.city.findFirstOrThrow();
    const d = await db.venue.create({ data: { slug: `${tag}-draft2`, nameAr: "مسودة ٢", cityId: city.id } });
    ids.venues.push(d.id);
    const x = await business("draft-try");
    await expect(
      m.requestMembership({ businessId: x.business.id, userId: x.owner.id, venueId: d.id, branchId: null, unit: null }),
    ).rejects.toMatchObject({ code: "venue-not-accepting" });
  });

  it("a single-location business listed by its branch counts its unbranched bookings", async () => {
    const solo = await business("solo-branch", { branches: ["الفرع الوحيد"] });
    const req = await m.requestMembership({ businessId: solo.business.id, userId: solo.owner.id, venueId: ctx.mallA.id, branchId: solo.business.branches[0].id, unit: null });
    await m.decideMembership({ venueId: ctx.mallA.id, membershipId: req.id, decision: "approve", userId: "x" });
    const before = (await metrics.venueMetrics(ctx.mallA.id)).bookings.total;
    expect((await createBooking({
      businessId: solo.business.id, serviceId: solo.service.id, customerId: null, customerName: "زبون", customerPhone: "01012345672",
      date, startTime: "13:00", status: "CONFIRMED", totalPrice: 100, currency: "EGP", depositAmount: null,
    })).ok).toBe(true);
    expect((await metrics.venueMetrics(ctx.mallA.id)).bookings.total).toBe(before + 1);
  });

  it("a suspended venue takes no requests", async () => {
    const s = await business("suspended-try");
    await db.venue.update({ where: { id: ctx.mallB.id }, data: { status: "SUSPENDED" } });
    await expect(
      m.requestMembership({ businessId: s.business.id, userId: s.owner.id, venueId: ctx.mallB.id, branchId: null, unit: null }),
    ).rejects.toMatchObject({ code: "venue-not-accepting" });
    await db.venue.update({ where: { id: ctx.mallB.id }, data: { status: "ACTIVE" } });
  });

  it("roles loaded from the database reach only their scope", async () => {
    const mgrA = await owner("mgr-a");
    const cmpAdmin = await owner("cmp-admin");
    await db.venueRole.createMany({
      data: [
        { userId: mgrA.id, kind: "VENUE_MANAGER", venueId: ctx.mallA.id },
        { userId: cmpAdmin.id, kind: "COMPOUND_ADMIN", compoundId: ctx.compound.id },
      ],
    });
    const rolesOf = async (userId: string) =>
      db.venueRole.findMany({ where: { userId }, select: { kind: true, organizationId: true, compoundId: true, venueId: true } });
    const a = { platform: false, roles: await rolesOf(mgrA.id) };
    const c = { platform: false, roles: await rolesOf(cmpAdmin.id) };
    expect(access.authorityOver(a, ctx.mallA)).toBe("VENUE_MANAGER");
    expect(access.authorityOver(a, ctx.mallB)).toBeNull();
    expect(access.authorityOver(c, ctx.mallA)).toBe("COMPOUND_ADMIN");
    expect(access.authorityOver(c, ctx.mallB)).toBeNull();
  });

  it("the database refuses a role with the wrong scope, and a gate with two owners", async () => {
    const u = await owner("bad-role");
    await expect(db.venueRole.create({ data: { userId: u.id, kind: "VENUE_MANAGER", compoundId: ctx.compound.id } })).rejects.toThrow();
    await expect(db.venueGate.create({ data: { nameAr: "بوابة", venueId: ctx.mallA.id, compoundId: ctx.compound.id } })).rejects.toThrow();
    await expect(db.venueGate.create({ data: { nameAr: "بوابة" } })).rejects.toThrow();
  });

  it("venue metrics are counts of approved tenants' real bookings, with no customer data", async () => {
    const mallABefore = (await metrics.venueMetrics(ctx.mallA.id)).bookings.total;
    const shop = await business("shop");
    // Business from before it joined the venue is not the venue's.
    expect((await createBooking({
      businessId: shop.business.id, serviceId: shop.service.id, customerId: null, customerName: "قبل", customerPhone: "01012345671",
      date, startTime: "09:00", status: "CONFIRMED", totalPrice: 100, currency: "EGP", depositAmount: null,
    })).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    const req = await m.requestMembership({ businessId: shop.business.id, userId: shop.owner.id, venueId: ctx.mallB.id, branchId: null, unit: null });
    await m.decideMembership({ venueId: ctx.mallB.id, membershipId: req.id, decision: "approve", userId: "x" });
    const base = {
      businessId: shop.business.id, serviceId: shop.service.id, customerId: null, customerName: "عميل سري", customerPhone: "01012345678",
      date, status: "CONFIRMED" as const, totalPrice: 100, currency: "EGP", depositAmount: null,
    };
    expect((await createBooking({ ...base, startTime: "10:00" })).ok).toBe(true);
    // A test booking exists only on a private page (Phase 21).
    await db.business.update({ where: { id: shop.business.id }, data: { isPublished: false } });
    expect((await createBooking({ ...base, startTime: "11:00", isTest: true })).ok).toBe(true);
    await db.business.update({ where: { id: shop.business.id }, data: { isPublished: true } });

    const k = await metrics.venueMetrics(ctx.mallB.id);
    expect(k.bookings.total).toBe(1);
    expect(k.tenants.approved).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(k)).not.toMatch(/عميل سري|01012345678|totalPrice|customer/);
    // Venue A never sees venue B's tenants' bookings.
    expect((await metrics.venueMetrics(ctx.mallA.id)).bookings.total).toBe(mallABefore);
  });

  it("a business in no venue books exactly as before", async () => {
    const solo = await business("solo");
    expect(await db.venueMembership.count({ where: { businessId: solo.business.id } })).toBe(0);
    const r = await createBooking({
      businessId: solo.business.id, serviceId: solo.service.id, customerId: null, customerName: "زبون", customerPhone: "01012345670",
      date, startTime: "12:00", status: "CONFIRMED", totalPrice: 100, currency: "EGP", depositAmount: null,
    });
    expect(r.ok).toBe(true);
    expect((await pub.venuesOfBusiness(solo.business.id))).toEqual([]);
  });

  it("the public page shows only allowed, active gates and never their codes", async () => {
    const g1 = await db.venueGate.create({ data: { nameAr: "بوابة ١", venueId: ctx.mallA.id, code: "SECRET-1" } });
    const g2 = await db.venueGate.create({ data: { nameAr: "بوابة الكمبوند", compoundId: ctx.compound.id, code: "SECRET-2" } });
    await db.venueGate.create({ data: { nameAr: "متوقفة", venueId: ctx.mallA.id, isActive: false } });
    let v = await pub.loadPublicVenue(ctx.mallA.slug);
    expect(v!.gates.map((g) => g.id).sort()).toEqual([g1.id, g2.id].sort());
    expect(JSON.stringify(v)).not.toMatch(/SECRET/);
    await db.venuePolicy.update({ where: { venueId: ctx.mallA.id }, data: { allowedGateIds: [g2.id] } });
    v = await pub.loadPublicVenue(ctx.mallA.slug);
    expect(v!.gates.map((g) => g.id)).toEqual([g2.id]);
    // The hierarchy is complete: country, city, compound.
    expect(v!.city.countryCode).toBe("EG");
    expect(v!.compound?.slug).toBe(ctx.compound.slug);
  });

  it("every existing city got a country, and no existing business was put in a venue", async () => {
    expect(await db.city.count({ where: { NOT: { countryCode: "EG" } } })).toBe(0);
    const outsideTest = await db.venueMembership.count({ where: { business: { slug: { not: { startsWith: "p22-" } } } } });
    expect(outsideTest).toBe(0);
  });
});
