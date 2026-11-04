import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { BookingStatus, PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/api", () => ({
  err: (message: string, status = 400, extra?: Record<string, unknown>) => Response.json({ error: message, ...extra }, { status }),
  requireSession: async () => {
    throw new Error("no session in this test");
  },
  currentCaller: async () => null,
}));

/**
 * Phase 24 — a group's report across the businesses it owns or manages
 * (lib/organizations/portfolio.ts), on a real Postgres:
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/organizations/phase24.db.test.ts
 *
 * Everything created is tagged p24- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("organization portfolio report on a real database", () => {
  let db: PrismaClient;
  let assoc: typeof import("./associations");
  let portfolio: typeof import("./portfolio");
  const tag = `p24-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[], orgs: [] as string[] };
  // Cairo's calendar day, as the report reads it — the UTC date is
  // already tomorrow's (or still yesterday's) for part of every day.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

  async function user(n: string) {
    const u = await db.user.create({ data: { email: `${tag}-${n}@example.test`, name: `${tag} ${n}`, emailVerified: new Date() } });
    ids.users.push(u.id);
    return u;
  }
  async function business(n: string, branches: string[] = []) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await user(`owner-${n}`);
    const b = await db.business.create({
      data: {
        slug: `${tag}-${n}`, nameAr: `${tag} ${n}`, nameEn: `Biz ${n}`, ownerId: owner.id, cityId: city.id, categoryId: category.id, isPublished: true,
        branches: { create: branches.map((name, i) => ({ nameAr: name, sortOrder: i })) },
      },
      include: { branches: true },
    });
    ids.businesses.push(b.id);
    const service = await db.service.create({ data: { businessId: b.id, nameAr: "خدمة", duration: 30, price: 100 } });
    return { business: b, owner, service };
  }
  async function organization(n: string) {
    const owner = await user(`org-${n}`);
    const o = await db.organization.create({
      data: {
        slug: `${tag}-${n}`, nameAr: `جهة ${n}`, kind: "RESTAURANT_GROUP", status: "APPROVED", isPublished: true, createdById: owner.id,
        roles: { create: { userId: owner.id, kind: "ORGANIZATION_OWNER" } },
      },
    });
    ids.orgs.push(o.id);
    return { org: o, owner };
  }
  async function link(o: Awaited<ReturnType<typeof organization>>, b: Awaited<ReturnType<typeof business>>, relation: "OWNED" | "HOSTED" | "MANAGED", grant: string[], branchId: string | null = null) {
    const inv = await assoc.inviteBusiness({
      organizationId: o.org.id, byUserId: o.owner.id, authority: "OWNER",
      businessSlug: b.business.slug, branchId, relation, note: null, requestedScopes: grant,
    });
    await assoc.respondAsBusiness({ businessId: b.business.id, userId: b.owner.id, associationId: inv.id, action: "accept", scopes: grant, expiresAt: null });
    return inv.id;
  }
  let n = 0;
  /** [status, price, branchId?, isTest?, daysFromToday?] — days default to 2 days ago (inside the window, already past). */
  async function bookings(b: Awaited<ReturnType<typeof business>>, list: [BookingStatus, number, (string | null)?, boolean?, number?][]) {
    for (const [status, price, branchId = null, isTest = false, days = -2] of list) {
      n += 1;
      const hh = String(8 + (n % 12)).padStart(2, "0");
      const day = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
      await db.booking.create({
        data: {
          businessId: b.business.id, serviceId: b.service.id, branchId, customerName: "عميل سري", customerPhone: "01099990000",
          date: new Date(`${day}T00:00:00Z`), startTime: `${hh}:00`, endTime: `${hh}:30`,
          startsAt: new Date(`${day}T${hh}:00:00Z`), endsAt: new Date(`${day}T${hh}:30:00Z`),
          status, totalPrice: price, isTest, accessToken: randomBytes(24).toString("base64url"),
        },
      });
    }
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    assoc = await import("./associations");
    portfolio = await import("./portfolio");
  });

  afterAll(async () => {
    if (!db) return;
    await db.auditLog.deleteMany({ where: { resourceType: "Organization", resourceId: { in: ids.orgs } } });
    await db.organization.deleteMany({ where: { id: { in: ids.orgs } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("shows only what each business shares: counts with REPORTS, money with FINANCE, a name otherwise", async () => {
    const group = await organization("grp");
    const grill = await business("grill");
    const cafe = await business("cafe");
    const sushi = await business("sushi");
    const tenant = await business("tenant");
    await link(group, grill, "OWNED", ["RESERVATIONS", "REPORTS", "FINANCE"]);
    await link(group, cafe, "OWNED", ["RESERVATIONS", "REPORTS"]);
    await link(group, sushi, "OWNED", ["RESERVATIONS"]);
    await link(group, tenant, "HOSTED", []);
    // Grill: a test booking and an abandoned checkout count nowhere; a
    // confirmed booking tomorrow is upcoming and outside the window's totals.
    await bookings(grill, [["COMPLETED", 300], ["COMPLETED", 200], ["NO_SHOW", 150], ["CANCELLED", 999], ["COMPLETED", 5000, null, true], ["PENDING_PAYMENT", 400], ["FAILED_PAYMENT", 400], ["CONFIRMED", 100, null, false, 1]]);
    await bookings(cafe, [["COMPLETED", 80], ["PENDING", 60, null, false, 3]]);
    await bookings(sushi, [["COMPLETED", 700]]);
    await bookings(tenant, [["COMPLETED", 900]]);

    const r = await portfolio.organizationPortfolio(group.org.id, 30);
    const row = (slug: string) => r.rows.find((x) => x.business.slug === slug);
    // As the business's own report counts (lib/dashboard/stats tally).
    expect(row(grill.business.slug)?.figures).toEqual({ bookings: 4, upcoming: 1, completed: 2, noShows: 1, cancelled: 1, revenue: 500 });
    expect(row(cafe.business.slug)?.figures).toEqual({ bookings: 1, upcoming: 1, completed: 1, noShows: 0, cancelled: 0, revenue: null });
    expect(row(sushi.business.slug)).toMatchObject({ figures: null, notShared: "not-granted" });
    // Hosting is a listing, never a reporting line.
    expect(row(tenant.business.slug)).toBeUndefined();
    expect(r.totals).toMatchObject({ bookings: 5, upcoming: 2, completed: 3, noShows: 1, cancelled: 1, revenue: 500, sharing: 2, withFinance: 1 });
    expect(r).toMatchObject({ active: true, truncated: false });
    // Nothing that identifies a customer or a single booking.
    expect(JSON.stringify(r)).not.toMatch(/عميل سري|0109999|customer|accessToken/);
  });

  it("withdrawing the grant hides the figures at once; a suspended organization sees none", async () => {
    const group = await organization("rev");
    const b = await business("rev-b");
    const id = await link(group, b, "MANAGED", ["REPORTS"]);
    await bookings(b, [["COMPLETED", 100]]);
    expect((await portfolio.organizationPortfolio(group.org.id)).rows[0].figures?.completed).toBe(1);
    await db.organizationBusiness.update({ where: { id }, data: { scopes: [] } });
    expect((await portfolio.organizationPortfolio(group.org.id)).rows[0].figures).toBeNull();
    await db.organizationBusiness.update({ where: { id }, data: { scopes: ["REPORTS"] } });
    await db.organization.update({ where: { id: group.org.id }, data: { status: "SUSPENDED" } });
    // Suspended: not even who granted what.
    const s = await portfolio.organizationPortfolio(group.org.id);
    expect(s).toMatchObject({ active: false, rows: [], totals: { sharing: 0 } });
  });

  it("a paused or expired relationship is not reported", async () => {
    const group = await organization("exp");
    const a = await business("exp-a");
    const c = await business("exp-c");
    const ida = await link(group, a, "MANAGED", ["REPORTS"]);
    const idc = await link(group, c, "MANAGED", ["REPORTS"]);
    await db.organizationBusiness.update({ where: { id: ida }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
    await db.organizationBusiness.update({ where: { id: idc }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await portfolio.organizationPortfolio(group.org.id)).rows).toEqual([]);
  });

  it("a branch-limited relationship says why it shows nothing; a business under two relationships is one row, counted once", async () => {
    const group = await organization("br");
    const clinic = await business("clinic", ["فرع أ", "فرع ب"]);
    const [a, bb] = clinic.business.branches;
    await link(group, clinic, "OWNED", ["RESERVATIONS"], a.id);
    await bookings(clinic, [["COMPLETED", 100, a.id], ["COMPLETED", 100, bb.id], ["NO_SHOW", 100, bb.id]]);
    let r = await portfolio.organizationPortfolio(group.org.id);
    expect(r.rows[0]).toMatchObject({ figures: null, notShared: "branch-only" });
    // Reports are business-wide, so a branch relationship cannot even ask for them.
    await expect(link(group, clinic, "OWNED", ["REPORTS"], bb.id)).rejects.toThrow("scopes-not-allowed");
    await link(group, clinic, "MANAGED", ["REPORTS"]);
    // …and a second owner is refused, whatever it asks for.
    const other = await organization("br2");
    await expect(link(other, clinic, "OWNED", ["REPORTS"])).rejects.toThrow("already-owned");
    r = await portfolio.organizationPortfolio(group.org.id);
    // One row for the business, both relationships named; counted once.
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].relations).toHaveLength(2);
    expect(r.rows[0].figures).toMatchObject({ bookings: 3, completed: 2, noShows: 1 });
    expect(r.totals).toMatchObject({ bookings: 3, completed: 2, noShows: 1, sharing: 1 });
  });

  // ── Post-phase audit (2026-11-03) ─────────────────────────────────────

  it("audit: the database itself refuses RESOURCES on a branch relationship and on a hosted one", async () => {
    const group = await organization("db-chk");
    const clinic = await business("db-chk-b", ["فرع"]);
    const branchId = clinic.business.branches[0].id;
    const row = (data: Record<string, unknown>) =>
      db.organizationBusiness.create({ data: { organizationId: group.org.id, businessId: clinic.business.id, status: "APPROVED", initiatedById: group.owner.id, ...data } as never });
    await expect(row({ relation: "OWNED", branchId, scopes: ["RESOURCES"] })).rejects.toThrow(/branch_scopes_chk|check constraint/i);
    await expect(row({ relation: "HOSTED", scopes: ["RESOURCES"] })).rejects.toThrow(/hosted_no_scopes_chk|check constraint/i);
  });

  it("audit: the migration can run twice; RESOURCES sits after STAFF", async () => {
    const sql = (await import("fs")).readFileSync("prisma/migrations/phase24_resources_scope.sql", "utf8");
    await db.$executeRawUnsafe(sql);
    await db.$executeRawUnsafe(sql);
    const labels = await db.$queryRaw<{ enumlabel: string }[]>`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'DelegationScope' ORDER BY e.enumsortorder`;
    const list = labels.map((l) => l.enumlabel);
    expect(list.filter((l) => l === "RESOURCES")).toHaveLength(1);
    expect(list.indexOf("RESOURCES")).toBe(list.indexOf("STAFF") + 1);
  });

  it("audit: tables open to a delegate only with RESOURCES, and close on the next lookup when withdrawn", async () => {
    const del = await import("./delegation");
    const group = await organization("res");
    const mgr = await user("res-mgr");
    await db.venueRole.create({ data: { userId: mgr.id, kind: "ORGANIZATION_ADMIN", organizationId: group.org.id } });
    const b = await business("res-b");
    const id = await link(group, b, "MANAGED", ["RESERVATIONS"]);
    expect((await del.resolveDelegation(mgr.id, b.business.id, new Date()))?.actions).not.toContain("resources.manage");
    await db.organizationBusiness.update({ where: { id }, data: { scopes: ["RESERVATIONS", "RESOURCES"] } });
    expect((await del.resolveDelegation(mgr.id, b.business.id, new Date()))?.actions).toEqual(expect.arrayContaining(["resources.read", "resources.manage"]));
    await db.organizationBusiness.update({ where: { id }, data: { scopes: ["RESERVATIONS"] } });
    expect((await del.resolveDelegation(mgr.id, b.business.id, new Date()))?.actions).not.toContain("resources.read");
  });

  it("audit: a portfolio past its row limit says so, and its totals cover what it lists", async () => {
    const group = await organization("cap");
    for (const k of [1, 2, 3]) {
      const b = await business(`cap-${k}`);
      await link(group, b, "MANAGED", ["REPORTS"]);
      await bookings(b, [["COMPLETED", 100]]);
    }
    const r = await portfolio.organizationPortfolio(group.org.id, 30, new Date(), 2);
    expect(r).toMatchObject({ truncated: true, totals: { completed: 2, sharing: 2 } });
    expect(r.rows).toHaveLength(2);
    expect((await portfolio.organizationPortfolio(group.org.id, 30, new Date(), 3)).truncated).toBe(false);
  });

  it("audit (review 2): the row limit counts businesses, so a listed business keeps the relationship that shares", async () => {
    const group = await organization("cap2");
    const a = await business("cap2-a");
    const b = await business("cap2-b");
    await link(group, a, "OWNED", ["RESERVATIONS"]);
    await link(group, b, "MANAGED", ["REPORTS"]);
    // a's second relationship is created last: past the limit if the cut were by relationship.
    await link(group, a, "MANAGED", ["REPORTS"]);
    const r = await portfolio.organizationPortfolio(group.org.id, 30, new Date(), 2);
    expect(r.truncated).toBe(false);
    const rowA = r.rows.find((x) => x.business.id === a.business.id);
    expect(rowA?.relations).toHaveLength(2);
    expect(rowA?.notShared).toBeNull();
  });

  it("audit (review 2): a live booking without startsAt counts as upcoming by its date, as the business report reads it", async () => {
    const group = await organization("nost");
    const b = await business("nost-b");
    await link(group, b, "MANAGED", ["REPORTS"]);
    const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await db.booking.create({
      data: {
        businessId: b.business.id, serviceId: b.service.id, customerName: "قديم", customerPhone: "01099990001",
        date: new Date(`${day}T00:00:00Z`), startTime: "10:00", status: "CONFIRMED", totalPrice: 100,
        accessToken: randomBytes(24).toString("base64url"),
      },
    });
    expect((await portfolio.organizationPortfolio(group.org.id)).rows[0].figures?.upcoming).toBe(1);
  });
});
