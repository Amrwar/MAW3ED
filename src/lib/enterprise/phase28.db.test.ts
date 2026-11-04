import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "http";
import type { PrismaClient } from "@prisma/client";

/**
 * Phase 28 enterprise integrations on a real Postgres: API-key
 * authentication and limits, cross-organization isolation, the webhook
 * change feed, signed delivery to a local receiver, retry termination and
 * endpoint auto-disable.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/enterprise/phase28.db.test.ts
 *
 * Everything created is tagged p28- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("Phase 28 enterprise on a real database", () => {
  let db: PrismaClient;
  let auth: typeof import("./auth");
  let clients: typeof import("./clients");
  let hooks: typeof import("./webhooks");
  let vis: typeof import("./visibility");
  const tag = `p28-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[], orgs: [] as string[] };
  let server: Server;
  let port = 0;
  /** What the receiver got, and what it answers next. */
  const received: { headers: Record<string, string | string[] | undefined>; body: string }[] = [];
  let answer = 200;

  async function user(n: string) {
    const u = await db.user.create({ data: { email: `${tag}-${n}@example.test`, name: n } });
    ids.users.push(u.id);
    return u;
  }
  async function business(n: string) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await user(`o-${n}`);
    const b = await db.business.create({ data: { slug: `${tag}-${n}`, nameAr: n, ownerId: owner.id, cityId: city.id, categoryId: category.id, isPublished: true } });
    ids.businesses.push(b.id);
    const service = await db.service.create({ data: { businessId: b.id, nameAr: "خدمة", duration: 30, price: 100 } });
    return { b, owner, service };
  }
  async function org(n: string, contract = true) {
    const founder = await user(`f-${n}`);
    const o = await db.organization.create({ data: { slug: `${tag}-${n}`, nameAr: n, createdById: founder.id, status: "APPROVED" } });
    ids.orgs.push(o.id);
    if (contract) {
      await db.organizationContract.create({
        data: { organizationId: o.id, reference: `QA-${n}`, startsAt: new Date(Date.now() - 86_400_000), maxApiClients: 2, maxWebhooks: 2, apiRequestsPerMinute: 10 },
      });
    }
    return { o, founder };
  }
  async function link(orgId: string, businessId: string, initiatedById: string, relation: "OWNED" | "HOSTED" | "MANAGED", scopes: ("RESERVATIONS" | "REPORTS" | "FINANCE")[]) {
    return db.organizationBusiness.create({ data: { organizationId: orgId, businessId, relation, status: "APPROVED", scopes, initiatedById } });
  }
  function bookingFor(x: Awaited<ReturnType<typeof business>>, minutes: number) {
    const start = new Date(Date.UTC(2026, 11, 1, 10, minutes));
    return db.booking.create({
      data: {
        businessId: x.b.id, serviceId: x.service.id, customerName: "سارة", customerPhone: "01012345678",
        date: new Date("2026-12-01T00:00:00Z"), startTime: start.toISOString().slice(11, 16), endTime: "23:00",
        startsAt: start, endsAt: new Date(start.getTime() + 30 * 60_000), status: "CONFIRMED", totalPrice: 100,
        accessToken: `${tag}-${Math.random().toString(36).slice(2)}`,
      },
    });
  }
  const req = (key: string | null, path = "/api/v1/organization") =>
    new Request(`http://localhost${path}`, { headers: key ? { authorization: `Bearer ${key}` } : {} });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.AUTH_SECRET ||= "p28-db-test-secret-0123456789";
    process.env.WEBHOOK_ALLOW_PRIVATE = "1";
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    auth = await import("./auth");
    clients = await import("./clients");
    hooks = await import("./webhooks");
    vis = await import("./visibility");
    server = createServer((rq, rs) => {
      let body = "";
      rq.on("data", (c) => (body += c));
      rq.on("end", () => {
        received.push({ headers: rq.headers, body });
        rs.statusCode = answer;
        rs.end("ok");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    server?.close();
    if (!db) return;
    await db.auditLog.deleteMany({ where: { resourceId: { in: ids.orgs } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.organization.deleteMany({ where: { id: { in: ids.orgs } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("authenticates keys: wrong, revoked, out of scope, without a contract, and past a rotation's grace", async () => {
    const { o, founder } = await org("auth");
    const actor = { id: founder.id, name: "f" };
    const made = await clients.createApiClient(o.id, { name: "ERP", scopes: ["organization:read"] }, actor);
    if (!made.ok) throw new Error(made.why);
    expect((await auth.requireApiClient(req(made.key), "organization:read")).organizationId).toBe(o.id);

    const status = async (key: string | null, scope: Parameters<typeof auth.requireApiClient>[1] = "organization:read") => {
      try {
        await auth.requireApiClient(req(key), scope);
        return 200;
      } catch (e) {
        return (e as InstanceType<typeof auth.ApiError>).status;
      }
    };
    expect(await status(null)).toBe(401);
    expect(await status(made.key.slice(0, -1) + (made.key.endsWith("A") ? "B" : "A"))).toBe(401);
    expect(await status(made.key, "bookings:read")).toBe(403);

    // Rotation: the old key keeps working in its grace, then stops.
    const rotated = await clients.rotateApiClient(o.id, made.id, actor, 1);
    if (!rotated.ok) throw new Error(rotated.why);
    expect(await status(made.key)).toBe(200);
    expect(await status(rotated.key)).toBe(200);
    await db.apiClient.update({ where: { id: made.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await status(made.key)).toBe(401);

    expect(await clients.revokeApiClient(o.id, rotated.id, actor)).toBe(true);
    expect(await status(rotated.key)).toBe(401);

    // No contract in force: refused even with a good key.
    const again = await clients.createApiClient(o.id, { name: "ERP2", scopes: ["organization:read"] }, actor);
    if (!again.ok) throw new Error(again.why);
    await db.organizationContract.update({ where: { organizationId: o.id }, data: { endsAt: new Date(Date.now() - 1) } });
    expect(await status(again.key)).toBe(403);

    // Every change is in the organization's trail.
    const trail = await db.auditLog.findMany({ where: { resourceId: o.id }, select: { action: true } });
    expect(trail.map((t) => t.action).sort()).toEqual(["org.api_key.create", "org.api_key.create", "org.api_key.revoke", "org.api_key.rotate"].sort());
  });

  it("limits keys per contract, even under a race, and rate-limits each key", async () => {
    const { o, founder } = await org("limits");
    const actor = { id: founder.id, name: "f" };
    const results = await Promise.all([1, 2, 3, 4].map((i) => clients.createApiClient(o.id, { name: `k${i}`, scopes: ["organization:read"] }, actor)));
    expect(results.filter((r) => r.ok).length).toBe(2);
    expect(results.filter((r) => !r.ok && r.why === "limit").length).toBe(2);
    const key = (results.find((r) => r.ok) as { key: string }).key;
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      try {
        await auth.requireApiClient(req(key), "organization:read");
        codes.push(200);
      } catch (e) {
        codes.push((e as InstanceType<typeof auth.ApiError>).status);
      }
    }
    // The contract allows 10 a minute.
    expect(codes.filter((c) => c === 200).length).toBeLessThanOrEqual(10);
    expect(codes).toContain(429);
    const usage = await db.apiUsageDay.findMany({ where: { client: { organizationId: o.id } } });
    expect(usage.reduce((n, u) => n + u.requests, 0)).toBeGreaterThan(0);
  });

  it("keeps two organizations apart, and a mall away from its tenants' bookings", async () => {
    const mall = await org("mall");
    const group = await org("group");
    const tenant = await business("tenant");
    const brand = await business("brand");
    const branchBrand = await business("branchbrand");
    // A mall hosts the tenant, and was even granted RESERVATIONS: still no bookings.
    // (The database refuses scopes on a HOSTED association outright —
    // OrganizationBusiness_hosted_no_scopes_chk.)
    await expect(link(mall.o.id, tenant.b.id, mall.founder.id, "HOSTED", ["RESERVATIONS"])).rejects.toThrow();
    await link(mall.o.id, tenant.b.id, mall.founder.id, "HOSTED", []);
    await link(group.o.id, brand.b.id, group.founder.id, "OWNED", ["RESERVATIONS", "REPORTS"]);
    // The group manages another brand without RESERVATIONS: no bookings either.
    await link(group.o.id, branchBrand.b.id, group.founder.id, "MANAGED", ["REPORTS"]);

    const mallVis = await vis.visibleBusinesses(mall.o.id);
    const groupVis = await vis.visibleBusinesses(group.o.id);
    expect(mallVis.map((v) => v.businessId)).toEqual([tenant.b.id]);
    expect(mallVis.filter(vis.seesBookings)).toEqual([]);
    expect(groupVis.map((v) => v.businessId).sort()).toEqual([brand.b.id, branchBrand.b.id].sort());
    expect(groupVis.filter(vis.seesBookings).map((v) => v.businessId)).toEqual([brand.b.id]);

    // The bookings route answers the mall with the same 404 as a business that does not exist.
    const mallKey = await clients.createApiClient(mall.o.id, { name: "m", scopes: ["bookings:read"] }, { id: mall.founder.id, name: "m" });
    if (!mallKey.ok) throw new Error(mallKey.why);
    const { GET } = await import("@/app/api/v1/bookings/route");
    const r1 = await GET(req(mallKey.key, `/api/v1/bookings?businessId=${tenant.b.id}&from=2026-12-01`));
    expect(r1.status).toBe(404);
    const r2 = await GET(req(mallKey.key, `/api/v1/bookings?businessId=${brand.b.id}&from=2026-12-01`));
    expect(r2.status).toBe(404);

    // The group sees its own brand's bookings, without the customer.
    await bookingFor(brand, 0);
    const groupKey = await clients.createApiClient(group.o.id, { name: "g", scopes: ["bookings:read"] }, { id: group.founder.id, name: "g" });
    if (!groupKey.ok) throw new Error(groupKey.why);
    const r3 = await GET(req(groupKey.key, `/api/v1/bookings?businessId=${brand.b.id}&from=2026-12-01`));
    expect(r3.status).toBe(200);
    const body = await r3.json();
    expect(body.data).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/سارة|01012345678|customer/);
  });

  it("pages large listings with a stable cursor and never repeats a row", async () => {
    const big = await org("big");
    const many = [];
    for (let i = 0; i < 7; i++) many.push(await business(`many${i}`));
    for (const m of many) await link(big.o.id, m.b.id, big.founder.id, "HOSTED", []);
    const k = await clients.createApiClient(big.o.id, { name: "b", scopes: ["businesses:read"] }, { id: big.founder.id, name: "b" });
    if (!k.ok) throw new Error(k.why);
    const { GET } = await import("@/app/api/v1/businesses/route");
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const r: Response = await GET(req(k.key, `/api/v1/businesses?limit=3${cursor ? `&cursor=${cursor}` : ""}`));
      const j = (await r.json()) as { data: { business: { id: string } }[]; nextCursor: string | null };
      seen.push(...j.data.map((d) => d.business.id));
      cursor = j.nextCursor;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(7);
    expect(seen.length).toBe(7);
  });

  it("queues each booking change once, signs it, and delivers it", async () => {
    const g = await org("hooks");
    const brand = await business("hookbrand");
    await link(g.o.id, brand.b.id, g.founder.id, "OWNED", ["RESERVATIONS"]);
    const other = await org("other");
    const stranger = await business("stranger");
    await link(other.o.id, stranger.b.id, other.founder.id, "OWNED", ["RESERVATIONS"]);

    const ep = await hooks.createEndpoint(g.o.id, { url: `http://127.0.0.1:${port}/hook`, events: ["booking.created", "booking.updated"] }, { id: g.founder.id, name: "g" });
    if (!ep.ok) throw new Error(ep.why);
    await db.webhookEndpoint.update({ where: { id: ep.id }, data: { cursorAt: new Date(Date.now() - 60_000) } });
    const b = await bookingFor(brand, 30);
    await bookingFor(stranger, 30); // another organization's: never ours

    await hooks.collectEvents();
    await hooks.collectEvents(); // a second read queues nothing more
    let rows = await db.webhookDelivery.findMany({ where: { endpointId: ep.id } });
    expect(rows.map((r) => r.eventType)).toEqual(["booking.created"]);
    expect((rows[0].payload as { id: string }).id).toBe(b.id);

    // A status change is a new event.
    await db.booking.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
    await hooks.collectEvents();
    rows = await db.webhookDelivery.findMany({ where: { endpointId: ep.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.eventType)).toEqual(["booking.created", "booking.updated"]);

    received.length = 0;
    answer = 200;
    const out = await hooks.processDeliveries();
    expect(out.sent).toBe(2);
    expect(received).toHaveLength(2);
    const r0 = received[0];
    expect(hooks.verifySignature(r0.body, String(r0.headers["maw3ed-signature"]), ep.secret)).toBe(true);
    expect(JSON.stringify(received.map((r) => r.body))).not.toMatch(/سارة|01012345678/);
    // Sent once: a second run sends nothing.
    expect((await hooks.processDeliveries()).sent).toBe(0);
  });

  it("stops retrying after the last attempt, and switches off an endpoint that keeps failing", async () => {
    const g = await org("retry");
    const ep = await hooks.createEndpoint(g.o.id, { url: `http://127.0.0.1:${port}/hook`, events: ["booking.created"] }, { id: g.founder.id, name: "g" });
    if (!ep.ok) throw new Error(ep.why);
    answer = 500;
    const d = await db.webhookDelivery.create({ data: { endpointId: ep.id, eventId: `${tag}-e1`, eventType: "booking.created", payload: {}, nextAttemptAt: new Date(0) } });
    const statuses: string[] = [];
    for (let i = 0; i < hooks.MAX_ATTEMPTS + 3; i++) {
      await db.webhookDelivery.updateMany({ where: { id: d.id, status: { in: ["PENDING", "FAILED"] } }, data: { nextAttemptAt: new Date(0) } });
      const r = await hooks.sendDelivery(d.id);
      statuses.push(r?.status ?? "none");
    }
    const final = await db.webhookDelivery.findUniqueOrThrow({ where: { id: d.id } });
    expect(final.status).toBe("DEAD");
    expect(final.attempts).toBe(hooks.MAX_ATTEMPTS);
    expect(statuses.slice(hooks.MAX_ATTEMPTS)).toEqual(["none", "none", "none"]);

    // Twenty failures in a row switch the endpoint off, once, with a reason.
    for (let i = 0; i < hooks.MAX_CONSECUTIVE_FAILURES; i++) {
      const x = await db.webhookDelivery.create({ data: { endpointId: ep.id, eventId: `${tag}-f${i}`, eventType: "booking.created", payload: {}, nextAttemptAt: new Date(0) } });
      await hooks.sendDelivery(x.id);
    }
    const after = await db.webhookEndpoint.findUniqueOrThrow({ where: { id: ep.id } });
    expect(after.status).toBe("DISABLED");
    expect(after.disabledReason).toMatch(/failed deliveries/);
    // Nothing more is sent to a disabled endpoint.
    await db.webhookDelivery.create({ data: { endpointId: ep.id, eventId: `${tag}-late`, eventType: "booking.created", payload: {}, nextAttemptAt: new Date(0) } });
    const before = received.length;
    await hooks.processDeliveries();
    expect(received.length).toBe(before);
    answer = 200;
  });

  it("refuses a webhook URL that points inside the network", async () => {
    process.env.WEBHOOK_ALLOW_PRIVATE = "";
    const g = await org("ssrf");
    for (const u of ["https://127.0.0.1/x", "https://169.254.169.254/latest", "http://example.com/x", "https://localhost/x"]) {
      const r = await hooks.createEndpoint(g.o.id, { url: u, events: ["booking.created"] }, { id: g.founder.id, name: "g" });
      expect(r.ok, u).toBe(false);
      if (!r.ok) expect(r.why).toBe("bad-url");
    }
    process.env.WEBHOOK_ALLOW_PRIVATE = "1";
  });
});
