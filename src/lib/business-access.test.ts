import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who acts for which business, and what they may do. The database is a
 * small in-memory stand-in: two businesses, their owners, and staff.
 */

type Staff = {
  id: string;
  businessId: string;
  isActive: boolean;
  access: "MANAGER" | "PROVIDER" | null;
  loginPhone: string | null;
  userId: string | null;
};

const businesses = [
  { id: "biz-a", ownerId: "owner-a", nameAr: "أ" },
  { id: "biz-b", ownerId: "owner-b", nameAr: "ب" },
];
let staff: Staff[] = [];
let users: Record<string, { phone: string | null; phoneVerifiedAt: Date | null }> = {};

vi.mock("@/lib/db", () => {
  const withBusiness = (s: Staff | undefined) => (s ? { ...s, business: businesses.find((b) => b.id === s.businessId)! } : null);
  return {
    db: {
      business: { findUnique: async ({ where }: { where: { ownerId: string } }) => businesses.find((b) => b.ownerId === where.ownerId) ?? null },
      user: { findUnique: async ({ where }: { where: { id: string } }) => users[where.id] ?? null },
      staffMember: {
        findUnique: async ({ where }: { where: { userId?: string; loginPhone?: string } }) =>
          withBusiness(staff.find((s) => (where.userId ? s.userId === where.userId : s.loginPhone === where.loginPhone))),
        updateMany: async ({ where, data }: { where: { id: string; userId: null }; data: { userId: string } }) => {
          const row = staff.find((s) => s.id === where.id && s.userId === null);
          if (!row) return { count: 0 };
          row.userId = data.userId;
          return { count: 1 };
        },
      },
    },
  };
});
vi.mock("@/lib/api", () => ({ err: () => new Response(), requireSession: async () => ({ user: { id: "" } }) }));

import { bookingScope, can, permissionsOf, resolveBusinessAccess } from "./business-access";

beforeEach(() => {
  staff = [
    { id: "st-manager", businessId: "biz-a", isActive: true, access: "MANAGER", loginPhone: "201000000001", userId: "u-manager" },
    { id: "st-provider", businessId: "biz-a", isActive: true, access: "PROVIDER", loginPhone: "201000000002", userId: "u-provider" },
    { id: "st-waiting", businessId: "biz-a", isActive: true, access: "PROVIDER", loginPhone: "201000000003", userId: null },
    { id: "st-gone", businessId: "biz-a", isActive: false, access: "MANAGER", loginPhone: "201000000004", userId: "u-gone" },
    { id: "st-revoked", businessId: "biz-a", isActive: true, access: null, loginPhone: null, userId: "u-revoked" },
  ];
  users = {
    "u-new": { phone: "201000000003", phoneVerifiedAt: new Date() },
    "u-unverified": { phone: "201000000003", phoneVerifiedAt: null },
    "u-stranger": { phone: "201099999999", phoneVerifiedAt: new Date() },
  };
});

describe("who acts for a business", () => {
  it("an owner is the owner of their own business, and only that one", async () => {
    const a = await resolveBusinessAccess("owner-a");
    expect(a?.business.id).toBe("biz-a");
    expect(a?.actor.role).toBe("OWNER");
    expect((await resolveBusinessAccess("owner-b"))?.business.id).toBe("biz-b");
  });

  it("a linked manager and provider get their business and their role", async () => {
    expect((await resolveBusinessAccess("u-manager"))?.actor).toMatchObject({ role: "MANAGER", staffMemberId: "st-manager" });
    expect((await resolveBusinessAccess("u-provider"))?.actor).toMatchObject({ role: "PROVIDER", staffMemberId: "st-provider" });
  });

  it("a verified phone claims the staff place waiting for it, once", async () => {
    const first = await resolveBusinessAccess("u-new");
    expect(first?.actor).toMatchObject({ role: "PROVIDER", staffMemberId: "st-waiting" });
    expect(staff.find((s) => s.id === "st-waiting")?.userId).toBe("u-new");
  });

  it("an unverified phone claims nothing", async () => {
    expect(await resolveBusinessAccess("u-unverified")).toBeNull();
    expect(staff.find((s) => s.id === "st-waiting")?.userId).toBeNull();
  });

  it("a place already claimed by somebody else cannot be taken", async () => {
    users["u-thief"] = { phone: "201000000002", phoneVerifiedAt: new Date() };
    expect(await resolveBusinessAccess("u-thief")).toBeNull();
    expect(staff.find((s) => s.id === "st-provider")?.userId).toBe("u-provider");
  });

  it("an inactive staff member or one whose access was taken away gets nothing", async () => {
    expect(await resolveBusinessAccess("u-gone")).toBeNull();
    expect(await resolveBusinessAccess("u-revoked")).toBeNull();
  });

  it("somebody with no business and no staff place gets nothing", async () => {
    expect(await resolveBusinessAccess("u-stranger")).toBeNull();
  });
});

describe("what each role may do", () => {
  const owner = { role: "OWNER" as const };
  const manager = { role: "MANAGER" as const };
  const provider = { role: "PROVIDER" as const };

  it("everybody may read bookings, confirm and move them through the day", () => {
    for (const a of [owner, manager, provider]) {
      expect(can(a, "bookings.read")).toBe(true);
      expect(can(a, "bookings.confirm")).toBe(true);
      expect(can(a, "bookings.progress")).toBe(true);
    }
  });

  it("only the owner and managers see every booking, cancel, reschedule and see customers", () => {
    for (const action of ["bookings.readAll", "bookings.cancel", "bookings.reschedule", "customers.read"] as const) {
      expect(can(owner, action)).toBe(true);
      expect(can(manager, action)).toBe(true);
      expect(can(provider, action)).toBe(false);
    }
  });

  it("reports and who may sign in are the owner's alone", () => {
    for (const action of ["reports.read", "staff.manageAccess"] as const) {
      expect(can(owner, action)).toBe(true);
      expect(can(manager, action)).toBe(false);
      expect(can(provider, action)).toBe(false);
    }
  });

  it("permissionsOf lists exactly what can() allows", () => {
    expect(permissionsOf(provider)).not.toContain("customers.read");
    expect(permissionsOf(owner)).toContain("reports.read");
  });
});

describe("the bookings a query may reach", () => {
  it("is the whole business for an owner or manager", () => {
    expect(bookingScope({ id: "biz-a" }, { role: "OWNER", userId: "o", staffMemberId: null })).toEqual({ businessId: "biz-a" });
    expect(bookingScope({ id: "biz-a" }, { role: "MANAGER", userId: "m", staffMemberId: "st-manager" })).toEqual({ businessId: "biz-a" });
  });

  it("is only their own for a provider, and never everything if the staff id were missing", () => {
    expect(bookingScope({ id: "biz-a" }, { role: "PROVIDER", userId: "p", staffMemberId: "st-provider" })).toEqual({
      businessId: "biz-a",
      staffMemberId: "st-provider",
    });
    expect(bookingScope({ id: "biz-a" }, { role: "PROVIDER", userId: "p", staffMemberId: null }).staffMemberId).toBe("__none__");
  });
});
