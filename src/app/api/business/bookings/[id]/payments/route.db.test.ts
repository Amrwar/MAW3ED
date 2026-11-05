import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * The owner's "send a payment link" on a real Postgres (final audit F-14):
 * a second link for the same balance is refused while the first can
 * still be paid, so a customer cannot be charged twice for it. Only the
 * session and the provider are faked.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run "src/app/api/business/bookings/[id]/payments/route.db.test.ts"
 *
 * Everything it creates is tagged plink- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

const { who, sessions } = vi.hoisted(() => ({ who: { business: null as unknown, userId: "" }, sessions: { n: 0 } }));

vi.mock("@/lib/api", () => ({
  ok: (data: unknown, status = 200) => Response.json({ data }, { status }),
  err: (error: string, status = 400, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status }),
  requireBusiness: async () => ({ session: { user: { id: who.userId } }, business: who.business }),
}));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn(async () => []), notifyLater: vi.fn() }));
vi.mock("@/lib/services/paymob", () => ({
  createPaymentSession: vi.fn(async () => ({ paymentUrl: "https://pay.test/x", paymobOrderId: `${Date.now()}${sessions.n++}` })),
}));

describe.skipIf(!local)("POST /api/business/bookings/[id]/payments (link) on a real database", () => {
  let db: PrismaClient;
  let POST: typeof import("./route").POST;
  const tag = `plink-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[] };
  let bookingId = "";

  const send = () =>
    POST(new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "link" }) }), {
      params: Promise.resolve({ id: bookingId }),
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ POST } = await import("./route"));
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({ data: { email: `${tag}@example.test`, name: tag } });
    ids.users.push(owner.id);
    const business = await db.business.create({
      data: { slug: tag, nameAr: tag, ownerId: owner.id, cityId: city.id, categoryId: category.id, plan: "PRO", subscriptionStatus: "ACTIVE" },
    });
    ids.businesses.push(business.id);
    const service = await db.service.create({ data: { businessId: business.id, nameAr: "خدمة", duration: 60, price: 250 } });
    const date = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
    const booking = await db.booking.create({
      data: {
        businessId: business.id, serviceId: service.id, customerName: "P", customerPhone: "01000000099",
        date: new Date(`${date}T00:00:00Z`), startTime: "10:00", endTime: "11:00",
        startsAt: new Date(`${date}T10:00:00Z`), endsAt: new Date(`${date}T11:00:00Z`),
        status: "CONFIRMED", totalPrice: 250, accessToken: `${tag}-t`,
      },
    });
    bookingId = booking.id;
    who.userId = owner.id;
    who.business = business;
  });

  afterAll(async () => {
    if (!db) return;
    await db.payment.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.service.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("opens one link, refuses a second while it is live, and allows one once it has expired", async () => {
    const first = await send();
    expect(first.status).toBe(200);
    const [a, b] = await Promise.all([send(), send()]);
    expect([a.status, b.status]).toEqual([409, 409]);
    expect((await a.json()).code).toBe("payment-in-progress");
    expect(await db.payment.count({ where: { bookingId, status: "PENDING" } })).toBe(1);

    // Past its lifetime the old link cannot be paid: a new one replaces it.
    await db.payment.updateMany({ where: { bookingId }, data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    expect((await send()).status).toBe(200);
    expect(await db.payment.count({ where: { bookingId, status: "PENDING" } })).toBe(1);
    expect(await db.payment.count({ where: { bookingId, status: "ABANDONED" } })).toBe(1);
  });
});
