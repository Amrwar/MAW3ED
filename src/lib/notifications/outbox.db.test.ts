import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * The notification outbox against a real Postgres: a provider outage
 * leaves a FAILED row with a retry time, the re-drive job sends it
 * later and only it, a permanent refusal is not retried, retries run
 * out, a claim left PENDING by a dead process is picked up, and a
 * reminder is sent once however many times it is asked for.
 *
 * Only the email provider is faked; the ledger, the claims and the
 * dispatcher are the real ones.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/notifications/outbox.db.test.ts
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

const email = vi.hoisted(() => ({
  outcome: { ok: true } as { ok: boolean; skipped?: boolean; reason?: string },
  calls: [] as string[],
}));

vi.mock("@/lib/services/email", async (orig) => {
  const real = await orig<typeof import("@/lib/services/email")>();
  // Every sender — the general one and the hand-written ones, which all
  // take the address first — reports to the same fake provider.
  const fake = async (first: unknown) => {
    const to = typeof first === "string" ? first : (first as { to?: string })?.to ?? "";
    email.calls.push(to);
    return email.outcome;
  };
  const stubbed: Record<string, unknown> = {};
  for (const k of Object.keys(real)) if (typeof (real as Record<string, unknown>)[k] === "function") stubbed[k] = fake;
  return { ...stubbed, isEmailEnabled: () => true };
});

