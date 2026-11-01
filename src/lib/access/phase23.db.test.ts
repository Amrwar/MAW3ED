import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

// Provider calls run only when a test says so (no background kicks):
// work handed to after() is kept here, and run only by a test that asks.
const afterQueue = vi.hoisted(() => [] as (() => unknown)[]);
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void afterQueue.push(fn) }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/api", () => ({
  err: (message: string, status = 400, extra?: Record<string, unknown>) => Response.json({ error: message, ...extra }, { status }),
  requireSession: async () => {
    throw new Error("no session in this test");
  },
  currentCaller: async () => null,
}));
vi.mock("@/lib/notifications", () => ({ notifyLater: () => {} }));

/**
 * Phase 23 — booking QR, check-in, visitor passes and the sandbox access
 * provider, on a real Postgres with the phase23 migrations applied:
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/access/phase23.db.test.ts
 *
 * Test numbers are the Phase 23 list (docs/testing/ACCESS_ACCEPTANCE_MATRIX.md).
 * Everything created is tagged p23- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("Phase 23 access on a real database", () => {
  let db: PrismaClient;
  let checkin: typeof import("./check-in");
  let passes: typeof import("./passes");
  let sync: typeof import("./sync");
  let events: typeof import("./events");
  let sandbox: typeof import("./sandbox");
  let reconcile: typeof import("./reconcile");
  let state: typeof import("@/lib/bookings/state");
  let instants: typeof import("@/lib/bookings/instants");
  const tag = `p23-${Date.now()}`;
  const started = new Date();
  const ids = { users: [] as string[], businesses: [] as string[], venues: [] as string[], providers: [] as string[] };
  let providerId = "";
  let cityId = "";

  async function user(n: string) {
    const u = await db.user.create({ data: { email: `${tag}-${n}@example.test`, name: `${tag} ${n}`, emailVerified: new Date() } });
    ids.users.push(u.id);
    return u;
  }
  async function business(n: string) {
    const category = await db.category.findFirstOrThrow();
    const owner = await user(`owner-${n}`);
    const b = await db.business.create({
      data: { slug: `${tag}-${n}`, nameAr: `${tag} ${n}`, ownerId: owner.id, cityId, categoryId: category.id, isPublished: true },
    });
    ids.businesses.push(b.id);
    const service = await db.service.create({ data: { businessId: b.id, nameAr: "خدمة", duration: 60, price: 100 } });
    return { business: b, owner, service };
  }
  async function venue(n: string, biz: Awaited<ReturnType<typeof business>> | null, opts: { maxGuests?: number; reentry?: boolean; phone?: boolean } = {}) {
    const v = await db.venue.create({
      data: {
        slug: `${tag}-${n}`, nameAr: `مول ${n}`, cityId, status: "ACTIVE", isPublished: true,
        accessEnabled: true, accessProviderId: providerId, accessSiteRef: `SITE-${n}`,
      },
    });
    ids.venues.push(v.id);
    const gate = await db.venueGate.create({ data: { venueId: v.id, nameAr: "البوابة 1", code: `G1-${n}` } });
    await db.venuePolicy.create({
      data: {
        venueId: v.id, visitorEligibility: "BOOKING_REQUIRED", accessBeforeMinutes: 30, accessAfterMinutes: 30,
        maxGuestsPerBooking: opts.maxGuests ?? 2, reentryAllowed: opts.reentry ?? false, allowedGateIds: [gate.id],
        identityRequirement: opts.phone ? "NAME_AND_PHONE" : "NAME",
      },
    });
    if (biz) await db.venueMembership.create({ data: { venueId: v.id, businessId: biz.business.id, status: "APPROVED", requestedById: biz.owner.id } });
    return { venue: v, gate };
  }
  /** A booking starting `offsetMin` from now (Cairo wall clock), an hour long. */
  async function booking(biz: Awaited<ReturnType<typeof business>>, status: "CONFIRMED" | "PENDING" = "CONFIRMED", offsetMin = -5) {
    const wall = instants.cairoWallClock();
    const start = new Date(Math.floor((wall.getTime() + offsetMin * 60_000) / 60_000) * 60_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    const hhmm = (d: Date) => d.toISOString().slice(11, 16);
    return db.booking.create({
      data: {
        businessId: biz.business.id, serviceId: biz.service.id, customerName: "منى أحمد", customerPhone: "01012345678",
        date: new Date(`${start.toISOString().slice(0, 10)}T00:00:00Z`), startTime: hhmm(start), endTime: hhmm(end),
        startsAt: start, endsAt: end, status, totalPrice: 100, accessToken: `${tag}-${Math.random().toString(36).slice(2)}`,
      },
    });
  }
  const scopeOf = (businessId: string) => ({ businessId });
  const live = (bookingId: string) =>
    db.accessCredential.findMany({ where: { entitlement: { bookingId }, status: { in: ["PENDING_PROVIDER", "ACTIVE", "REVOKE_PENDING"] } } });
  const runJobs = (over: Partial<Parameters<typeof sync.runAccessJobs>[0]> = {}) => sync.runAccessJobs({ limit: 50, budgetMs: 20_000, timeoutMs: 1500, ...over });
  /** Run due jobs, then make every pending job due now and run again, a few times. */
  async function drain(times = 3) {
    for (let i = 0; i < times; i++) {
      await runJobs();
      await db.accessSyncJob.updateMany({ where: { status: "PENDING", credential: { entitlement: { venueId: { in: ids.venues } } } }, data: { nextAttemptAt: new Date(0), leasedUntil: null } });
    }
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.AUTH_SECRET ||= "p23-db-test-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3101";
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    checkin = await import("./check-in");
    passes = await import("./passes");
    sync = await import("./sync");
    events = await import("./events");
    sandbox = await import("./sandbox");
    reconcile = await import("./reconcile");
    state = await import("@/lib/bookings/state");
    instants = await import("@/lib/bookings/instants");
    cityId = (await db.city.findFirstOrThrow()).id;
    providerId = (await sandbox.ensureSandboxProvider()).id;
    await sandbox.setSandboxMode("NORMAL");
  });

  afterAll(async () => {
    if (!db) return;
    await sandbox.setSandboxMode("NORMAL").catch(() => {});
    const bookings = await db.booking.findMany({ where: { businessId: { in: ids.businesses } }, select: { id: true } });
    const visitorIds = (await db.bookingGuest.findMany({ where: { bookingId: { in: bookings.map((b) => b.id) } }, select: { visitorId: true } })).map((g) => g.visitorId);
    await db.auditLog.deleteMany({ where: { resourceId: { in: bookings.map((b) => b.id) } } });
    await db.venue.deleteMany({ where: { id: { in: ids.venues } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.visitor.deleteMany({ where: { id: { in: visitorIds } } });
    await db.sandboxAccessPass.deleteMany({ where: { createdAt: { gte: started }, siteRef: { startsWith: "SITE-" } } });
    await db.accessProvider.deleteMany({ where: { id: { in: ids.providers } } });
    await db.lifecycleEvent.deleteMany({ where: { userId: { in: ids.users } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  // ─── Booking QR and check-in ──────────────────────────────────────────

  it("2/3/25: a confirmed booking has a QR code; the business checks the customer in through the state machine, audited", async () => {
    const a = await business("checkin");
    const b = await booking(a);
    const code = await checkin.currentCheckInCode(b.id);
    expect(code?.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // The QR carries our URL with the opaque code, nothing else.
    const qrUrl = checkin.checkInUrl(code!.code);
    expect(qrUrl).toBe(`http://localhost:3101/c/${code!.code}`);
    expect(qrUrl).not.toContain(b.id);
    expect(qrUrl).not.toContain("0101");
    // The same code on every view; only its hash is stored.
    expect((await checkin.currentCheckInCode(b.id))?.code).toBe(code!.code);
    const row = await db.bookingCheckIn.findUniqueOrThrow({ where: { bookingId: b.id } });
    expect(row.tokenHash).not.toBe(code!.code);
    expect(JSON.stringify(row)).not.toContain(code!.code);

    const seen = await checkin.lookupScan(qrUrl, scopeOf(a.business.id));
    expect(seen.state).toBe("valid");
    expect(seen.booking).toMatchObject({ customerName: "منى أحمد", status: "CONFIRMED" });
    expect(seen.booking).not.toHaveProperty("customerPhone");

    const done = await checkin.checkIn(code!.code, scopeOf(a.business.id), a.owner.id);
    expect(done.state).toBe("checked-in");
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("ARRIVED");
    const audit = await db.auditLog.findMany({ where: { resourceId: b.id, action: "booking.check_in" } });
    expect(audit).toHaveLength(1);
    expect(audit[0].actorId).toBe(a.owner.id);
  });

  it("15: a duplicate check-in changes nothing and is reported as already checked in", async () => {
    const a = await business("dup");
    const b = await booking(a);
    const { code } = (await checkin.currentCheckInCode(b.id))!;
    const results = await Promise.all([1, 2, 3].map(() => checkin.checkIn(code, scopeOf(a.business.id), a.owner.id)));
    expect(results.every((r) => r.state === "checked-in")).toBe(true);
    expect(await db.auditLog.count({ where: { resourceId: b.id, action: "booking.check_in" } })).toBe(1);
    expect((await db.bookingCheckIn.findUniqueOrThrow({ where: { bookingId: b.id } })).checkedInAt).not.toBeNull();
  });

  it("4/12/14: another business, a colleague's provider scope, a forged code and a replaced code all read as not-found", async () => {
    const a = await business("scope-a");
    const other = await business("scope-b");
    const b = await booking(a);
    const { code } = (await checkin.currentCheckInCode(b.id))!;
    expect((await checkin.lookupScan(code, scopeOf(other.business.id))).state).toBe("not-found");
    expect((await checkin.checkIn(code, scopeOf(other.business.id), other.owner.id)).state).toBe("not-found");
    // A provider sees only their own bookings.
    expect((await checkin.lookupScan(code, { businessId: a.business.id, staffMemberId: "someone-else" })).state).toBe("not-found");
    // Forged: right shape, not ours.
    expect((await checkin.lookupScan("A".repeat(43), scopeOf(a.business.id))).state).toBe("not-found");
    expect((await checkin.lookupScan("not a code", scopeOf(a.business.id))).state).toBe("not-found");
    // Replaced: the old code stops at once; the new one works.
    const fresh = (await checkin.replaceCheckInCode(b.id))!;
    expect(fresh.code).not.toBe(code);
    expect((await checkin.lookupScan(code, scopeOf(a.business.id))).state).toBe("not-found");
    expect((await checkin.lookupScan(fresh.code, scopeOf(a.business.id))).state).toBe("valid");
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
  });

  it("6/13: a pending booking gets no code; a booking hours away is too early to check in", async () => {
    const a = await business("pending");
    const p = await booking(a, "PENDING");
    expect(await checkin.currentCheckInCode(p.id)).toBeNull();
    const later = await booking(a, "CONFIRMED", 4 * 60);
    const { code } = (await checkin.currentCheckInCode(later.id))!;
    const r = await checkin.checkIn(code, scopeOf(a.business.id), a.owner.id);
    expect(r.state).toBe("too-early");
    expect((await db.booking.findUniqueOrThrow({ where: { id: later.id } })).status).toBe("CONFIRMED");
  });

  // ─── Visitor passes ───────────────────────────────────────────────────

  it("5/10/11: a confirmed booking may ASK for a pass; the provider issues it; guests get their own, within the limit", async () => {
    const a = await business("pass");
    await venue("pass", a, { maxGuests: 2 });
    const b = await booking(a, "CONFIRMED", 60);
    // A confirmed booking issues nothing by itself.
    expect(await db.bookingGuest.count({ where: { bookingId: b.id } })).toBe(0);
    expect((await passes.bookingAccessView(b.id)).eligibility.eligible).toBe(true);

    expect(await passes.requestPass(b.id, { displayName: "منى أحمد", phoneE164: null, userId: null })).toEqual({ ok: true });
    let view = await passes.bookingAccessView(b.id);
    expect(view.holder?.state).toBe("pending"); // not active until the provider says so
    expect(view.holder?.pass).toBeNull();
    await drain(1);
    view = await passes.bookingAccessView(b.id);
    expect(view.holder?.state).toBe("active");
    expect(view.holder?.pass?.token).toMatch(/^SANDBOX-/);
    expect(view.holder?.pass?.sandbox).toBe(true);

    const g1 = await passes.addGuest(b.id, { displayName: "علي", phoneE164: null });
    const g2 = await passes.addGuest(b.id, { displayName: "سارة", phoneE164: null });
    expect(g1.ok && g2.ok).toBe(true);
    expect(await passes.addGuest(b.id, { displayName: "ثالث", phoneE164: null })).toMatchObject({ ok: false, code: "limit" });
    await drain(1);
    view = await passes.bookingAccessView(b.id);
    const tokens = [view.holder!, ...view.guests].map((v) => v.pass?.token);
    expect(new Set(tokens).size).toBe(3); // separate credentials
    expect(view.guests.every((g) => g.state === "active" && g.inviteToken)).toBe(true);
    // A guest's own link shows only their own pass.
    const guestView = await passes.guestPassView(g1.inviteToken!);
    expect(guestView?.pass.displayName).toBe("علي");
    expect(JSON.stringify(guestView)).not.toContain("منى");
    // Stored sealed: no plaintext token in the database.
    const creds = await db.accessCredential.findMany({ where: { entitlement: { bookingId: b.id } } });
    for (const c of creds) {
      expect(c.tokenCiphertext).toBeTruthy();
      expect(JSON.stringify(c)).not.toContain("SANDBOX-");
    }
  });

  it("6: a pending booking cannot ask for a pass; a venue that needs a phone refuses a guest without one", async () => {
    const a = await business("pending-pass");
    await venue("pending-pass", a, { phone: true });
    const p = await booking(a, "PENDING", 60);
    expect(await passes.requestPass(p.id, { displayName: "منى", phoneE164: "+201012345678", userId: null })).toMatchObject({ ok: false, code: "ineligible", reason: "booking-pending" });
    const c = await booking(a, "CONFIRMED", 120);
    expect(await passes.requestPass(c.id, { displayName: "منى", phoneE164: "+201012345678", userId: null })).toEqual({ ok: true });
    expect(await passes.addGuest(c.id, { displayName: "علي", phoneE164: null })).toMatchObject({ ok: false, code: "phone-required" });
  });

  it("7/8/25: cancelling withdraws at once locally; the provider's acknowledgement completes the revocation, all recorded", async () => {
    const a = await business("cancel");
    const { venue: v } = await venue("cancel", a);
    const b = await booking(a, "CONFIRMED", 60);
    const code = (await checkin.currentCheckInCode(b.id))!.code;
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const token = (await passes.bookingAccessView(b.id)).holder!.pass!.token;

    const move = await state.moveBooking({ bookingId: b.id, from: "CONFIRMED", to: "CANCELLED", by: "customer" });
    expect(move.moved).toBe(true);
    // Immediately, before any provider call: the code is withdrawn, and the
    // desk is told the booking was cancelled (it cannot check in)…
    expect((await db.bookingCheckIn.findUniqueOrThrow({ where: { bookingId: b.id } })).status).toBe("REVOKED");
    expect((await checkin.lookupScan(code, scopeOf(a.business.id))).state).toBe("cancelled");
    expect((await checkin.checkIn(code, scopeOf(a.business.id), a.owner.id)).state).toBe("cancelled");
    // …and the pass is no longer shown or usable on Maw3ed's side.
    const ent = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(ent).toMatchObject({ status: "REVOKED", reason: "booking-cancelled" });
    const c1 = await db.accessCredential.findFirstOrThrow({ where: { entitlementId: ent.id } });
    expect(c1.status).toBe("REVOKE_PENDING");
    expect((await passes.bookingAccessView(b.id)).holder?.pass ?? null).toBeNull();

    await drain(1);
    const c2 = await db.accessCredential.findUniqueOrThrow({ where: { id: c1.id } });
    expect(c2.status).toBe("REVOKED");
    expect((await db.accessRevocation.findFirstOrThrow({ where: { credentialId: c1.id } })).confirmedAt).not.toBeNull();
    // The provider no longer lets it in.
    expect((await sandbox.sandboxGateScan(token, `G1-cancel`, new Date(), "SITE-cancel")).reason).toBe("revoked");
    const kinds = (await db.accessEvent.findMany({ where: { venueId: v.id }, orderBy: { receivedAt: "asc" } })).map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(["CREDENTIAL_ACTIVE", "CREDENTIAL_REVOKED"]));
  });

  it("9: rescheduling moves the pass: a new version is sent and confirmed; a move back to pending holds it", async () => {
    const a = await business("move");
    await venue("move", a);
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const before = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });

    const newStart = new Date(b.startsAt!.getTime() + 2 * 60 * 60_000);
    const newEnd = new Date(newStart.getTime() + 60 * 60_000);
    await db.booking.update({ where: { id: b.id }, data: { startsAt: newStart, endsAt: newEnd, startTime: newStart.toISOString().slice(11, 16), endTime: newEnd.toISOString().slice(11, 16) } });
    const { accessAfterReschedule } = await import("./hooks");
    await accessAfterReschedule(b.id);
    const after = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(after.version).toBe(before.version + 1);
    expect(after.validFrom.getTime() - before.validFrom.getTime()).toBe(2 * 60 * 60_000);
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("updating");
    await drain(1);
    const cred = (await live(b.id))[0];
    expect(cred).toMatchObject({ status: "ACTIVE", version: after.version, confirmedVersion: after.version });
    const remote = await db.sandboxAccessPass.findUniqueOrThrow({ where: { providerRef: cred.providerRef! } });
    expect(remote.validFrom.getTime()).toBe(after.validFrom.getTime());

    // A customer's move that the business must confirm again (status back
    // to PENDING) holds the pass — recoverable, not revoked…
    await db.booking.update({ where: { id: b.id }, data: { status: "PENDING" } });
    await accessAfterReschedule(b.id);
    expect(await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } })).toMatchObject({ status: "SUSPENDED", reason: "booking-pending" });
    expect((await live(b.id))[0].status).toBe("REVOKE_PENDING");
    await drain(1);
    // …and confirming it issues a fresh pass.
    await state.moveBooking({ bookingId: b.id, from: "PENDING", to: "CONFIRMED", by: "business" });
    await drain(1);
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("active");
    expect(await db.accessCredential.count({ where: { entitlement: { bookingId: b.id } } })).toBe(2);
  });

  it("12: a pass works only at its own venue's gates, once, without re-entry unless allowed", async () => {
    const a = await business("gates");
    await venue("gates", a, { reentry: false });
    await venue("other", null);
    const b = await booking(a, "CONFIRMED", 10);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const token = (await passes.bookingAccessView(b.id)).holder!.pass!.token;
    expect((await sandbox.sandboxGateScan(token, "G1-other", new Date(), "SITE-other")).reason).toBe("wrong-site");
    expect((await sandbox.sandboxGateScan(token, "G9-gates", new Date(), "SITE-gates")).reason).toBe("wrong-gate");
    const ok = await sandbox.sandboxGateScan(token, "G1-gates", new Date(), "SITE-gates");
    expect(ok.granted).toBe(true);
    expect(await events.ingestProviderEvent("sandbox", ok.event!.raw, ok.event!.headers)).toBe("accepted");
    // Anti-passback, then no re-entry after leaving.
    expect((await sandbox.sandboxGateScan(token, "G1-gates", new Date(), "SITE-gates")).reason).toBe("already-inside");
    await sandbox.sandboxGateExit(token, "G1-gates");
    expect((await sandbox.sandboxGateScan(token, "G1-gates", new Date(), "SITE-gates")).reason).toBe("no-reentry");
    const entry = await db.accessEvent.findFirstOrThrow({ where: { kind: "ENTRY_GRANTED", credential: { entitlement: { bookingId: b.id } } } });
    expect(entry.gateId).not.toBeNull();
  });

  it("13: expiry is reached by the cron without a provider call, and the gate refuses too", async () => {
    const a = await business("expire");
    await venue("expire", a);
    const b = await booking(a, "CONFIRMED", 10);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const token = (await passes.bookingAccessView(b.id)).holder!.pass!.token;
    const later = new Date(Date.now() + 3 * 60 * 60_000);
    await reconcile.reconcileAccess({ now: later, batch: 500 });
    const ent = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(ent).toMatchObject({ status: "EXPIRED", reason: "window-passed" });
    expect((await db.accessCredential.findFirstOrThrow({ where: { entitlementId: ent.id } })).status).toBe("EXPIRED");
    expect(await db.accessSyncJob.count({ where: { credential: { entitlementId: ent.id }, kind: "REVOKE" } })).toBe(0);
    expect((await sandbox.sandboxGateScan(token, "G1-expire", later, "SITE-expire")).reason).toBe("expired");
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("expired");
  });

  it("14/16: a forged callback is refused; the same callback twice is applied once", async () => {
    const a = await business("callback");
    await venue("callback", a);
    const b = await booking(a, "CONFIRMED", 10);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const token = (await passes.bookingAccessView(b.id)).holder!.pass!.token;
    const g = await sandbox.sandboxGateScan(token, "G1-callback", new Date(), "SITE-callback");
    // Forged: body altered after signing; and a stale signature.
    const forged = g.event!.raw.replace("ENTRY_GRANTED", "ENTRY_DENIED");
    expect(await events.ingestProviderEvent("sandbox", forged, g.event!.headers)).toBe("invalid");
    const stale = sandbox.signedSandboxEvent(JSON.parse(g.event!.raw), Math.floor(Date.now() / 1000) - 3600);
    expect(await events.ingestProviderEvent("sandbox", stale.raw, stale.headers)).toBe("invalid");
    // Delivered twice (a provider retry), and concurrently.
    const outcomes = await Promise.all([1, 2, 3].map(() => events.ingestProviderEvent("sandbox", g.event!.raw, g.event!.headers)));
    expect(outcomes.filter((o) => o === "accepted")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "duplicate")).toHaveLength(2);
    const id = JSON.parse(g.event!.raw).id as string;
    expect(await db.accessEvent.count({ where: { providerEventId: id } })).toBe(1);
    expect(await events.ingestProviderEvent("no-such-provider", g.event!.raw, g.event!.headers)).toBe("unknown-provider");
  });

  it("17/24/25: an outage is retried with backoff, then dead-lettered as a visible failure the customer can retry — boundedly", async () => {
    const a = await business("outage");
    const { venue: v } = await venue("outage", a);
    const b = await booking(a, "CONFIRMED", 60);
    await sandbox.setSandboxMode("DOWN");
    try {
      await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
      const r1 = await runJobs();
      expect(r1).toMatchObject({ retried: 1, dead: 0 });
      const job = await db.accessSyncJob.findFirstOrThrow({ where: { credential: { entitlement: { bookingId: b.id } } } });
      expect(job.attempts).toBe(1);
      expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 20_000); // backed off
      // Not due: a second run does nothing (no hot loop).
      expect((await runJobs()).claimed).toBe(0);
      await drain(sync.MAX_ATTEMPTS + 2);
      const dead = await db.accessSyncJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(dead.status).toBe("DEAD");
      expect(dead.attempts).toBe(sync.MAX_ATTEMPTS);
      expect((await passes.bookingAccessView(b.id)).holder).toMatchObject({ state: "failed", canRetry: true });
      expect(await db.accessEvent.count({ where: { venueId: v.id, kind: "CREDENTIAL_FAILED" } })).toBe(1);
      // A failed pass is not re-issued behind the customer's back.
      await passes.syncBookingAccess(b.id);
      expect(await live(b.id)).toHaveLength(0);
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
    const holder = await db.bookingGuest.findFirstOrThrow({ where: { bookingId: b.id, role: "HOLDER" } });
    expect(await passes.retryPass(b.id, holder.id)).toEqual({ ok: true });
    await drain(1);
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("active");
    // Retries are bounded per pass.
    expect(passes.MAX_CREDENTIALS_PER_ENTITLEMENT).toBeLessThanOrEqual(5);
  });

  it("18: a provider that never answers is abandoned at the timeout and retried later", async () => {
    const a = await business("timeout");
    await venue("timeout", a);
    const b = await booking(a, "CONFIRMED", 60);
    await sandbox.setSandboxMode("TIMEOUT");
    try {
      await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
      const t0 = Date.now();
      const r = await runJobs({ timeoutMs: 800 });
      expect(Date.now() - t0).toBeLessThan(5_000);
      expect(r.retried).toBe(1);
      const job = await db.accessSyncJob.findFirstOrThrow({ where: { credential: { entitlement: { bookingId: b.id } } } });
      expect(job.lastError).toMatch(/timed out/);
      expect(job.leasedUntil).toBeNull();
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
    await drain(2); // the retry was scheduled for later; drain makes it due
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("active");
  });

  it("19: inconsistent provider answers never revive a withdrawn pass or roll back a newer version", async () => {
    const a = await business("inconsistent");
    await venue("inconsistent", a);
    const b = await booking(a, "CONFIRMED", 60);
    await sandbox.setSandboxMode("NO_CONFIRM");
    let cred;
    try {
      await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
      await drain(1);
      cred = (await live(b.id))[0];
      expect(cred).toMatchObject({ status: "PENDING_PROVIDER" }); // accepted, not confirmed
      expect(cred.providerRef).toBeTruthy();
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
    // Withdrawn on Maw3ed's side (cancelled) before the provider confirms…
    await state.moveBooking({ bookingId: b.id, from: "CONFIRMED", to: "CANCELLED", by: "business" });
    // …then the provider's late confirmation arrives: ignored.
    const late = await sandbox.confirmPendingSandboxPasses();
    for (const e of late) await events.ingestProviderEvent("sandbox", e.raw, e.headers);
    const after = await db.accessCredential.findUniqueOrThrow({ where: { id: cred.id } });
    expect(after.status).not.toBe("ACTIVE");
    await drain(1);
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: cred.id } })).status).toBe("REVOKED");

    // An older version's confirmation after a newer one: ignored.
    const c2 = await business("inconsistent-2");
    await venue("inconsistent-2", c2);
    const b2 = await booking(c2, "CONFIRMED", 60);
    await passes.requestPass(b2.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const active = (await live(b2.id))[0];
    await db.accessCredential.update({ where: { id: active.id }, data: { confirmedVersion: 3, version: 3 } });
    const old = sandbox.signedSandboxEvent({ id: `old-${tag}`, type: "CREDENTIAL_UPDATED", ref: active.providerRef, version: 1, at: new Date().toISOString() });
    expect(await events.ingestProviderEvent("sandbox", old.raw, old.headers)).toBe("accepted");
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: active.id } })).confirmedVersion).toBe(3);
  });

  it("21: provider calls are idempotent — a retried provision is the same pass; a change is queued once", async () => {
    const a = await business("idem");
    await venue("idem", a);
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await passes.syncBookingAccess(b.id);
    await passes.syncBookingAccess(b.id);
    expect(await db.accessSyncJob.count({ where: { credential: { entitlement: { bookingId: b.id } } } })).toBe(1);
    await drain(1);
    const cred = (await live(b.id))[0];
    const adapter = sandbox.sandboxAdapter;
    const req = { externalRef: cred.id, siteRef: "SITE-idem", holderLabel: "منى", holderPhone: null, validFrom: new Date(), validUntil: new Date(Date.now() + 3600_000), entryUntil: null, gateCodes: [], reentryAllowed: false, version: 1 };
    const again = await adapter.provision(req, { idempotencyKey: `${cred.id}:PROVISION:1`, correlationId: cred.correlationId, signal: new AbortController().signal });
    expect(again).toMatchObject({ outcome: "active", providerRef: cred.providerRef });
    expect(await db.sandboxAccessPass.count({ where: { externalRef: cred.id } })).toBe(1);
  });

  it("22: with no usable provider a venue offers nothing, and a partner without an integration is never called", async () => {
    const a = await business("nopartner");
    const partner = await db.accessProvider.create({ data: { slug: `${tag}-partner`, kind: "PARTNER", nameAr: "شريك بدون تكامل" } });
    ids.providers.push(partner.id);
    const { venue: v } = await venue("nopartner", a);
    await db.venue.update({ where: { id: v.id }, data: { accessProviderId: partner.id } });
    const b = await booking(a, "CONFIRMED", 60);
    const view = await passes.bookingAccessView(b.id);
    expect(view.eligibility).toMatchObject({ eligible: false });
    expect(await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null })).toMatchObject({ ok: false, reason: "no-usable-provider" });
    const { adapterFor, ProviderUnavailableError } = await import("./provider");
    await expect(adapterFor(partner)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("23: concurrent requests and syncs issue exactly one credential per person", async () => {
    const a = await business("race");
    await venue("race", a);
    const b = await booking(a, "CONFIRMED", 60);
    await Promise.all([1, 2, 3, 4].map(() => passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null })));
    await Promise.all([1, 2, 3, 4].map(() => passes.syncBookingAccess(b.id)));
    expect(await db.bookingGuest.count({ where: { bookingId: b.id, role: "HOLDER" } })).toBe(1);
    expect(await live(b.id)).toHaveLength(1);
    // Two workers on the same due jobs: each job runs once.
    await Promise.all([runJobs(), runJobs()]);
    expect(await db.sandboxAccessPass.count({ where: { externalRef: (await live(b.id))[0].id } })).toBe(1);
    // Two concurrent retries after a failure: one new credential.
    const cred = (await live(b.id))[0];
    await db.accessCredential.update({ where: { id: cred.id }, data: { status: "FAILED" } });
    const holder = await db.bookingGuest.findFirstOrThrow({ where: { bookingId: b.id, role: "HOLDER" } });
    await Promise.all([passes.retryPass(b.id, holder.id), passes.retryPass(b.id, holder.id)]);
    expect(await live(b.id)).toHaveLength(1);
  });

  it("24: a job run is bounded by its limit, and finished jobs never run again", async () => {
    const a = await business("bounded");
    await venue("bounded", a, { maxGuests: 5 });
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    for (const n of ["أ", "ب", "ج", "د"]) await passes.addGuest(b.id, { displayName: `ضيف ${n}`, phoneE164: null });
    const r = await runJobs({ limit: 2 });
    expect(r.claimed).toBeLessThanOrEqual(2);
    await drain(3);
    const done = await db.accessSyncJob.findMany({ where: { credential: { entitlement: { bookingId: b.id } } } });
    expect(done.every((j) => j.status === "DONE")).toBe(true);
    const attempts = done.map((j) => j.attempts);
    await drain(2);
    expect((await db.accessSyncJob.findMany({ where: { id: { in: done.map((j) => j.id) } } })).map((j) => j.attempts)).toEqual(attempts);
  });

  it("25: security holds and restores a pass with a reason, recorded with who did it; a cancelled booking stays off", async () => {
    const a = await business("security");
    const { venue: v } = await venue("security", a);
    const guard = await user("guard");
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const ent = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(await passes.securitySuspend(ent.id, v.id, guard.id, "suspicious behaviour")).toBe(true);
    expect((await db.accessEntitlement.findUniqueOrThrow({ where: { id: ent.id } })).status).toBe("SUSPENDED");
    expect((await live(b.id))[0].status).toBe("REVOKE_PENDING");
    await drain(1);
    // Another venue's desk cannot touch it.
    const { venue: other } = await venue("security-other", null);
    expect(await passes.securityReinstate(ent.id, other.id, guard.id, "nope")).toBe(false);
    expect(await passes.securityReinstate(ent.id, v.id, guard.id, "cleared by the supervisor")).toBe(true);
    await drain(1);
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("active");
    const ev = await db.accessEvent.findMany({ where: { entitlementId: ent.id, kind: { in: ["OVERRIDE_SUSPEND", "OVERRIDE_REINSTATE"] } } });
    expect(ev.map((e) => [e.kind, e.actorUserId, e.reason])).toEqual(
      expect.arrayContaining([
        ["OVERRIDE_SUSPEND", guard.id, "suspicious behaviour"],
        ["OVERRIDE_REINSTATE", guard.id, "cleared by the supervisor"],
      ]),
    );
    // Suspended, then the booking is cancelled: reinstating cannot bring it back.
    await passes.securitySuspend(ent.id, v.id, guard.id, "again");
    await state.moveBooking({ bookingId: b.id, from: "CONFIRMED", to: "CANCELLED", by: "business" });
    expect(await passes.securityReinstate(ent.id, v.id, guard.id, "try")).toBe(false);
    expect((await db.accessEntitlement.findUniqueOrThrow({ where: { id: ent.id } })).status).toBe("REVOKED");
  });

  it("venue changes: switching passes off holds them (recoverable); back on, they are issued again", async () => {
    const a = await business("toggle");
    const { venue: v } = await venue("toggle", a);
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    await db.venue.update({ where: { id: v.id }, data: { accessEnabled: false } });
    await passes.syncBookingAccess(b.id);
    expect(await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } })).toMatchObject({ status: "SUSPENDED", reason: "venue-access-off" });
    await drain(1);
    await db.venue.update({ where: { id: v.id }, data: { accessEnabled: true } });
    await passes.syncBookingAccess(b.id);
    await drain(1);
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("active");
    // A business paused by the platform holds its visitors' passes the same way.
    await db.business.update({ where: { id: a.business.id }, data: { status: "SUSPENDED" } });
    await passes.syncBookingAccess(b.id);
    expect(await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } })).toMatchObject({ status: "SUSPENDED", reason: "business-unavailable" });
  });

  // ─── Review findings (Phase 23 code review) ───────────────────────────

  it("R1: a security hold survives other temporary reasons and is lifted only by the desk", async () => {
    const a = await business("r1");
    const { venue: v } = await venue("r1", a);
    const guard = await user("r1-guard");
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const ent = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });
    await passes.securitySuspend(ent.id, v.id, guard.id, "hold");
    await drain(1);
    // The venue switches passes off and on again; the booking goes pending and back.
    await db.venue.update({ where: { id: v.id }, data: { accessEnabled: false } });
    await passes.syncBookingAccess(b.id);
    await db.venue.update({ where: { id: v.id }, data: { accessEnabled: true } });
    await db.booking.update({ where: { id: b.id }, data: { status: "PENDING" } });
    await passes.syncBookingAccess(b.id);
    await state.moveBooking({ bookingId: b.id, from: "PENDING", to: "CONFIRMED", by: "business" });
    await drain(1);
    expect(await db.accessEntitlement.findUniqueOrThrow({ where: { id: ent.id } })).toMatchObject({ status: "SUSPENDED", reason: "security-override" });
    expect(await live(b.id)).toHaveLength(0);
    expect(await passes.securityReinstate(ent.id, v.id, guard.id, "cleared")).toBe(true);
    await drain(1);
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("active");
  });

  it("R2: a pass the provider issued but whose confirmation was lost is recovered, not failed", async () => {
    const a = await business("r2");
    await venue("r2", a);
    const b = await booking(a, "CONFIRMED", 60);
    await sandbox.setSandboxMode("NO_CONFIRM");
    try {
      await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
      await drain(1);
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
    const cred = (await live(b.id))[0];
    expect(cred.status).toBe("PENDING_PROVIDER");
    // The provider confirms on its side, and the callback never arrives.
    await db.sandboxAccessPass.update({ where: { providerRef: cred.providerRef! }, data: { status: "ACTIVE" } });
    await db.accessCredential.update({ where: { id: cred.id }, data: { updatedAt: new Date(Date.now() - 20 * 60_000) } });
    const r = await reconcile.reconcileAccess({ batch: 500 });
    expect(r.stale.recovered).toBeGreaterThanOrEqual(1);
    const after = await db.accessCredential.findUniqueOrThrow({ where: { id: cred.id } });
    expect(after.status).toBe("ACTIVE");
    expect((await passes.bookingAccessView(b.id)).holder?.pass?.token).toMatch(/^SANDBOX-/);
    expect(await db.sandboxAccessPass.count({ where: { externalRef: cred.id } })).toBe(1);
  });

  it("R2b: an event for a credential not known yet is not recorded, so the provider retries it", async () => {
    const ev = sandbox.signedSandboxEvent({ id: `early-${tag}`, type: "CREDENTIAL_ACTIVE", ref: "sbx_not_yet_known", at: new Date().toISOString() });
    expect(await events.ingestProviderEvent("sandbox", ev.raw, ev.headers)).toBe("unknown-credential");
    expect(await db.accessEvent.count({ where: { providerEventId: `early-${tag}` } })).toBe(0);
  });

  it("R4: a withdrawal the provider never confirmed is asked again later, boundedly, and then a new pass can be issued", async () => {
    const a = await business("r4");
    const { venue: v } = await venue("r4", a);
    const guard = await user("r4-guard");
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const ent = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });
    await sandbox.setSandboxMode("DOWN");
    try {
      await passes.securitySuspend(ent.id, v.id, guard.id, "hold during an outage");
      await drain(sync.MAX_ATTEMPTS + 2);
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
    const cred = (await db.accessCredential.findMany({ where: { entitlementId: ent.id } }))[0];
    expect(cred.status).toBe("REVOKE_PENDING");
    expect(await db.accessEvent.count({ where: { credentialId: cred.id, kind: "ESCALATION" } })).toBe(1);
    // An hour later the cron asks again; the provider is back, so it completes.
    await db.accessCredential.update({ where: { id: cred.id }, data: { updatedAt: new Date(Date.now() - 2 * 60 * 60_000) } });
    const r = await reconcile.reconcileAccess({ batch: 500 });
    expect(r.revokeRounds).toBeGreaterThanOrEqual(1);
    await drain(1);
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: cred.id } })).status).toBe("REVOKED");
    await passes.securityReinstate(ent.id, v.id, guard.id, "cleared");
    await drain(1);
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("active");
  });

  it("R5: an update the provider never takes withdraws the old pass, and a pass for the new time is issued", async () => {
    const a = await business("r5");
    await venue("r5", a);
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const first = (await live(b.id))[0];
    const newStart = new Date(b.startsAt!.getTime() + 2 * 60 * 60_000);
    await db.booking.update({ where: { id: b.id }, data: { startsAt: newStart, endsAt: new Date(newStart.getTime() + 60 * 60_000) } });
    await sandbox.setSandboxMode("DOWN");
    try {
      const { accessAfterReschedule } = await import("./hooks");
      await accessAfterReschedule(b.id);
      await drain(sync.MAX_ATTEMPTS + 2);
      expect((await db.accessCredential.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("REVOKE_PENDING");
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
    // The withdrawal (its own job) gets through once the provider is back;
    // the old pass no longer opens the gate.
    await db.accessSyncJob.updateMany({ where: { credentialId: first.id, kind: "REVOKE", status: "DEAD" }, data: { status: "PENDING", attempts: 0 } });
    await drain(2);
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("REVOKED");
    await passes.syncBookingAccess(b.id);
    await drain(1);
    const fresh = (await live(b.id))[0];
    expect(fresh.id).not.toBe(first.id);
    expect(fresh.status).toBe("ACTIVE");
    const remote = await db.sandboxAccessPass.findUniqueOrThrow({ where: { providerRef: fresh.providerRef! } });
    const ent = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(remote.validFrom.getTime()).toBe(ent.validFrom.getTime());
  });

  it("R8: passes withdrawn and re-issued by venue changes do not use up the customer's retries", async () => {
    const a = await business("r8");
    const { venue: v } = await venue("r8", a);
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    for (let i = 0; i < passes.MAX_CREDENTIALS_PER_ENTITLEMENT + 1; i++) {
      await db.venue.update({ where: { id: v.id }, data: { accessEnabled: false } });
      await passes.syncBookingAccess(b.id);
      await drain(1);
      await db.venue.update({ where: { id: v.id }, data: { accessEnabled: true } });
      await passes.syncBookingAccess(b.id);
      await drain(1);
    }
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("active");
  });

  it("R4b: after the last round the withdrawal is closed with an escalation, and the person can be issued a pass again", async () => {
    const a = await business("r4b");
    const { venue: v } = await venue("r4b", a);
    const guard = await user("r4b-guard");
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const ent = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });
    await sandbox.setSandboxMode("DOWN");
    try {
      await passes.securitySuspend(ent.id, v.id, guard.id, "hold");
      await drain(sync.MAX_ATTEMPTS + 2);
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
    const cred = (await db.accessCredential.findMany({ where: { entitlementId: ent.id } }))[0];
    // As if every hourly round had already been tried and died.
    await db.accessSyncJob.createMany({
      data: Array.from({ length: reconcile.REVOKE_ROUNDS }, (_, i) => ({
        credentialId: cred.id, kind: "REVOKE" as const, status: "DEAD" as const, idempotencyKey: `${cred.id}:REVOKE:x:${i}`, correlationId: cred.correlationId,
      })),
    });
    await db.accessCredential.update({ where: { id: cred.id }, data: { updatedAt: new Date(Date.now() - 2 * 60 * 60_000) } });
    await reconcile.reconcileAccess({ batch: 500 });
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: cred.id } })).status).toBe("REVOKED");
    expect(await db.accessEvent.count({ where: { credentialId: cred.id, kind: "ESCALATION" } })).toBe(2);
    await passes.securityReinstate(ent.id, v.id, guard.id, "cleared");
    await drain(1);
    expect((await passes.bookingAccessView(b.id)).holder?.state).toBe("active");
  });
  // ─── Post-phase audit (docs/qa/PHASE_23_POST_AUDIT.md, A1–A12) ────────
  // Each fails on the code before the audit's fix. Watchdog: every test
  // has its own timeout, so a real loop fails instead of hanging the run.

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function activePass(n: string) {
    const a = await business(n);
    const v = await venue(n, a);
    const b = await booking(a, "CONFIRMED", 60);
    await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
    await drain(1);
    const c = (await live(b.id))[0];
    expect(c.status).toBe("ACTIVE");
    const full = await db.accessCredential.findUniqueOrThrow({ where: { id: c.id }, include: { entitlement: { select: { venueId: true } } } });
    return { a, v, b, c, full };
  }

  it("A1: a provider confirmation racing a withdrawal never revives the withdrawn pass", async () => {
    const { c, full } = await activePass("a1");
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    // The withdrawal holds the row, uncommitted, while the confirmation arrives.
    const withdrawing = db.$transaction(async (tx) => {
      await sync.withdrawCredential(tx, c, "booking-cancelled", "race", new Date());
      await gate;
    }, { timeout: 10_000 });
    await sleep(200);
    const activating = sync.activate(full, { token: null, displayFormat: null, expiresAt: null, version: c.version }, new Date(), null);
    await sleep(300);
    release();
    await withdrawing;
    expect(await activating).toBe(false);
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("REVOKE_PENDING");
    expect(await db.accessSyncJob.count({ where: { credentialId: c.id, kind: "REVOKE" } })).toBe(1);
  }, 30_000);

  it("A2: a refused update withdraws the pass the provider still holds, instead of leaving it valid", async () => {
    const { c, full } = await activePass("a2");
    await sync.applyIssue(full, { outcome: "refused", reason: "update not allowed" }, new Date());
    const after = await db.accessCredential.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.status).toBe("REVOKE_PENDING");
    expect(await db.accessSyncJob.count({ where: { credentialId: c.id, kind: "REVOKE" } })).toBe(1);
    await drain(1);
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("REVOKED");
    expect((await db.sandboxAccessPass.findUniqueOrThrow({ where: { providerRef: c.providerRef! } })).status).not.toBe("ACTIVE");
  }, 30_000);

  it("A4: a retry racing a cancellation issues nothing", async () => {
    const a = await business("a4");
    await venue("a4", a);
    const b = await booking(a, "CONFIRMED", 60);
    await sandbox.setSandboxMode("REFUSE");
    try {
      await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
      await drain(1);
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
    const holder = await db.bookingGuest.findFirstOrThrow({ where: { bookingId: b.id, role: "HOLDER" }, include: { entitlement: true } });
    expect((await db.accessCredential.findFirstOrThrow({ where: { entitlementId: holder.entitlement!.id } })).status).toBe("FAILED");
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    // A cancellation holds the booking's access lock, its entitlement ended but not committed.
    const cancelling = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`access:${b.id}`}, 0))`;
      await tx.accessEntitlement.update({ where: { id: holder.entitlement!.id }, data: { status: "REVOKED", reason: "booking-cancelled" } });
      await gate;
    }, { timeout: 10_000 });
    await sleep(200);
    const retrying = passes.retryPass(b.id, holder.id);
    await sleep(500);
    release();
    await cancelling;
    await retrying;
    expect(await live(b.id)).toHaveLength(0);
  }, 30_000);

  it("A5: suspending a business reaches its passes at once, not on the cron's round-robin", async () => {
    const { a, b } = await activePass("a5");
    const { accessAfterBusinessChange } = await import("./hooks");
    afterQueue.length = 0;
    await db.business.update({ where: { id: a.business.id }, data: { status: "SUSPENDED" } });
    await accessAfterBusinessChange(a.business.id);
    for (const fn of afterQueue.splice(0)) await fn();
    expect(await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } })).toMatchObject({ status: "SUSPENDED", reason: "business-unavailable" });
    expect((await live(b.id))[0]?.status).toBe("REVOKE_PENDING");
  }, 30_000);

  it("A7: a job that cannot be processed does not stop the run, and one interrupted on its last attempt is given up without another call", async () => {
    // Interrupted on its last attempt: claimed again, it is ended, not re-run.
    const a = await business("a7");
    await venue("a7", a);
    const b = await booking(a, "CONFIRMED", 60);
    await sandbox.setSandboxMode("DOWN");
    try {
      await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
      await runJobs();
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
    const cred = (await live(b.id))[0];
    await db.accessSyncJob.updateMany({ where: { credentialId: cred.id }, data: { attempts: sync.MAX_ATTEMPTS, leasedUntil: new Date(0), nextAttemptAt: new Date(0) } });
    await runJobs();
    const job = await db.accessSyncJob.findFirstOrThrow({ where: { credentialId: cred.id, kind: "PROVISION" } });
    expect(job.status).toBe("DEAD");
    // It may have reached the provider before the process stopped, so it is
    // withdrawn: the REVOKE job learns what the provider holds and revokes it.
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: cred.id } })).status).toBe("REVOKE_PENDING");
    await drain(2);
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: cred.id } })).status).toBe("REVOKED");
    const remote = await db.sandboxAccessPass.findMany({ where: { externalRef: cred.id } });
    expect(remote.every((p) => p.status !== "ACTIVE")).toBe(true);

    // A job whose processing throws (not a provider failure): the next job still runs.
    const one = await activePass("a7-one");
    const two = await activePass("a7-two");
    for (const x of [one, two]) {
      await db.accessSyncJob.create({ data: { credentialId: x.c.id, kind: "UPDATE", idempotencyKey: `${x.c.id}:a7`, correlationId: x.c.correlationId, nextAttemptAt: new Date(0) } });
      await db.accessCredential.update({ where: { id: x.c.id }, data: { version: { increment: 1 } } });
    }
    const real = db.accessCredential.findUnique.bind(db.accessCredential);
    let thrown = 0;
    const spy = vi.spyOn(db.accessCredential, "findUnique").mockImplementation(((args: { where: { id?: string } }) => {
      if (args.where.id === one.c.id) {
        thrown++;
        return Promise.reject(new Error("a bad row")) as never;
      }
      return real(args as never) as never;
    }) as never);
    try {
      await runJobs();
    } finally {
      spy.mockRestore();
    }
    expect(thrown).toBe(1);
    const poisoned = await db.accessSyncJob.findUniqueOrThrow({ where: { idempotencyKey: `${one.c.id}:a7` } });
    expect(poisoned.status).toBe("PENDING");
    expect(poisoned.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(poisoned.leasedUntil).toBeNull();
    expect((await db.accessSyncJob.findUniqueOrThrow({ where: { idempotencyKey: `${two.c.id}:a7` } })).status).toBe("DONE");
  }, 60_000);

  it("A9: an update still waiting for the provider's reference when out of attempts is withdrawn, not dropped silently", async () => {
    const { c } = await activePass("a9");
    await db.accessCredential.update({ where: { id: c.id }, data: { providerRef: null, version: { increment: 1 } } });
    await db.accessSyncJob.create({ data: { credentialId: c.id, kind: "UPDATE", idempotencyKey: `${c.id}:a9`, correlationId: c.correlationId, attempts: sync.MAX_ATTEMPTS - 1, nextAttemptAt: new Date(0) } });
    await runJobs();
    expect((await db.accessSyncJob.findUniqueOrThrow({ where: { idempotencyKey: `${c.id}:a9` } })).status).toBe("DEAD");
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("REVOKE_PENDING");
    expect(await db.accessEvent.count({ where: { credentialId: c.id, kind: "PROVIDER_ERROR" } })).toBe(1);
  }, 30_000);

  it("A11: a booking moved to a later time after its old window passed keeps its pass, moved", async () => {
    const { b } = await activePass("a11");
    const ent = await db.accessEntitlement.findFirstOrThrow({ where: { bookingId: b.id } });
    // As if the old window has just passed, and the business then moved the booking to later today.
    await db.accessEntitlement.update({ where: { id: ent.id }, data: { validFrom: new Date(Date.now() - 2 * 60 * 60_000), validUntil: new Date(Date.now() - 60_000), entryUntil: null } });
    await passes.syncBookingAccess(b.id);
    const after = await db.accessEntitlement.findUniqueOrThrow({ where: { id: ent.id } });
    expect(after.status).toBe("ELIGIBLE");
    expect(after.validUntil.getTime()).toBeGreaterThan(Date.now());
    expect(after.version).toBe(ent.version + 1);
  }, 30_000);

  it("A12: a changed first name reaches the provider as a new version; a change it is never sent does not", async () => {
    const { b, c } = await activePass("a12");
    await passes.requestPass(b.id, { displayName: "منة", phoneE164: null, userId: null });
    await drain(1);
    const after = await db.accessCredential.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.confirmedVersion).toBe(c.version + 1);
    expect((await db.sandboxAccessPass.findUniqueOrThrow({ where: { providerRef: c.providerRef! } })).holderLabel).toBe("منة");
    // A surname only (the provider gets the first name): nothing to send.
    await passes.requestPass(b.id, { displayName: "منة محمود", phoneE164: null, userId: null });
    expect((await db.accessCredential.findUniqueOrThrow({ where: { id: c.id } })).version).toBe(after.version);
  }, 30_000);

  it("A13: an update waiting on a provision that is still trying waits for it, without using its own attempts", async () => {
    const a = await business("a13");
    await venue("a13", a);
    const b = await booking(a, "CONFIRMED", 60);
    await sandbox.setSandboxMode("DOWN");
    try {
      await passes.requestPass(b.id, { displayName: "منى", phoneE164: null, userId: null });
      const cred = (await live(b.id))[0];
      await db.accessSyncJob.create({ data: { credentialId: cred.id, kind: "UPDATE", idempotencyKey: `${cred.id}:a13`, correlationId: cred.correlationId, attempts: sync.MAX_ATTEMPTS - 1, nextAttemptAt: new Date(0) } });
      await runJobs();
      const update = await db.accessSyncJob.findUniqueOrThrow({ where: { idempotencyKey: `${cred.id}:a13` } });
      expect(update.status).toBe("PENDING");
      expect(update.attempts).toBe(sync.MAX_ATTEMPTS - 1);
      expect((await db.accessCredential.findUniqueOrThrow({ where: { id: cred.id } })).status).toBe("PENDING_PROVIDER");
    } finally {
      await sandbox.setSandboxMode("NORMAL");
    }
  }, 30_000);

  it("loops: the cron converges — with nothing changing, repeated runs queue and call nothing", async () => {
    await activePass("conv");
    await reconcile.reconcileAccess({ batch: 500 });
    await drain(1);
    const jobs = await db.accessSyncJob.count();
    const events = await db.accessEvent.count();
    for (let i = 0; i < 3; i++) await reconcile.reconcileAccess({ batch: 500 });
    expect(await db.accessSyncJob.count()).toBe(jobs);
    expect(await db.accessEvent.count()).toBe(events);
  }, 120_000);
});
