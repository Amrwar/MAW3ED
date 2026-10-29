import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * Account deletion on a real Postgres, and what the next holder of the
 * same phone number can see afterwards.
 *
 * The question Phase 20 was asked to settle: bookings stay keyed by the
 * phone when an account is deleted, and Egyptian numbers are recycled.
 * Before this, verifying the number again made a new account that was
 * shown the previous holder's appointments. Now the number is recorded
 * as released and the new account's history starts there.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/account/deletion.db.test.ts
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

// lib/account/queries reads the web session through next-auth for one
// function (getAccountUser), which Vitest cannot load; nothing here
// signs anybody in.
vi.mock("@/auth", () => ({ auth: async () => null }));

describe.skipIf(!local)("account deletion and the recycled number", () => {
  let db: PrismaClient;
  let deleteCustomerAccount: typeof import("./deletion").deleteCustomerAccount;
  let accountForVerifiedPhone: typeof import("@/lib/auth/login-code").accountForVerifiedPhone;
  let getUpcoming: typeof import("./queries").getUpcoming;
  let getHistory: typeof import("./queries").getHistory;
  let getPaymentHistory: typeof import("./queries").getPaymentHistory;
  let ownedWhere: typeof import("./queries").ownedWhere;
  const tag = `p20del-${Date.now()}`;
  const phone = `2010${String(Date.now()).slice(-8)}`;
  const ids = { users: [] as string[], businesses: [] as string[] };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.AUTH_SECRET ??= "p20-test-secret-p20-test-secret";
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ deleteCustomerAccount } = await import("./deletion"));
    ({ accountForVerifiedPhone } = await import("@/lib/auth/login-code"));
    ({ getUpcoming, getHistory, getPaymentHistory, ownedWhere } = await import("./queries"));
  });

  afterAll(async () => {
    if (!db) return;
    await db.payment.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.notificationDelivery.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { OR: [{ id: { in: ids.users } }, { phone }] } });
    await db.auditLog.deleteMany({ where: { action: { in: ["account.deleted"] }, resourceId: { in: ids.users } } });
    const { pseudonym } = await import("@/lib/security/pseudonym");
    await db.phoneRelease.deleteMany({ where: { phoneHash: pseudonym(phone) } });
  });

  it("fences the previous holder's bookings off from the next account on the same number", async () => {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({ data: { email: `${tag}-owner@example.test`, name: tag } });
    ids.users.push(owner.id);
    const business = await db.business.create({
      data: { slug: tag, nameAr: tag, ownerId: owner.id, cityId: city.id, categoryId: category.id },
    });
    ids.businesses.push(business.id);
    const service = await db.service.create({ data: { businessId: business.id, nameAr: "خدمة", duration: 60, price: 100 } });
    const customer = await db.customer.create({ data: { businessId: business.id, name: "الأول", phone } });

    // The first holder: an account, a past booking, a future one, a payment, a delivery.
    const first = await accountForVerifiedPhone(phone);
    ids.users.push(first.id);
    const past = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const mk = (date: string, status: "COMPLETED" | "CONFIRMED") =>
      db.booking.create({
        data: {
          businessId: business.id, serviceId: service.id, customerId: customer.id,
          customerName: "الأول", customerPhone: phone, customerEmail: `${tag}@example.test`,
          date: new Date(`${date}T00:00:00Z`), startTime: "10:00", endTime: "11:00",
          startsAt: new Date(`${date}T10:00:00Z`), endsAt: new Date(`${date}T11:00:00Z`),
          status, totalPrice: 100, accessToken: `${tag}-${date}-${status}`,
        },
      });
    const oldPast = await mk(past, "COMPLETED");
    const oldFuture = await mk(future, "CONFIRMED");
    await db.payment.create({ data: { kind: "BOOKING_FULL", businessId: business.id, bookingId: oldPast.id, amountCents: 10000, status: "SUCCEEDED", provider: "MANUAL", paidAt: new Date() } });
    await db.notificationDelivery.create({
      data: { dedupeKey: `${tag}:k1`, kind: "BOOKING_CONFIRMED", channel: "WHATSAPP", status: "SENT", recipient: phone, bookingId: oldPast.id, businessId: business.id },
    });

    expect((await getUpcoming(phone)).map((b) => b.id)).toEqual([oldFuture.id]);
    expect((await getHistory(phone)).bookings.map((b) => b.id)).toEqual([oldPast.id]);

    // The first holder deletes their account.
    const result = await deleteCustomerAccount(first.id);
    expect(result).toEqual({ ok: true });
    expect(await db.user.findUnique({ where: { id: first.id } })).toBeNull();
    // The businesses keep their records...
    expect(await db.booking.count({ where: { id: { in: [oldPast.id, oldFuture.id] } } })).toBe(2);
    expect((await db.payment.findFirst({ where: { bookingId: oldPast.id } }))?.status).toBe("SUCCEEDED");
    // ...but the delivery ledger no longer names the number, and the deletion is on record.
    expect((await db.notificationDelivery.findUniqueOrThrow({ where: { dedupeKey: `${tag}:k1` } })).recipient).toBe("[deleted account]");
    expect(await db.auditLog.count({ where: { action: "account.deleted", resourceId: first.id } })).toBe(1);

    // Months later, somebody else gets the number and signs in.
    const second = await accountForVerifiedPhone(phone);
    ids.users.push(second.id);
    expect(second.id).not.toBe(first.id);
    const row = await db.user.findUniqueOrThrow({ where: { id: second.id } });
    expect(row.historySince).not.toBeNull();
    // Not greeted by the previous holder's name either.
    expect(row.name).toBeNull();

    // They see none of the previous holder's appointments or payments...
    expect(await getUpcoming(phone, row.historySince)).toEqual([]);
    expect((await getHistory(phone, { since: row.historySince })).total).toBe(0);
    expect(await getPaymentHistory(phone, row.historySince)).toEqual([]);
    expect(await db.booking.findFirst({ where: { id: oldFuture.id, ...ownedWhere(phone, row.historySince) } })).toBeNull();

    // ...and do see their own, made after the release.
    const mine = await mk(future, "CONFIRMED").catch(() => null);
    // Same slot as the old future booking: the constraint refuses it, so book another time.
    const own = mine ?? (await db.booking.create({
      data: {
        businessId: business.id, serviceId: service.id, customerId: customer.id,
        customerName: "الثاني", customerPhone: phone,
        date: new Date(`${future}T00:00:00Z`), startTime: "12:00", endTime: "13:00",
        startsAt: new Date(`${future}T12:00:00Z`), endsAt: new Date(`${future}T13:00:00Z`),
        status: "CONFIRMED", totalPrice: 100, accessToken: `${tag}-second`,
      },
    }));
    expect((await getUpcoming(phone, row.historySince)).map((b) => b.id)).toEqual([own.id]);
  });
});