describe.skipIf(!local)("notification outbox on a real database", () => {
  let db: PrismaClient;
  let notify: typeof import("./dispatch").notify;
  let redriveNotifications: typeof import("./outbox").redriveNotifications;
  const tag = `p19ob-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[] };
  let businessId: string;
  let serviceId: string;
  let customerId: string;
  let n = 0;

  async function booking(extra: { status?: "CONFIRMED" | "COMPLETED" } = {}) {
    n++;
    const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    return db.booking.create({
      data: {
        businessId,
        serviceId,
        customerId,
        customerName: "P19 Outbox",
        customerPhone: "01000000190",
        customerEmail: `${tag}-${n}@example.test`,
        date: new Date(`${date}T00:00:00Z`),
        startTime: "10:00",
        endTime: "11:00",
        startsAt: new Date(`${date}T10:00:00Z`),
        endsAt: new Date(`${date}T11:00:00Z`),
        status: extra.status ?? "CONFIRMED",
        totalPrice: 100,
        accessToken: `${tag}-${n}-${Math.random().toString(16).slice(2)}`,
      },
    });
  }

  const customerEmailRow = (bookingId: string, type: string) =>
    db.notificationDelivery.findFirstOrThrow({ where: { bookingId, dedupeKey: { startsWith: `${type}:` }, channel: "EMAIL" } });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ notify } = await import("./dispatch"));
    ({ redriveNotifications } = await import("./outbox"));

    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({ data: { email: `${tag}@example.test`, name: tag, notifyByEmail: false } });
    ids.users.push(owner.id);
    const business = await db.business.create({
      data: { slug: tag, nameAr: tag, ownerId: owner.id, cityId: city.id, categoryId: category.id, notifyByEmail: false, notifyByWhatsApp: false },
    });
    ids.businesses.push(business.id);
    businessId = business.id;
    serviceId = (await db.service.create({ data: { businessId, nameAr: "خدمة", duration: 60, price: 100 } })).id;
    customerId = (await db.customer.create({ data: { businessId, name: "زبون", phone: "01000000190" } })).id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.notificationDelivery.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("claims PENDING, records SENT, and carries the event", async () => {
    email.outcome = { ok: true };
    const b = await booking({ status: "COMPLETED" });
    const out = await notify({ type: "booking.completed", bookingId: b.id });
    expect(out.find((o) => o.channel === "EMAIL" && o.audience === "customer")?.status).toBe("SENT");
    const row = await customerEmailRow(b.id, "booking.completed");
    expect(row.status).toBe("SENT");
    expect(row.attempts).toBe(1);
    expect(row.event).toEqual({ type: "booking.completed", bookingId: b.id });
    expect(row.nextAttemptAt).toBeNull();
  });

  it("survives a provider outage: FAILED with a retry time, then SENT by the re-drive, once", async () => {
    email.outcome = { ok: false, reason: "network-error" };
    const b = await booking({ status: "COMPLETED" });
    await notify({ type: "booking.completed", bookingId: b.id });
    let row = await customerEmailRow(b.id, "booking.completed");
    expect(row.status).toBe("FAILED");
    expect(row.attempts).toBe(1);
    expect(row.nextAttemptAt).not.toBeNull();

    // Not due yet: nothing happens.
    email.calls.length = 0;
    const early = await redriveNotifications(notify, new Date());
    expect(email.calls.filter((to) => to === b.customerEmail)).toHaveLength(0);
    expect(early.events).toBe(0);

    // The provider is back and the backoff has elapsed (the clock is
    // moved by moving the row: the dispatcher reads the real clock).
    email.outcome = { ok: true };
    await db.notificationDelivery.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    const result = await redriveNotifications(notify, new Date());
    expect(result.events).toBe(1);
    expect(email.calls.filter((to) => to === b.customerEmail)).toHaveLength(1);
    row = await customerEmailRow(b.id, "booking.completed");
    expect(row.status).toBe("SENT");
    expect(row.attempts).toBe(2);

    // Nothing is left to do, and the sent row is never sent again.
    const again = await redriveNotifications(notify, new Date());
    expect(again.events).toBe(0);
    expect(email.calls.filter((to) => to === b.customerEmail)).toHaveLength(1);
  });

  it("does not retry a refusal that cannot improve", async () => {
    email.outcome = { ok: false, reason: "http-400" };
    const b = await booking({ status: "COMPLETED" });
    await notify({ type: "booking.completed", bookingId: b.id });
    const row = await customerEmailRow(b.id, "booking.completed");
    expect(row.status).toBe("DEAD");
    expect(row.nextAttemptAt).toBeNull();
  });

  it("gives up after the last allowed attempt", async () => {
    email.outcome = { ok: false, reason: "http-503" };
    const b = await booking({ status: "COMPLETED" });
    await notify({ type: "booking.completed", bookingId: b.id });
    const row = await customerEmailRow(b.id, "booking.completed");
    // Pretend four attempts have already failed.
    await db.notificationDelivery.update({ where: { id: row.id }, data: { attempts: 4, nextAttemptAt: new Date(Date.now() - 1000) } });
    const result = await redriveNotifications(notify, new Date());
    expect(result.events).toBe(1);
    const dead = await db.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    expect(dead.status).toBe("DEAD");
    expect(dead.attempts).toBe(5);
  });

  it("picks up a claim left PENDING by a process that died mid-send, and counts the lost attempt", async () => {
    email.outcome = { ok: true };
    const b = await booking({ status: "COMPLETED" });
    await notify({ type: "booking.completed", bookingId: b.id });
    const row = await customerEmailRow(b.id, "booking.completed");
    // Rewind it to how a crashed send leaves it: PENDING, ten minutes ago, one attempt spent.
    await db.$executeRaw`UPDATE "NotificationDelivery" SET status = 'PENDING', "attempts" = 1, "updatedAt" = NOW() - interval '10 minutes' WHERE id = ${row.id}`;
    email.calls.length = 0;
    const result = await redriveNotifications(notify, new Date());
    expect(result.events).toBe(1);
    expect(email.calls.filter((to) => to === b.customerEmail)).toHaveLength(1);
    const after = await db.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("SENT");
    expect(after.attempts).toBe(2);
  });

  it("closes a claim that hung through every attempt instead of taking it over again", async () => {
    email.outcome = { ok: true };
    const b = await booking({ status: "COMPLETED" });
    await notify({ type: "booking.completed", bookingId: b.id });
    const row = await customerEmailRow(b.id, "booking.completed");
    await db.$executeRaw`UPDATE "NotificationDelivery" SET status = 'PENDING', "attempts" = 5, "updatedAt" = NOW() - interval '10 minutes' WHERE id = ${row.id}`;
    email.calls.length = 0;
    await redriveNotifications(notify, new Date());
    expect(email.calls.filter((to) => to === b.customerEmail)).toHaveLength(0);
    expect((await db.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("DEAD");
  });

  it("closes a due row the dispatcher can no longer deliver, so it stops clogging the batch", async () => {
    email.outcome = { ok: false, reason: "http-503" };
    const b = await booking({ status: "COMPLETED" });
    await notify({ type: "booking.completed", bookingId: b.id });
    const row = await customerEmailRow(b.id, "booking.completed");
    // The booking disappears (the row's bookingId is kept so the test can find it).
    await db.$executeRaw`UPDATE "NotificationDelivery" SET "nextAttemptAt" = NOW() - interval '1 minute', "bookingId" = NULL WHERE "bookingId" = ${b.id}`;
    await db.booking.delete({ where: { id: b.id } });
    const result = await redriveNotifications(notify, new Date());
    const after = await db.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("DEAD");
    expect(result.orphaned).toBeGreaterThanOrEqual(1);
  });

  it("sends a reminder once, however many times the cron asks, and never a stale one", async () => {
    email.outcome = { ok: true };
    const b = await booking();
    const startsAt = b.startsAt!.toISOString();
    email.calls.length = 0;
    const first = await notify({ type: "booking.reminder", bookingId: b.id, startsAt });
    const second = await notify({ type: "booking.reminder", bookingId: b.id, startsAt });
    expect(first.find((o) => o.channel === "EMAIL" && o.audience === "customer")?.status).toBe("SENT");
    expect(second.find((o) => o.channel === "EMAIL" && o.audience === "customer")?.status).toBe("DUPLICATE");
    expect(email.calls.filter((to) => to === b.customerEmail)).toHaveLength(1);

    // A reminder that failed and is only due again after the appointment began is dropped, not sent.
    const row = await customerEmailRow(b.id, "booking.reminder");
    await db.notificationDelivery.update({ where: { id: row.id }, data: { status: "FAILED", nextAttemptAt: new Date(Date.now() - 1000) } });
    const afterStart = new Date(b.startsAt!.getTime() + 2 * 3_600_000);
    const result = await redriveNotifications(notify, new Date(), afterStart);
    expect(result.staled).toBe(1);
    expect((await db.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("DEAD");
    expect(email.calls.filter((to) => to === b.customerEmail)).toHaveLength(1);
  });
});
