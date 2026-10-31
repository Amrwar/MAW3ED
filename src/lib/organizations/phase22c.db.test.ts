import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/api", () => ({
  err: (message: string, status = 400, extra?: Record<string, unknown>) => Response.json({ error: message, ...extra }, { status }),
  requireSession: async () => {
    throw new Error("no session in this test");
  },
  currentCaller: async () => null,
}));

/**
 * Phase 22 final — relationship types (OWNED / HOSTED / MANAGED),
 * delegated management, and the organization hierarchy, on a real
 * Postgres with the phase22c migrations applied:
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/organizations/phase22c.db.test.ts
 *
 * The numbers in the test names are the owner's required tests (1–26).
 * Everything created is tagged p22c- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("organization relationships and delegation on a real database", () => {
  let db: PrismaClient;
  let assoc: typeof import("./associations");
  let pub: typeof import("./public");
  let del: typeof import("./delegation");
  let ba: typeof import("@/lib/business-access");
  let createBooking: typeof import("@/lib/bookings/create").createBooking;
  const tag = `p22c-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[], orgs: [] as string[] };
  const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

  async function user(n: string) {
    const u = await db.user.create({ data: { email: `${tag}-${n}@example.test`, name: `${tag} ${n}`, emailVerified: new Date() } });
    ids.users.push(u.id);
    return u;
  }
  async function business(n: string, opts: { branches?: string[] } = {}) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await user(`owner-${n}`);
    const b = await db.business.create({
      data: {
        slug: `${tag}-${n}`, nameAr: `${tag} ${n}`, ownerId: owner.id, cityId: city.id, categoryId: category.id,
        isPublished: true, minNoticeMinutes: 0,
        availability: { create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "09:00", closeTime: "17:00" })) },
        branches: { create: (opts.branches ?? []).map((name, i) => ({ nameAr: name, sortOrder: i })) },
      },
      include: { branches: true },
    });
    ids.businesses.push(b.id);
    const service = await db.service.create({ data: { businessId: b.id, nameAr: "خدمة", duration: 30, price: 250 } });
    return { business: b, owner, service };
  }
  type Kind = "MALL" | "COMPOUND" | "BUSINESS_GROUP" | "RESTAURANT_GROUP" | "CLINIC_GROUP" | "FRANCHISE" | "COMMERCIAL_BUILDING" | "OTHER";
  async function organization(n: string, kind: Kind = "MALL") {
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
  async function manager(orgId: string, n: string) {
    const m = await user(`mgr-${n}`);
    await db.venueRole.create({ data: { userId: m.id, kind: "ORGANIZATION_ADMIN", organizationId: orgId } });
    return m;
  }
  /** Invite (org) → accept (business) with `grant`; returns the association id. */
  async function link(org: Awaited<ReturnType<typeof organization>>, biz: Awaited<ReturnType<typeof business>>, relation: "OWNED" | "HOSTED" | "MANAGED", grant: string[] = [], branchId: string | null = null, expiresAt: Date | null = null) {
    const inv = await assoc.inviteBusiness({
      organizationId: org.org.id, byUserId: org.owner.id, authority: "OWNER",
      businessSlug: biz.business.slug, branchId, relation, note: null, requestedScopes: grant,
    });
    await assoc.respondAsBusiness({ businessId: biz.business.id, userId: biz.owner.id, associationId: inv.id, action: "accept", scopes: grant, expiresAt });
    return inv.id;
  }
  const actorFor = (userId: string, delegation: NonNullable<Awaited<ReturnType<typeof del.resolveDelegation>>>) =>
    ({ role: "DELEGATE" as const, userId, staffMemberId: null, delegation });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    assoc = await import("./associations");
    pub = await import("./public");
    del = await import("./delegation");
    ba = await import("@/lib/business-access");
    ({ createBooking } = await import("@/lib/bookings/create"));
  });

  afterAll(async () => {
    if (!db) return;
    await db.auditLog.deleteMany({ where: { resourceType: "Organization", resourceId: { in: ids.orgs } } });
    await db.organization.updateMany({ where: { id: { in: ids.orgs } }, data: { parentId: null } });
    await db.organization.deleteMany({ where: { id: { in: ids.orgs } } });
    await db.payment.deleteMany({ where: { booking: { businessId: { in: ids.businesses } } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.lifecycleEvent.deleteMany({ where: { userId: { in: ids.users } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("1: every supported organization type can be created", async () => {
    for (const kind of ["MALL", "COMPOUND", "BUSINESS_GROUP", "RESTAURANT_GROUP", "CLINIC_GROUP", "FRANCHISE", "COMMERCIAL_BUILDING", "OTHER"] as const) {
      const o = await organization(`kind-${kind.toLowerCase()}`, kind);
      expect((await db.organization.findUniqueOrThrow({ where: { id: o.org.id } })).kind).toBe(kind);
    }
  });

  it("2/11: a parent company owns brands it may operate only as granted; each brand keeps its owner and independent control", async () => {
    const group = await organization("restaurants", "RESTAURANT_GROUP");
    const m = await manager(group.org.id, "restaurants");
    const brandA = await business("brand-a");
    const brandB = await business("brand-b");
    await link(group, brandA, "OWNED", ["RESERVATIONS", "SERVICES", "FINANCE"]);
    await link(group, brandB, "OWNED", []); // owned on paper, nothing granted

    const a = await del.resolveDelegation(m.id, brandA.business.id);
    expect(a?.scopes).toEqual(["RESERVATIONS", "SERVICES", "FINANCE"]);
    expect(a?.actions).toEqual(expect.arrayContaining(["bookings.read", "services.manage", "finance.read"]));
    // Ownership alone grants nothing.
    expect(await del.resolveDelegation(m.id, brandB.business.id)).toBeNull();
    // The brand's owner is still its owner, with every power.
    const own = await ba.resolveBusinessAccess(brandA.owner.id);
    expect(own?.actor.role).toBe("OWNER");
    expect(own?.business.id).toBe(brandA.business.id);
    expect((await db.business.findUniqueOrThrow({ where: { id: brandA.business.id } })).ownerId).toBe(brandA.owner.id);
  });

  it("3/8/9: a hosting mall lists independent businesses and can never reach their bookings, customers or money", async () => {
    const mall = await organization("eterna-like", "MALL");
    const mm = await manager(mall.org.id, "mall");
    const shop = await business("hosted-shop");
    // Asking a hosted business for access is refused outright…
    await expect(
      assoc.inviteBusiness({ organizationId: mall.org.id, byUserId: mall.owner.id, authority: "OWNER", businessSlug: shop.business.slug, branchId: null, relation: "HOSTED", note: null, requestedScopes: ["RESERVATIONS"] }),
    ).rejects.toMatchObject({ code: "scopes-not-allowed" });
    const assocId = await link(mall, shop, "HOSTED");
    // …and even the business cannot grant it one.
    await expect(
      assoc.respondAsBusiness({ businessId: shop.business.id, userId: shop.owner.id, associationId: assocId, action: "grant", scopes: ["FINANCE"] }),
    ).rejects.toMatchObject({ code: "scopes-not-allowed" });
    // The database refuses it too, whatever the code path.
    await expect(db.organizationBusiness.update({ where: { id: assocId }, data: { scopes: ["RESERVATIONS"] } })).rejects.toThrow();
    expect(await del.resolveDelegation(mall.owner.id, shop.business.id)).toBeNull();
    expect(await del.resolveDelegation(mm.id, shop.business.id)).toBeNull();
    // Listed in the mall's directory.
    expect((await pub.loadPublicOrganization(mall.org.slug))!.directory.map((d) => d.slug)).toContain(shop.business.slug);
  });

  it("4/22: management is delegated with scopes and expiry, and every kind of revocation ends it at once — all audited", async () => {
    const ops = await organization("ops-co", "BUSINESS_GROUP");
    const om = await manager(ops.org.id, "ops");
    const clinic = await business("managed-clinic");
    const later = new Date(Date.now() + 7 * 86_400_000);
    const assocId = await link(ops, clinic, "MANAGED", ["RESERVATIONS", "SCHEDULES"], null, later);
    expect((await del.resolveDelegation(om.id, clinic.business.id))?.scopes).toEqual(["RESERVATIONS", "SCHEDULES"]);

    // Narrowed.
    await assoc.respondAsBusiness({ businessId: clinic.business.id, userId: clinic.owner.id, associationId: assocId, action: "grant", scopes: ["RESERVATIONS"], expiresAt: later });
    expect((await del.resolveDelegation(om.id, clinic.business.id))?.scopes).toEqual(["RESERVATIONS"]);
    // Expired (evaluated at a later "now").
    expect(await del.resolveDelegation(om.id, clinic.business.id, new Date(later.getTime() + 1000))).toBeNull();
    // Paused by the business — and the organization cannot undo that pause.
    await assoc.respondAsBusiness({ businessId: clinic.business.id, userId: clinic.owner.id, associationId: assocId, action: "suspend" });
    expect(await del.resolveDelegation(om.id, clinic.business.id)).toBeNull();
    await expect(
      assoc.decideAssociation({ organizationId: ops.org.id, associationId: assocId, byUserId: ops.owner.id, authority: "OWNER", action: "resume" }),
    ).rejects.toMatchObject({ code: "not-yours-to-resume" });
    await assoc.respondAsBusiness({ businessId: clinic.business.id, userId: clinic.owner.id, associationId: assocId, action: "resume" });
    expect(await del.resolveDelegation(om.id, clinic.business.id)).not.toBeNull();
    // The organization suspended by the platform.
    await db.organization.update({ where: { id: ops.org.id }, data: { status: "SUSPENDED" } });
    expect(await del.resolveDelegation(om.id, clinic.business.id)).toBeNull();
    await db.organization.update({ where: { id: ops.org.id }, data: { status: "APPROVED" } });
    // The member removed from the organization.
    await db.venueRole.deleteMany({ where: { userId: om.id } });
    expect(await del.resolveDelegation(om.id, clinic.business.id)).toBeNull();
    // Everything withdrawn at once.
    await assoc.respondAsBusiness({ businessId: clinic.business.id, userId: clinic.owner.id, associationId: assocId, action: "grant", scopes: [] });
    expect(await del.resolveDelegation(ops.owner.id, clinic.business.id)).toBeNull();

    const actions = (await db.auditLog.findMany({ where: { resourceType: "Organization", resourceId: ops.org.id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["org.business.invite", "org.business.accept", "org.business.grant", "org.business.suspend", "org.business.resume"]));
  });

  it("5/13: one business owned by a group, hosted by a mall and managed by an operator — no duplicates, each relationship its own", async () => {
    const group = await organization("abc-group", "RESTAURANT_GROUP");
    const mall = await organization("abc-mall", "MALL");
    const ops = await organization("abc-ops", "BUSINESS_GROUP");
    const abc = await business("restaurant-abc");
    await link(group, abc, "OWNED", ["REPORTS", "FINANCE"]);
    await link(mall, abc, "HOSTED");
    await link(ops, abc, "MANAGED", ["RESERVATIONS"]);

    expect(await db.business.count({ where: { slug: abc.business.slug } })).toBe(1);
    expect(await db.organizationBusiness.count({ where: { businessId: abc.business.id, status: "APPROVED" } })).toBe(3);
    // Public directories: owned and hosted list it; a managing company's back office does not.
    expect((await pub.loadPublicOrganization(group.org.slug))!.directory.map((d) => d.slug)).toContain(abc.business.slug);
    expect((await pub.loadPublicOrganization(mall.org.slug))!.directory.map((d) => d.slug)).toContain(abc.business.slug);
    expect((await pub.loadPublicOrganization(ops.org.slug))!.directory).toEqual([]);
    // Each organization's people get exactly their own grant.
    expect((await del.resolveDelegation(group.owner.id, abc.business.id))?.scopes).toEqual(["REPORTS", "FINANCE"]);
    expect((await del.resolveDelegation(ops.owner.id, abc.business.id))?.scopes).toEqual(["RESERVATIONS"]);
    expect(await del.resolveDelegation(mall.owner.id, abc.business.id)).toBeNull();
    // A second owner is refused.
    const rival = await organization("abc-rival", "BUSINESS_GROUP");
    await expect(
      assoc.inviteBusiness({ organizationId: rival.org.id, byUserId: rival.owner.id, authority: "OWNER", businessSlug: abc.business.slug, branchId: null, relation: "OWNED", note: null }),
    ).rejects.toMatchObject({ code: "already-owned" });
  });

  it("one owner even under concurrency (advisory lock + unique index)", async () => {
    const x = await organization("race-x", "BUSINESS_GROUP");
    const y = await organization("race-y", "BUSINESS_GROUP");
    const target = await business("race-target");
    const tries = await Promise.allSettled(
      [x, y].map((o) => assoc.inviteBusiness({ organizationId: o.org.id, byUserId: o.owner.id, authority: "OWNER", businessSlug: target.business.slug, branchId: null, relation: "OWNED", note: null })),
    );
    expect(tries.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.organizationBusiness.count({ where: { businessId: target.business.id, relation: "OWNED" } })).toBe(1);
  });

  it("6/12: branch-limited management sees only its branch, and removal keeps every record", async () => {
    const ops = await organization("branch-ops", "BUSINESS_GROUP");
    const chain = await business("two-branch", { branches: ["فرع أ", "فرع ب"] });
    const [br1, br2] = chain.business.branches;
    // A branch-limited grant can only be reservations.
    await expect(
      assoc.requestToJoin({ businessId: chain.business.id, userId: chain.owner.id, organizationId: ops.org.id, branchId: br1.id, relation: "MANAGED", scopes: ["CUSTOMERS"] }),
    ).rejects.toMatchObject({ code: "scopes-not-allowed" });
    const req = await assoc.requestToJoin({ businessId: chain.business.id, userId: chain.owner.id, organizationId: ops.org.id, branchId: br1.id, relation: "MANAGED", scopes: ["RESERVATIONS"] });
    await assoc.decideAssociation({ organizationId: ops.org.id, associationId: req.id, byUserId: ops.owner.id, authority: "OWNER", action: "approve" });

    for (const [branchId, startTime] of [[br1.id, "10:00"], [br2.id, "11:00"]] as const) {
      const r = await createBooking({
        businessId: chain.business.id, serviceId: chain.service.id, customerId: null, customerName: "زبون فرع", customerPhone: "01012345680",
        date, startTime, status: "CONFIRMED", totalPrice: 250, currency: "EGP", depositAmount: null, branchId,
      } as Parameters<typeof createBooking>[0]);
      expect(r.ok).toBe(true);
    }
    const d = await del.resolveDelegation(ops.owner.id, chain.business.id);
    expect(d?.branchIds).toEqual([br1.id]);
    const scoped = ba.bookingScope(chain.business, actorFor(ops.owner.id, d!));
    const visible = await db.booking.findMany({ where: scoped, select: { branchId: true } });
    expect(visible.length).toBe(1);
    expect(visible[0].branchId).toBe(br1.id);

    const before = await db.booking.count({ where: { businessId: chain.business.id } });
    await assoc.decideAssociation({ organizationId: ops.org.id, associationId: req.id, byUserId: ops.owner.id, authority: "OWNER", action: "remove" });
    expect(await db.booking.count({ where: { businessId: chain.business.id } })).toBe(before);
    expect(await db.business.findUnique({ where: { id: chain.business.id } })).not.toBeNull();
    expect(await del.resolveDelegation(ops.owner.id, chain.business.id)).toBeNull();
  });

  it("7/10: no unauthorized membership and no escalation — finance only to owners, never sign-in access, never another organization's grant", async () => {
    const ops = await organization("esc-ops", "BUSINESS_GROUP");
    const om = await manager(ops.org.id, "esc");
    const shop = await business("esc-shop");
    // A managing company cannot be given money.
    await expect(
      assoc.inviteBusiness({ organizationId: ops.org.id, byUserId: ops.owner.id, authority: "OWNER", businessSlug: shop.business.slug, branchId: null, relation: "MANAGED", note: null, requestedScopes: ["FINANCE"] }),
    ).rejects.toMatchObject({ code: "scopes-not-allowed" });
    const assocId = await link(ops, shop, "MANAGED", ["RESERVATIONS", "STAFF", "SERVICES", "SCHEDULES", "PROFILE", "REPORTS", "CUSTOMERS"]);
    await expect(db.organizationBusiness.update({ where: { id: assocId }, data: { scopes: { push: "FINANCE" } } })).rejects.toThrow();
    // Everything granted, still no owner powers.
    const d = await del.resolveDelegation(om.id, shop.business.id);
    const actor = actorFor(om.id, d!);
    for (const ownerOnly of ["staff.manageAccess", "finance.read"] as const) expect(ba.can(actor, ownerOnly)).toBe(false);
    // A legacy label cannot sneak in a relationship type.
    await expect(
      assoc.inviteBusiness({ organizationId: ops.org.id, byUserId: ops.owner.id, authority: "OWNER", businessSlug: shop.business.slug, branchId: null, relation: "TENANT", note: null }),
    ).rejects.toMatchObject({ code: "relation-not-allowed" });
    // A stranger, or another organization's manager, gets nothing.
    const stranger = await user("stranger");
    expect(await del.resolveDelegation(stranger.id, shop.business.id)).toBeNull();
    const other = await organization("esc-other", "BUSINESS_GROUP");
    const otherMgr = await manager(other.org.id, "other");
    expect(await del.resolveDelegation(otherMgr.id, shop.business.id)).toBeNull();
    // The organization cannot grant itself scopes: only the business's own
    // association row can be changed through respondAsBusiness, by its owner.
    await expect(
      assoc.respondAsBusiness({ businessId: other.org.id, userId: ops.owner.id, associationId: assocId, action: "grant", scopes: ["RESERVATIONS"] }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("23/25: the hierarchy refuses cycles and a fourth level, and the public page shows one level each way", async () => {
    const holding = await organization("holding", "BUSINESS_GROUP");
    const sameOwner = holding.owner;
    // Organizations owned by the same person, so linking is permitted.
    const mk = async (n: string) => {
      const o = await db.organization.create({
        data: { slug: `${tag}-${n}`, nameAr: n, kind: "MALL", status: "APPROVED", isPublished: true, roles: { create: { userId: sameOwner.id, kind: "ORGANIZATION_OWNER" } } },
      });
      ids.orgs.push(o.id);
      return o;
    };
    const mall = await mk("h-mall");
    const wing = await mk("h-wing");
    const kiosk = await mk("h-kiosk");
    const set = (child: string, parent: string | null) =>
      assoc.setParentOrganization({ childId: child, parentId: parent, byUserId: sameOwner.id, childAuthority: "OWNER", parentAuthority: parent ? "OWNER" : null });

    await set(mall.id, holding.org.id);
    await set(wing.id, mall.id);
    await expect(set(holding.org.id, wing.id)).rejects.toMatchObject({ code: "hierarchy-invalid" }); // cycle
    await expect(set(kiosk.id, wing.id)).rejects.toMatchObject({ code: "hierarchy-invalid" }); // 4th level
    await expect(set(mall.id, mall.id)).rejects.toMatchObject({ code: "hierarchy-invalid" }); // self
    // Not owning the parent: refused, saying nothing.
    const foreign = await organization("h-foreign", "BUSINESS_GROUP");
    await expect(
      assoc.setParentOrganization({ childId: kiosk.id, parentId: foreign.org.id, byUserId: sameOwner.id, childAuthority: "OWNER", parentAuthority: null }),
    ).rejects.toMatchObject({ code: "not-found" });

    const page = await pub.loadPublicOrganization(mall.slug);
    expect(page!.parent?.slug).toBe(holding.org.slug);
    expect(page!.children.map((c) => c.slug)).toEqual([wing.slug]);
    // The holding's page shows its child, not its grandchild.
    const top = await pub.loadPublicOrganization(holding.org.slug);
    expect(top!.children.map((c) => c.slug)).toEqual([mall.slug]);
    expect(JSON.stringify(top)).not.toContain(wing.slug);
  });

  it("24: a large portfolio pages safely in the console", async () => {
    const big = await organization("portfolio", "RESTAURANT_GROUP");
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owners = await db.user.createManyAndReturn({ data: Array.from({ length: 120 }, (_, i) => ({ email: `${tag}-pf-${i}@example.test` })), select: { id: true } });
    ids.users.push(...owners.map((o) => o.id));
    const bizs = await db.business.createManyAndReturn({
      data: owners.map((o, i) => ({ slug: `${tag}-pf-${i}`, nameAr: `فرع ${i}`, ownerId: o.id, cityId: city.id, categoryId: category.id, isPublished: true })),
      select: { id: true },
    });
    ids.businesses.push(...bizs.map((b) => b.id));
    await db.organizationBusiness.createMany({
      data: bizs.map((b) => ({ organizationId: big.org.id, businessId: b.id, relation: "HOSTED" as const, status: "APPROVED" as const, initiatedById: big.owner.id })),
    });
    const p1 = await assoc.listAssociations(big.org.id, 1);
    const p3 = await assoc.listAssociations(big.org.id, 3);
    expect(p1).toMatchObject({ total: 120, approved: 120, pages: 3, page: 1 });
    expect(p1.associations).toHaveLength(50);
    expect(p3.associations).toHaveLength(20);
    expect((await assoc.listAssociations(big.org.id, 99)).page).toBe(3);
    const seen = new Set([...p1.associations, ...(await assoc.listAssociations(big.org.id, 2)).associations, ...p3.associations].map((a) => a.id));
    expect(seen.size).toBe(120);
  });

  it("email invites carry their relationship and grant exactly what the new owner was shown", async () => {
    const group = await organization("invite-clinics", "CLINIC_GROUP");
    const invite = await assoc.createEmailInvite({ organizationId: group.org.id, byUserId: group.owner.id, authority: "OWNER", email: `${tag}-new@example.test`, relation: "OWNED", requestedScopes: ["RESERVATIONS", "REPORTS"] });
    const read = await assoc.readInvite(invite.token);
    expect(read.relation).toBe("OWNED");
    expect(read.requestedScopes).toEqual(["RESERVATIONS", "REPORTS"]);
    const newOwner = await user("invited-owner");
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const created = await db.$transaction(async (tx) => {
      const biz = await tx.business.create({ data: { slug: `${tag}-invited`, nameAr: "عيادة جديدة", ownerId: newOwner.id, cityId: city.id, categoryId: category.id, isPublished: true } });
      await assoc.acceptEmailInvite(tx, invite.token, biz.id, newOwner.id);
      return biz;
    });
    ids.businesses.push(created.id);
    expect((await del.resolveDelegation(group.owner.id, created.id))?.scopes).toEqual(["RESERVATIONS", "REPORTS"]);
    await expect(
      assoc.createEmailInvite({ organizationId: group.org.id, byUserId: group.owner.id, authority: "OWNER", email: "x@example.test", relation: "HOSTED", requestedScopes: ["RESERVATIONS"] }),
    ).rejects.toMatchObject({ code: "scopes-not-allowed" });
  });
});
