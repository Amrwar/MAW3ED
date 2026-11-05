import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * Adding a proved phone to a signed-in account, on a real Postgres: the
 * step a Google sign-in takes before the customer area can find its
 * bookings (lib/account/link-phone.ts).
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/app/api/account/phone/route.db.test.ts
 *
 * The codes are real (createLoginCode writes them, nothing is sent);
 * only the session and the rate limiter are faked. Everything created
 * is tagged acphone- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

const { who } = vi.hoisted(() => ({ who: { userId: "" } }));

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/api", () => ({
  ok: (data: unknown, status = 200) => Response.json(data, { status }),
  err: (error: string, status = 400, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status }),
  requireSession: async () => ({ user: { id: who.userId } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true }),
  callerKey: async () => "test-caller",
  tooManyRequests: () => Response.json({ error: "slow down" }, { status: 429 }),
}));

describe.skipIf(!local)("POST /api/account/phone on a real database", () => {
  let db: PrismaClient;
  let POST: typeof import("./route").POST;
  let createLoginCode: typeof import("@/lib/auth/login-code").createLoginCode;
  let pseudonym: typeof import("@/lib/security/pseudonym").pseudonym;
  const tag = `acphone-${Date.now()}`;
  const stamp = String(Date.now()).slice(-7);
  // Distinct Egyptian mobiles per case, canonical form.
  const phones = { fresh: `2010${stamp}1`, held: `2010${stamp}2`, owner: `2010${stamp}3`, wrong: `2010${stamp}4` };
  const ids = { users: [] as string[], businesses: [] as string[] };

  const send = (phone: string, code: string) =>
    POST(new Request("http://x/api/account/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: `+${phone}`, code }) }));

  async function codeFor(phone: string): Promise<string> {
    const r = await createLoginCode(phone);
    if (!r.ok) throw new Error(`no code: ${r.reason}`);
    return r.code;
  }

  /** An account that is nothing but a Google sign-in. */
  async function googleUser(label: string, extra: Record<string, unknown> = {}) {
    const u = await db.user.create({
      data: {
        email: `${tag}-${label}@example.test`,
        name: null,
        accounts: { create: { type: "oidc", provider: "google", providerAccountId: `${tag}-${label}` } },
        ...extra,
      },
    });
    ids.users.push(u.id);
    return u;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.AUTH_SECRET ??= "acphone-test-secret-acphone-test";
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ POST } = await import("./route"));
    ({ createLoginCode } = await import("@/lib/auth/login-code"));
    ({ pseudonym } = await import("@/lib/security/pseudonym"));
  });

  afterAll(async () => {
    if (!db) return;
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.service.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({
      where: { OR: [{ id: { in: ids.users } }, { phone: { in: Object.values(phones) } }, { email: { startsWith: tag } }] },
    });
    await db.loginCode.deleteMany({ where: { phone: { in: Object.values(phones) } } });
    await db.phoneRelease.deleteMany({ where: { phoneHash: { in: Object.values(phones).map((p) => pseudonym(p)) } } });
  });

  it("links a number nobody holds, with the history fence and name a phone sign-in would give", async () => {
    // The number was released by a deleted account a month ago, and has
    // been booked under since: the fence and the name both come from that.
    const releasedAt = new Date(Date.now() - 30 * 86_400_000);
    await db.phoneRelease.create({ data: { phoneHash: pseudonym(phones.fresh), releasedAt } });
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({ data: { email: `${tag}-biz@example.test`, name: tag } });
    ids.users.push(owner.id);
    const business = await db.business.create({ data: { slug: tag, nameAr: tag, ownerId: owner.id, cityId: city.id, categoryId: category.id } });
    ids.businesses.push(business.id);
    const service = await db.service.create({ data: { businessId: business.id, nameAr: "خدمة", duration: 30, price: 100 } });
    const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await db.booking.create({
      data: {
        businessId: business.id, serviceId: service.id, customerName: "ليلى", customerPhone: `0${phones.fresh.slice(2)}`,
        date: new Date(`${date}T00:00:00Z`), startTime: "10:00", endTime: "10:30",
        startsAt: new Date(`${date}T10:00:00Z`), endsAt: new Date(`${date}T10:30:00Z`),
        status: "CONFIRMED", totalPrice: 100, accessToken: `${tag}-b1`,
      },
    });

    const g = await googleUser("fresh");
    who.userId = g.id;
    const res = await send(phones.fresh, await codeFor(phones.fresh));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ linked: true });

    const after = await db.user.findUniqueOrThrow({ where: { id: g.id } });
    expect(after.phone).toBe(phones.fresh);
    expect(after.phoneVerifiedAt).not.toBeNull();
    expect(after.historySince?.getTime()).toBe(releasedAt.getTime());
    expect(after.name).toBe("ليلى");
    // The code is spent: the same one cannot be used again.
    expect(await db.loginCode.count({ where: { phone: phones.fresh } })).toBe(0);
  });

  it("refuses a wrong code and changes nothing", async () => {
    const g = await googleUser("wrong");
    who.userId = g.id;
    const code = await codeFor(phones.wrong);
    const res = await send(phones.wrong, code === "000000" ? "111111" : "000000");
    expect(res.status).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: g.id } })).phone).toBeNull();
  });

  it("folds an account that is only a Google sign-in into the one holding the number", async () => {
    const holder = await db.user.create({ data: { phone: phones.held, phoneVerifiedAt: new Date(), name: "Holder" } });
    ids.users.push(holder.id);
    const g = await googleUser("held");
    const business = (await db.business.findFirstOrThrow({ where: { id: { in: ids.businesses } } })).id;
    await db.favorite.create({ data: { userId: g.id, businessId: business } });
    who.userId = g.id;

    const res = await send(phones.held, await codeFor(phones.held));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ merged: true });

    // The Google link now opens the holder's account; the empty one is gone.
    const link = await db.account.findUniqueOrThrow({ where: { provider_providerAccountId: { provider: "google", providerAccountId: `${tag}-held` } } });
    expect(link.userId).toBe(holder.id);
    expect(await db.user.findUnique({ where: { id: g.id } })).toBeNull();
    const merged = await db.user.findUniqueOrThrow({ where: { id: holder.id } });
    expect(merged.email).toBe(`${tag}-held@example.test`);
    expect(merged.emailVerified).not.toBeNull();
    expect(merged.name).toBe("Holder");
    expect(await db.favorite.count({ where: { userId: holder.id, businessId: business } })).toBe(1);
  });

  it("refuses when the signed-in account owns a business, and merges nothing", async () => {
    const holder = await db.user.create({ data: { phone: phones.owner, phoneVerifiedAt: new Date() } });
    ids.users.push(holder.id);
    const g = await googleUser("owner");
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const biz = await db.business.create({ data: { slug: `${tag}-o`, nameAr: tag, ownerId: g.id, cityId: city.id, categoryId: category.id } });
    ids.businesses.push(biz.id);
    who.userId = g.id;

    const res = await send(phones.owner, await codeFor(phones.owner));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("phone-taken");

    expect(await db.user.findUnique({ where: { id: g.id } })).not.toBeNull();
    const link = await db.account.findUniqueOrThrow({ where: { provider_providerAccountId: { provider: "google", providerAccountId: `${tag}-owner` } } });
    expect(link.userId).toBe(g.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: holder.id } })).email).toBeNull();
  });

  it("refuses a second number for an account that already has one", async () => {
    // The account from the first case, which now has phones.fresh.
    const g = await db.user.findFirstOrThrow({ where: { email: `${tag}-fresh@example.test` } });
    who.userId = g.id;
    const other = `2011${stamp}9`;
    try {
      const res = await send(other, await codeFor(other));
      expect(res.status).toBe(409);
      expect((await db.user.findUniqueOrThrow({ where: { id: g.id } })).phone).toBe(phones.fresh);
    } finally {
      await db.loginCode.deleteMany({ where: { phone: other } });
    }
  });
});
