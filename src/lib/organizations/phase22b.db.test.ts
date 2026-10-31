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
 * The organization platform on a real Postgres: registration review,
 * associations in both directions, email invites through onboarding's
 * transaction, directories, attribution, isolation and scale.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/organizations/phase22b.db.test.ts
 *
 * Everything it creates is tagged p22b- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("organization platform on a real database", () => {
  let db: PrismaClient;
  let assoc: typeof import("./associations");
  let pub: typeof import("./public");
  let access: typeof import("./access");
  let createBooking: typeof import("@/lib/bookings/create").createBooking;
  const tag = `p22b-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[], orgs: [] as string[] };
  const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

  async function user(n: string) {
    const u = await db.user.create({ data: { email: `${tag}-${n}@example.test`, name: `${tag} ${n}`, emailVerified: new Date() } });
    ids.users.push(u.id);
    return u;
  }

  async function business(n: string, opts: { branches?: string[]; published?: boolean } = {}) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await user(`owner-${n}`);
    const b = await db.business.create({
      data: {
        slug: `${tag}-${n}`, nameAr: `${tag} ${n}`, ownerId: owner.id, cityId: city.id, categoryId: category.id,
        isPublished: opts.published ?? true, minNoticeMinutes: 0,
        availability: { create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "09:00", closeTime: "17:00" })) },
        branches: { create: (opts.branches ?? []).map((name, i) => ({ nameAr: name, sortOrder: i })) },
      },
      include: { branches: true },
    });
    ids.businesses.push(b.id);
    const service = await db.service.create({ data: { businessId: b.id, nameAr: "خدمة", duration: 30, price: 100 } });
    return { business: b, owner, service };
  }

  async function organization(n: string, kind: "MALL" | "BUSINESS_GROUP" = "MALL") {
    const owner = await user(`org-owner-${n}`);
    const o = await db.organization.create({
      data: {
        slug: `${tag}-${n}`, nameAr: `جهة ${n}`, kind, status: "APPROVED", isPublished: true, createdById: owner.id,
        roles: { create: { userId: owner.id, kind: "ORGANIZATION_OWNER" } },
      },
    });
    ids.orgs.push(o.id);
    return { org: o, owner };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    assoc = await import("./associations");
    pub = await import("./public");
    access = await import("./access");
    ({ createBooking } = await import("@/lib/bookings/create"));
  });

  afterAll(async () => {
    if (!db) return;
    await db.auditLog.deleteMany({ where: { resourceType: "Organization", resourceId: { in: ids.orgs } } });
    await db.organization.deleteMany({ where: { id: { in: ids.orgs } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.lifecycleEvent.deleteMany({ where: { userId: { in: ids.users } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("B/C: restaurant and clinic groups register and list their brands, each brand keeping its own owner", async () => {
    const group = await organization("food-group", "BUSINESS_GROUP");
    const brand1 = await business("koshary");
    const brand2 = await business("grill");
    for (const b of [brand1, brand2]) {
      const inv = await assoc.inviteBusiness({
        organizationId: group.org.id, byUserId: group.owner.id, authority: "OWNER",
        businessSlug: b.business.slug, branchId: null, relation: "OWNED", note: null,
      });
      await assoc.respondAsBusiness({ businessId: b.business.id, userId: b.owner.id, associationId: inv.id, action: "accept" });
    }
    const page = await pub.loadPublicOrganization(group.org.slug);
    expect(page!.directory.map((d) => d.slug).sort()).toEqual([brand1.business.slug, brand2.business.slug].sort());
    // R: ownership untouched.
    expect((await db.business.findUniqueOrThrow({ where: { id: brand1.business.id } })).ownerId).toBe(brand1.owner.id);
  });

  it("F: an invitation can be declined, and a declined one is never listed", async () => {
    const mall = await organization("decline-mall");
    const b = await business("decliner");
    const inv = await assoc.inviteBusiness({ organizationId: mall.org.id, byUserId: mall.owner.id, authority: "OWNER", businessSlug: b.business.slug, branchId: null, relation: "HOSTED", note: null });
    await assoc.respondAsBusiness({ businessId: b.business.id, userId: b.owner.id, associationId: inv.id, action: "decline" });
    expect((await pub.loadPublicOrganization(mall.org.slug))!.directory).toHaveLength(0);
    // Declining is final for that row; accepting it afterwards is refused.
    await expect(
      assoc.respondAsBusiness({ businessId: b.business.id, userId: b.owner.id, associationId: inv.id, action: "accept" }),
    ).rejects.toMatchObject({ code: "invalid-transition" });
  });

  it("G: nobody can associate a business they do not own, approve their own request, or join an unreviewed organization", async () => {
    const mall = await organization("strict-mall");
    const mine = await business("mine");
    const theirs = await business("theirs");
    // A request from the wrong business id is simply for that business — the route layer
    // derives businessId from the session; here the library refuses cross-ownership branch use.
    await expect(
      assoc.requestToJoin({ businessId: mine.business.id, userId: mine.owner.id, organizationId: mall.org.id, branchId: (await db.branch.create({ data: { businessId: theirs.business.id, nameAr: "فرع غيره" } })).id }),
    ).rejects.toMatchObject({ code: "branch-not-yours" });
    const req = await assoc.requestToJoin({ businessId: mine.business.id, userId: mine.owner.id, organizationId: mall.org.id, branchId: null });
    // The business side cannot approve; only decline/leave transitions exist for it.
    await expect(
      assoc.respondAsBusiness({ businessId: mine.business.id, userId: mine.owner.id, associationId: req.id, action: "accept" }),
    ).rejects.toMatchObject({ code: "invalid-transition" });
    // A pending (unreviewed) organization takes no requests.
    const pendingOwner = await user("pending-owner");
    const pending = await db.organization.create({ data: { slug: `${tag}-pending`, nameAr: "قيد المراجعة", status: "PENDING", createdById: pendingOwner.id } });
    ids.orgs.push(pending.id);
    await expect(
      assoc.requestToJoin({ businessId: mine.business.id, userId: mine.owner.id, organizationId: pending.id, branchId: null }),
    ).rejects.toMatchObject({ code: "org-not-accepting" });
  });

  it("H/I: removal unlists without deleting, and overlapping tenants list under the right organizations", async () => {
    const a = await organization("mall-a");
    const bOrg = await organization("mall-b");
    const shared = await business("shared");
    const onlyA = await business("only-a");
    for (const [org, biz] of [[a, shared], [a, onlyA], [bOrg, shared]] as const) {
      const req = await assoc.requestToJoin({ businessId: biz.business.id, userId: biz.owner.id, organizationId: org.org.id, branchId: null });
      await assoc.decideAssociation({ organizationId: org.org.id, associationId: req.id, byUserId: org.owner.id, authority: "OWNER", action: "approve" });
    }
    expect((await pub.loadPublicOrganization(a.org.slug))!.directory.map((d) => d.slug).sort()).toEqual([onlyA.business.slug, shared.business.slug].sort());
    expect((await pub.loadPublicOrganization(bOrg.org.slug))!.directory.map((d) => d.slug)).toEqual([shared.business.slug]);

    // Remove "shared" from A: B keeps it; nothing of the business is deleted.
    const row = await db.organizationBusiness.findFirstOrThrow({ where: { organizationId: a.org.id, businessId: shared.business.id, status: "APPROVED" } });
    const before = await db.booking.count({ where: { businessId: shared.business.id } });
    await assoc.decideAssociation({ organizationId: a.org.id, associationId: row.id, byUserId: a.owner.id, authority: "OWNER", action: "remove" });
    expect((await pub.loadPublicOrganization(a.org.slug))!.directory.map((d) => d.slug)).toEqual([onlyA.business.slug]);
    expect((await pub.loadPublicOrganization(bOrg.org.slug))!.directory.map((d) => d.slug)).toEqual([shared.business.slug]);
    const after = await db.business.findUnique({ where: { id: shared.business.id }, include: { services: true } });
    expect(after).not.toBeNull();
    expect(after!.services).toHaveLength(1);
    expect(await db.booking.count({ where: { businessId: shared.business.id } })).toBe(before);
  });

  it("J: a brand with two branches sits in two organizations, each showing its own branch", async () => {
    const mallA = await organization("branch-mall-a");
    const mallB = await organization("branch-mall-b");
    const chain = await business("chain", { branches: ["فرع أ", "فرع ب"] });
    const [br1, br2] = chain.business.branches;
    for (const [org, branch] of [[mallA, br1], [mallB, br2]] as const) {
      const req = await assoc.requestToJoin({ businessId: chain.business.id, userId: chain.owner.id, organizationId: org.org.id, branchId: branch.id });
      await assoc.decideAssociation({ organizationId: org.org.id, associationId: req.id, byUserId: org.owner.id, authority: "OWNER", action: "approve" });
    }
    expect((await pub.loadPublicOrganization(mallA.org.slug))!.directory[0]).toMatchObject({ slug: chain.business.slug, branch: { id: br1.id } });
    expect((await pub.loadPublicOrganization(mallB.org.slug))!.directory[0]).toMatchObject({ slug: chain.business.slug, branch: { id: br2.id } });
    // Whole-business on top of a branch association is refused.
    await expect(
      assoc.requestToJoin({ businessId: chain.business.id, userId: chain.owner.id, organizationId: mallA.org.id, branchId: null }),
    ).rejects.toMatchObject({ code: "overlaps-existing" });
  });

  it("D: an email invite, accepted inside onboarding's transaction, links the new business APPROVED — and a dead invite rolls everything back", async () => {
    const mall = await organization("invite-mall");
    const invite = await assoc.createEmailInvite({ organizationId: mall.org.id, byUserId: mall.owner.id, authority: "OWNER", email: `${tag}-new@example.test`, relation: "OWNED" });
    const newOwner = await user("invited-owner");
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);

    const created = await db.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: { slug: `${tag}-invited`, nameAr: "نشاط مدعو", ownerId: newOwner.id, cityId: city.id, categoryId: category.id, isPublished: true },
      });
      await assoc.acceptEmailInvite(tx, invite.token, biz.id, newOwner.id);
      return biz;
    });
    ids.businesses.push(created.id);
    expect((await pub.loadPublicOrganization(mall.org.slug))!.directory.map((d) => d.slug)).toContain(created.slug);
    expect((await db.business.findUniqueOrThrow({ where: { id: created.id } })).ownerId).toBe(newOwner.id);

    // The same token a second time fails, and the whole creation rolls back with it.
    const secondOwner = await user("second-owner");
    await expect(
      db.$transaction(async (tx) => {
        const biz = await tx.business.create({
          data: { slug: `${tag}-invited-2`, nameAr: "تاني", ownerId: secondOwner.id, cityId: city.id, categoryId: category.id },
        });
        await assoc.acceptEmailInvite(tx, invite.token, biz.id, secondOwner.id);
      }),
    ).rejects.toMatchObject({ code: "invite-not-found" });
    expect(await db.business.findUnique({ where: { slug: `${tag}-invited-2` } })).toBeNull();
  });

  it("suspension stops acceptance too: invitations sent earlier can no longer be accepted or claimed", async () => {
    const mall = await organization("suspend-mall");
    const invited = await business("suspend-invited");
    const inv = await assoc.inviteBusiness({
      organizationId: mall.org.id, byUserId: mall.owner.id, authority: "OWNER",
      businessSlug: invited.business.slug, branchId: null, relation: "HOSTED", note: null,
    });
    const einv = await assoc.createEmailInvite({ organizationId: mall.org.id, byUserId: mall.owner.id, authority: "OWNER", email: `${tag}-late@example.test`, relation: "OWNED" });
    await db.organization.update({ where: { id: mall.org.id }, data: { status: "SUSPENDED", isPublished: false } });

    await expect(
      assoc.respondAsBusiness({ businessId: invited.business.id, userId: invited.owner.id, associationId: inv.id, action: "accept" }),
    ).rejects.toMatchObject({ code: "org-not-accepting" });
    await expect(assoc.readInvite(einv.token)).rejects.toMatchObject({ code: "org-not-accepting" });
    // The transactional claim refuses too, rolling the creation back with it.
    const lateOwner = await user("late-owner");
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    await expect(
      db.$transaction(async (tx) => {
        const biz = await tx.business.create({ data: { slug: `${tag}-late`, nameAr: "متأخر", ownerId: lateOwner.id, cityId: city.id, categoryId: category.id } });
        await assoc.acceptEmailInvite(tx, einv.token, biz.id, lateOwner.id);
      }),
    ).rejects.toMatchObject({ code: "org-not-accepting" });
    expect(await db.business.findUnique({ where: { slug: `${tag}-late` } })).toBeNull();
    // Declining and leaving still work while suspended.
    await assoc.respondAsBusiness({ businessId: invited.business.id, userId: invited.owner.id, associationId: inv.id, action: "decline" });
  });

  it("concurrent whole-business and branch attempts cannot both land (advisory lock)", async () => {
    const mall = await organization("race-mall");
    const chain = await business("race-chain", { branches: ["فرع"] });
    const branch = chain.business.branches[0];
    const results = await Promise.allSettled([
      assoc.requestToJoin({ businessId: chain.business.id, userId: chain.owner.id, organizationId: mall.org.id, branchId: null }),
      assoc.requestToJoin({ businessId: chain.business.id, userId: chain.owner.id, organizationId: mall.org.id, branchId: branch.id }),
    ]);
    const landed = results.filter((r) => r.status === "fulfilled").length;
    expect(landed).toBe(1);
    expect(await db.organizationBusiness.count({ where: { organizationId: mall.org.id, businessId: chain.business.id, status: { in: ["INVITED", "REQUESTED", "APPROVED"] } } })).toBe(1);
  });

  it("one role per person per scope is enforced by the database", async () => {
    const mall = await organization("role-mall");
    const manager = await user("dup-manager");
    await db.venueRole.create({ data: { userId: manager.id, kind: "ORGANIZATION_ADMIN", organizationId: mall.org.id } });
    await expect(
      db.venueRole.create({ data: { userId: manager.id, kind: "ORGANIZATION_ADMIN", organizationId: mall.org.id } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("O: a booking is attributed only to a published organization the business is approved in, never to others, and never twice", async () => {
    const mall = await organization("attr-mall");
    const rival = await organization("attr-rival");
    const shop = await business("attr-shop");
    const req = await assoc.requestToJoin({ businessId: shop.business.id, userId: shop.owner.id, organizationId: mall.org.id, branchId: null });
    await assoc.decideAssociation({ organizationId: mall.org.id, associationId: req.id, byUserId: mall.owner.id, authority: "OWNER", action: "approve" });

    const booked = await createBooking({
      businessId: shop.business.id, serviceId: shop.service.id, customerId: null, customerName: "زبون", customerPhone: "01012345674",
      date, startTime: "10:00", status: "CONFIRMED", totalPrice: 100, currency: "EGP", depositAmount: null,
    });
    expect(booked.ok).toBe(true);
    const bookingId = booked.ok ? booked.booking.id : "";
    // The organization it is approved in: attributed once, even if called twice.
    await pub.attributeBooking(bookingId, mall.org.slug, shop.business.id);
    await pub.attributeBooking(bookingId, mall.org.slug, shop.business.id);
    // An organization it is NOT in cannot claim it (the row already exists anyway).
    await pub.attributeBooking(bookingId, rival.org.slug, shop.business.id);
    const rows = await db.organizationBookingAttribution.findMany({ where: { bookingId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].organizationId).toBe(mall.org.id);
    // A second booking with a forged rival slug: no row at all.
    const booked2 = await createBooking({
      businessId: shop.business.id, serviceId: shop.service.id, customerId: null, customerName: "زبون", customerPhone: "01012345674",
      date, startTime: "11:00", status: "CONFIRMED", totalPrice: 100, currency: "EGP", depositAmount: null,
    });
    const booking2 = booked2.ok ? booked2.booking.id : "";
    await pub.attributeBooking(booking2, rival.org.slug, shop.business.id);
    expect(await db.organizationBookingAttribution.count({ where: { bookingId: booking2 } })).toBe(0);
    // The booking itself is untouched either way (owner, business, customer fields).
    const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.businessId).toBe(shop.business.id);

    // S: metrics are counts with no customer fields.
    const metrics = await pub.organizationMetrics(mall.org.id);
    expect(metrics.attributedBookings).toBe(1);
    expect(JSON.stringify(metrics)).not.toMatch(/زبون|010123456|customerPhone|totalPrice/);
  });

  it("audit D7: when a business is deleted, the attributed-bookings headline and its breakdown still agree", async () => {
    const mall = await organization("del-mall");
    const keep = await business("del-keep");
    const gone = await business("del-gone");
    for (const b of [keep, gone]) {
      const req = await assoc.requestToJoin({ businessId: b.business.id, userId: b.owner.id, organizationId: mall.org.id, branchId: null });
      await assoc.decideAssociation({ organizationId: mall.org.id, associationId: req.id, byUserId: mall.owner.id, authority: "OWNER", action: "approve" });
      const booked = await createBooking({
        businessId: b.business.id, serviceId: b.service.id, customerId: null, customerName: "زبون", customerPhone: "01012345675",
        date, startTime: "12:00", status: "CONFIRMED", totalPrice: 100, currency: "EGP", depositAmount: null,
      });
      if (booked.ok) await pub.attributeBooking(booked.booking.id, mall.org.slug, b.business.id);
    }
    expect((await pub.organizationMetrics(mall.org.id)).attributedBookings).toBe(2);
    // The business goes (its bookings cascade with it); its attribution row stays behind.
    await db.booking.deleteMany({ where: { businessId: gone.business.id } });
    await db.business.delete({ where: { id: gone.business.id } });
    const m = await pub.organizationMetrics(mall.org.id);
    expect(m.attributedBookings).toBe(1);
    expect(m.perBusiness.reduce((n, r) => n + r.count, 0)).toBe(m.attributedBookings);
  });

  it("audit D5: the public organization list carries no internal fields", async () => {
    const mall = await organization("shape-mall");
    const row = (await pub.listPublicOrganizations()).find((o) => o.slug === mall.org.slug);
    expect(row).toBeDefined();
    expect(Object.keys(row!)).not.toContain("_count");
  });

  it("Q/S: authority is per organization, and one organization's manager has none over another", async () => {
    const a = await organization("auth-a");
    const bOrg = await organization("auth-b");
    const manager = await user("manager-a");
    await db.venueRole.create({ data: { userId: manager.id, kind: "ORGANIZATION_ADMIN", organizationId: a.org.id } });
    const rolesOf = async (userId: string) =>
      db.venueRole.findMany({ where: { userId }, select: { kind: true, organizationId: true } });
    const caller = { platform: false, roles: await rolesOf(manager.id) };
    expect(access.orgAuthorityOver(caller, a.org.id)).toBe("MANAGER");
    expect(access.orgAuthorityOver(caller, bOrg.org.id)).toBeNull();
    expect(access.orgCan(access.orgAuthorityOver(caller, a.org.id), "org.publish")).toBe(false);
  });

  it("W/X: an empty organization loads, and one with 150 approved tenants loads and pages", async () => {
    const empty = await organization("empty");
    expect((await pub.loadPublicOrganization(empty.org.slug))!.directory).toEqual([]);
    // The sitemap includes only organizations with listings; its filter
    // is `businesses > 0` over this listing, so an empty one stays out.
    const listed = (await pub.listPublicOrganizations()).find((o) => o.slug === empty.org.slug);
    expect(listed?.businesses).toBe(0);

    const big = await organization("big", "BUSINESS_GROUP");
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await user("big-owner");
    const data = Array.from({ length: 150 }, (_, i) => ({
      slug: `${tag}-big-${i}`, nameAr: `فرع ${i}`, ownerId: owner.id, cityId: city.id, categoryId: category.id, isPublished: true,
    }));
    // One owner cannot own 150 businesses (ownerId is unique), so each
    // gets its own throwaway owner, created in bulk.
    const owners = await db.user.createManyAndReturn({
      data: Array.from({ length: 150 }, (_, i) => ({ email: `${tag}-big-${i}@example.test` })),
      select: { id: true },
    });
    ids.users.push(...owners.map((o) => o.id));
    const createdBiz = await db.business.createManyAndReturn({
      data: data.map((d, i) => ({ ...d, ownerId: owners[i].id })),
      select: { id: true },
    });
    ids.businesses.push(...createdBiz.map((b) => b.id));
    await db.organizationBusiness.createMany({
      data: createdBiz.map((b, i) => ({
        organizationId: big.org.id, businessId: b.id, status: "APPROVED", relation: "OWNED", initiatedById: big.owner.id, sortOrder: i,
      })),
    });
    const t0 = Date.now();
    const page = await pub.loadPublicOrganization(big.org.slug);
    const elapsed = Date.now() - t0;
    expect(page!.directory).toHaveLength(150);
    const paged = pub.pageDirectory(page!.directory, { page: 2 });
    expect(paged.pages).toBe(Math.ceil(150 / 24));
    expect(paged.entries[0].slug).toBe(`${tag}-big-24`);
    expect(elapsed).toBeLessThan(5000);
  });
});
