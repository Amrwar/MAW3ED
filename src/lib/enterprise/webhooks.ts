import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { flagOn } from "@/lib/flags";
import { openWith, sealWith } from "@/lib/access/crypto";
import { contractInForce } from "./auth";
import { orgAudit, type Actor } from "./clients";
import { isWebhookEvent } from "./scopes";
import { checkPublicUrl, postPinned } from "./ssrf";
import { seesBookings, visibleBusinesses } from "./visibility";

/**
 * Outgoing webhooks (docs/enterprise/INTEGRATION_GUIDE.md).
 *
 *  - Events come from a change feed, not from every write path: each run
 *    reads the bookings an endpoint may see, changed after its cursor
 *    (updatedAt, id), at most FEED_BATCH per endpoint, and queues one
 *    delivery per change. (endpointId, eventId) is unique, so the same
 *    change is queued once however often it is read.
 *  - A delivery is claimed with a lease before it is sent, and the attempt
 *    is counted at the claim: a send that never returns still spends one.
 *    Retries back off 1 min … 12 h and stop at MAX_ATTEMPTS (DEAD).
 *  - An endpoint that fails MAX_CONSECUTIVE_FAILURES times in a row is
 *    switched off and the organization's trail says why.
 *  - Every request is signed: Maw3ed-Signature: t=<unix>,v1=<hex HMAC-SHA256
 *    of "t.body">, with a second v1 for the previous secret during a
 *    rotation. Payloads carry ids, times and statuses — never a
 *    customer's name, phone or email.
 */

export const MAX_ATTEMPTS = 8;
export const MAX_CONSECUTIVE_FAILURES = 20;
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 3_600_000, 6 * 3_600_000, 12 * 3_600_000];
const LEASE_MS = 2 * 60_000;
const SEND_TIMEOUT_MS = 5_000;
const FEED_BATCH = 200;

/** Pure: when attempt n (1-based, just failed) is tried again; null = give up. */
export function retryAt(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]);
}

/** Pure: the signature header for a body, under one or two secrets. */
export function signatureHeader(body: string, timestamp: number, secrets: string[]): string {
  const sigs = secrets.map((s) => `v1=${createHmac("sha256", s).update(`${timestamp}.${body}`).digest("hex")}`);
  return [`t=${timestamp}`, ...sigs].join(",");
}

/** For receivers (and our tests): does a header match this secret within 5 minutes? */
export function verifySignature(body: string, header: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  let t = NaN;
  const given: string[] = [];
  for (const p of header.split(",")) {
    const [k, v] = p.split("=");
    if (k === "t") t = Number(v);
    else if (k === "v1" && v && /^[0-9a-f]{64}$/.test(v)) given.push(v);
  }
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > 300) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"), "hex");
  return given.some((v) => timingSafeEqual(Buffer.from(v, "hex"), expected));
}

// ─── Managing endpoints ──────────────────────────────────────────────────────

export type EndpointResult =
  | { ok: true; id: string; secret: string }
  | { ok: false; why: "no-contract" | "limit" | "bad-url" | "bad-events" | "no-key" | "not-found"; detail?: string };

function newSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export async function createEndpoint(
  organizationId: string,
  input: { url: string; events: string[] },
  actor: Actor,
  now: Date = new Date(),
): Promise<EndpointResult> {
  const events = [...new Set(input.events)];
  if (events.length === 0 || !events.every(isWebhookEvent)) return { ok: false, why: "bad-events" };
  const checked = await checkPublicUrl(input.url);
  if (!checked.ok) return { ok: false, why: "bad-url", detail: checked.why };
  const secret = newSecret();
  const sealed = sealWith("webhook-secret", secret);
  if (!sealed) return { ok: false, why: "no-key" };
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VenueOrganization" WHERE "id" = ${organizationId} FOR UPDATE`;
    const contract = await tx.organizationContract.findUnique({ where: { organizationId } });
    if (!contractInForce(contract, now)) return { ok: false as const, why: "no-contract" as const };
    const count = await tx.webhookEndpoint.count({ where: { organizationId } });
    if (count >= contract!.maxWebhooks) return { ok: false as const, why: "limit" as const };
    const row = await tx.webhookEndpoint.create({
      // The feed starts now: an endpoint is sent what changes from here on,
      // not the organization's history.
      data: { organizationId, url: checked.url.toString(), events, secretSealed: sealed, cursorAt: now, createdById: actor.id },
      select: { id: true },
    });
    await orgAudit(organizationId, actor, "org.webhook.create", `Webhook endpoint ${checked.url.host} added for ${events.join(", ")}`, { endpointId: row.id, host: checked.url.host, events });
    return { ok: true as const, id: row.id, secret };
  });
}

/** A new secret; the previous one is still signed with for 24 hours. */
export async function rotateEndpointSecret(organizationId: string, endpointId: string, actor: Actor, now: Date = new Date()): Promise<EndpointResult> {
  const row = await db.webhookEndpoint.findFirst({ where: { id: endpointId, organizationId }, select: { secretSealed: true, url: true } });
  if (!row) return { ok: false, why: "not-found" };
  const secret = newSecret();
  const sealed = sealWith("webhook-secret", secret);
  if (!sealed) return { ok: false, why: "no-key" };
  await db.webhookEndpoint.update({
    where: { id: endpointId },
    data: { secretSealed: sealed, previousSecretSealed: row.secretSealed, previousSecretUntil: new Date(now.getTime() + 24 * 3_600_000) },
  });
  await orgAudit(organizationId, actor, "org.webhook.rotate", `Webhook signing secret rotated for ${new URL(row.url).host}; the previous one is also signed with for 24 hours`, { endpointId });
  return { ok: true, id: endpointId, secret };
}

export async function setEndpointStatus(organizationId: string, endpointId: string, active: boolean, actor: Actor): Promise<boolean> {
  const { count } = await db.webhookEndpoint.updateMany({
    where: { id: endpointId, organizationId },
    data: active ? { status: "ACTIVE", consecutiveFailures: 0, disabledReason: null } : { status: "DISABLED", disabledReason: "switched off" },
  });
  if (count === 1) await orgAudit(organizationId, actor, active ? "org.webhook.enable" : "org.webhook.disable", `Webhook endpoint ${active ? "switched on" : "switched off"}`, { endpointId });
  return count === 1;
}

export async function deleteEndpoint(organizationId: string, endpointId: string, actor: Actor): Promise<boolean> {
  const { count } = await db.webhookEndpoint.deleteMany({ where: { id: endpointId, organizationId } });
  if (count === 1) await orgAudit(organizationId, actor, "org.webhook.delete", "Webhook endpoint removed", { endpointId });
  return count === 1;
}

/** Queues a "ping" and sends it now; the answer is what the receiver said. */
export async function pingEndpoint(organizationId: string, endpointId: string) {
  const ep = await db.webhookEndpoint.findFirst({ where: { id: endpointId, organizationId }, select: { id: true } });
  if (!ep) return null;
  const eventId = `ping:${randomUUID()}`;
  const d = await db.webhookDelivery.create({
    data: { endpointId, eventId, eventType: "ping", payload: { message: "Maw3ed webhook test" }, nextAttemptAt: new Date() },
    select: { id: true },
  });
  return sendDelivery(d.id);
}

// ─── The change feed ─────────────────────────────────────────────────────────

/**
 * How long a change is left to settle before the feed reads it. updatedAt
 * is stamped when a write starts, not when its transaction commits; a
 * booking written in a slow transaction could otherwise commit behind a
 * cursor that has already moved past its time, and be missed for good.
 * Every booking write finishes well inside this window.
 */
export const SETTLE_MS = 2 * 60_000;

/**
 * Pure: the booking event a change is, and its id. "created" the first
 * time this endpoint is told about the booking — when it subscribes to
 * creations; an endpoint that only wants updates is sent "updated".
 */
export function bookingEvent(
  b: { id: string; updatedAt: Date },
  firstForEndpoint: boolean,
  subscribesToCreated: boolean,
): { eventId: string; type: "booking.created" | "booking.updated" } {
  const created = firstForEndpoint && subscribesToCreated;
  return { eventId: `booking:${b.id}:${b.updatedAt.getTime()}`, type: created ? "booking.created" : "booking.updated" };
}

/**
 * Reads what changed for every active endpoint and queues deliveries.
 * Bounded: FEED_BATCH bookings per endpoint per run, at most 500
 * endpoints, and `budgetMs` overall; the cursor moves past what was read,
 * so the next run continues where this one stopped.
 */
export async function collectEvents(now: Date = new Date(), budgetMs = 20_000): Promise<{ endpoints: number; queued: number }> {
  if (!flagOn("webhooks")) return { endpoints: 0, queued: 0 };
  const endpoints = await db.webhookEndpoint.findMany({
    where: { status: "ACTIVE" },
    orderBy: { cursorAt: { sort: "asc", nulls: "first" } },
    select: { id: true, organizationId: true, events: true, cursorAt: true, cursorId: true, createdAt: true, organization: { select: { status: true, contract: true } } },
    take: 500,
  });
  let queued = 0;
  const started = Date.now();
  for (const ep of endpoints) {
    if (Date.now() - started > budgetMs) break;
    if (ep.organization.status !== "APPROVED" || !contractInForce(ep.organization.contract, now)) continue;
    try {
      queued += await collectFor(ep, now);
    } catch (e) {
      log.error("[webhooks] feed failed for an endpoint", e, { endpointId: ep.id });
    }
  }
  return { endpoints: endpoints.length, queued };
}

async function collectFor(
  ep: { id: string; organizationId: string; events: string[]; cursorAt: Date | null; cursorId: string | null; createdAt: Date },
  now: Date,
): Promise<number> {
  const visible = await visibleBusinesses(ep.organizationId, now);
  let queued = 0;
  const settled = new Date(now.getTime() - SETTLE_MS);

  // Bookings: only through a row that is OWNED or MANAGED and grants
  // RESERVATIONS, at the branches those rows name (lib/enterprise/visibility).
  const wantsCreated = ep.events.includes("booking.created");
  const wantsBookings = wantsCreated || ep.events.includes("booking.updated");
  const bookingScope = visible.filter(seesBookings);
  if (wantsBookings && bookingScope.length > 0) {
    const cursorAt = ep.cursorAt ?? ep.createdAt;
    const cursorId = ep.cursorId ?? "";
    const rows = await db.booking.findMany({
      where: {
        isTest: false,
        updatedAt: { lte: settled },
        OR: bookingScope.map((v) => ({ businessId: v.businessId, ...(v.bookings!.branchIds ? { branchId: { in: v.bookings!.branchIds } } : {}) })),
        AND: [{ OR: [{ updatedAt: { gt: cursorAt } }, { updatedAt: cursorAt, id: { gt: cursorId } }] }],
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: FEED_BATCH,
      select: {
        id: true, reference: true, businessId: true, branchId: true, serviceId: true, staffMemberId: true, status: true,
        date: true, startTime: true, endTime: true, partySize: true, createdAt: true, updatedAt: true,
        business: { select: { slug: true } },
      },
    });
    // Which of these bookings this endpoint has already been told about.
    const known = rows.length
      ? new Set(
          (await db.$queryRaw<{ bookingId: string }[]>`
            SELECT DISTINCT split_part("eventId", ':', 2) AS "bookingId" FROM "WebhookDelivery"
             WHERE "endpointId" = ${ep.id} AND "eventId" LIKE 'booking:%'
               AND split_part("eventId", ':', 2) = ANY(${rows.map((r) => r.id)})`).map((r) => r.bookingId),
        )
      : new Set<string>();
    const data: Prisma.WebhookDeliveryCreateManyInput[] = [];
    const seenNow = new Set<string>();
    for (const b of rows) {
      // A booking that existed before the endpoint did was never "new" to it.
      const first = !known.has(b.id) && !seenNow.has(b.id) && b.createdAt >= ep.createdAt;
      seenNow.add(b.id);
      const ev = bookingEvent(b, first, wantsCreated);
      if (!ep.events.includes(ev.type)) continue;
      data.push({
        endpointId: ep.id,
        eventId: ev.eventId,
        eventType: ev.type,
        nextAttemptAt: now,
        payload: {
          id: b.id, reference: b.reference, businessId: b.businessId, businessSlug: b.business.slug,
          branchId: b.branchId, serviceId: b.serviceId, staffMemberId: b.staffMemberId, status: b.status,
          date: b.date.toISOString().slice(0, 10), startTime: b.startTime, endTime: b.endTime,
          partySize: b.partySize, updatedAt: b.updatedAt.toISOString(),
        },
      });
    }
    if (data.length) queued += (await db.webhookDelivery.createMany({ data, skipDuplicates: true })).count;
    const last = rows[rows.length - 1];
    if (last) await db.webhookEndpoint.update({ where: { id: ep.id }, data: { cursorAt: last.updatedAt, cursorId: last.id } });
    else if (!ep.cursorAt) await db.webhookEndpoint.update({ where: { id: ep.id }, data: { cursorAt, cursorId: "" } });
  }

  // Association changes: a short look-back each run; the unique event id
  // makes a re-read a no-op.
  if (ep.events.includes("association.updated")) {
    const changed = await db.organizationBusiness.findMany({
      where: { organizationId: ep.organizationId, updatedAt: { gt: new Date(now.getTime() - 30 * 60_000) } },
      select: { id: true, businessId: true, relation: true, status: true, scopes: true, branchId: true, updatedAt: true },
      take: FEED_BATCH,
    });
    const data = changed.map((a) => ({
      endpointId: ep.id,
      eventId: `association:${a.id}:${a.updatedAt.getTime()}`,
      eventType: "association.updated",
      nextAttemptAt: now,
      payload: { id: a.id, businessId: a.businessId, relation: a.relation, status: a.status, scopes: a.scopes, branchId: a.branchId, updatedAt: a.updatedAt.toISOString() },
    }));
    if (data.length) queued += (await db.webhookDelivery.createMany({ data, skipDuplicates: true })).count;
  }
  return queued;
}

// ─── Sending ─────────────────────────────────────────────────────────────────

/**
 * Sends what is due, oldest first, within `budgetMs`. Each delivery is
 * claimed by a conditional update (the lease), so two runs never send the
 * same one at once. A delivery whose last allowed attempt was cut off
 * (the function stopped mid-send) is closed as DEAD first, so it can
 * never sit at the head of the queue.
 */
export async function processDeliveries(now: Date = new Date(), limit = 50, budgetMs = 20_000): Promise<{ due: number; sent: number; failed: number; dead: number; closed: number }> {
  const out = { due: 0, sent: 0, failed: 0, dead: 0, closed: 0 };
  if (!flagOn("webhooks")) return out;
  out.closed = await db.$executeRaw`
    UPDATE "WebhookDelivery" SET "status" = 'DEAD', "lastError" = COALESCE("lastError", 'interrupted on its last attempt'), "nextAttemptAt" = NULL, "updatedAt" = now()
     WHERE "id" IN (SELECT "id" FROM "WebhookDelivery" WHERE "status" IN ('PENDING', 'FAILED') AND "attempts" >= ${MAX_ATTEMPTS} AND "nextAttemptAt" <= ${now} LIMIT 500)`;
  const due = await db.webhookDelivery.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, attempts: { lt: MAX_ATTEMPTS }, nextAttemptAt: { lte: now }, endpoint: { status: "ACTIVE" } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });
  out.due = due.length;
  const started = Date.now();
  const allowed = new Map<string, Awaited<ReturnType<typeof orgAllows>>>();
  for (const d of due) {
    if (Date.now() - started > budgetMs) break;
    const r = await sendDelivery(d.id, now, allowed);
    if (r?.status === "SENT") out.sent++;
    else if (r?.status === "DEAD") out.dead++;
    else if (r) out.failed++;
  }
  return out;
}

/**
 * Whether the organization may still be sent anything, and for which
 * businesses' bookings — asked again at send time: a contract that ended,
 * a suspension or a RESERVATIONS grant withdrawn after an event was queued
 * stops it going out.
 */
/**
 * What the organization may still be sent: bookings per business, with the
 * branches (null = every branch). Branches matter too — a grant narrowed
 * from the whole business to one branch must stop queued deliveries about
 * the other branches (final audit F-24).
 */
async function orgAllows(organizationId: string, now: Date): Promise<{ ok: boolean; bookingsFor: Map<string, string[] | null> }> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { status: true, contract: true } });
  if (!org || org.status !== "APPROVED" || !contractInForce(org.contract, now)) return { ok: false, bookingsFor: new Map() };
  const visible = await visibleBusinesses(organizationId, now);
  return { ok: true, bookingsFor: new Map(visible.filter(seesBookings).map((v) => [v.businessId, v.bookings!.branchIds])) };
}

/** Pure: may a booking event at this business and branch still go out? */
export function bookingStillVisible(bookingsFor: Map<string, string[] | null>, businessId: string, branchId: string | null | undefined): boolean {
  if (!bookingsFor.has(businessId)) return false;
  const branches = bookingsFor.get(businessId);
  return branches === null || branches === undefined ? true : !!branchId && branches.includes(branchId);
}

export async function sendDelivery(
  deliveryId: string,
  now: Date = new Date(),
  cache: Map<string, Awaited<ReturnType<typeof orgAllows>>> = new Map(),
): Promise<{ status: string; code?: number; error?: string } | null> {
  // Claim: due, not yet out of attempts; the lease pushes nextAttemptAt
  // forward so a crash mid-send is retried later, not twice at once.
  const claimed = await db.$queryRaw<{ id: string; attempts: number }[]>`
    UPDATE "WebhookDelivery"
       SET "attempts" = "attempts" + 1, "nextAttemptAt" = ${new Date(now.getTime() + LEASE_MS)}, "updatedAt" = now()
     WHERE "id" = ${deliveryId} AND "status" IN ('PENDING', 'FAILED') AND "nextAttemptAt" <= ${now} AND "attempts" < ${MAX_ATTEMPTS}
    RETURNING "id", "attempts"`;
  if (claimed.length !== 1) return null;
  const attempts = claimed[0].attempts;
  const d = await db.webhookDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
    select: {
      eventId: true, eventType: true, payload: true, createdAt: true,
      endpoint: { select: { id: true, organizationId: true, url: true, status: true, secretSealed: true, previousSecretSealed: true, previousSecretUntil: true } },
    },
  });
  const ep = d.endpoint;
  // Asked again now: may this organization still receive this?
  let allows = cache.get(ep.organizationId);
  if (!allows) {
    allows = await orgAllows(ep.organizationId, now);
    cache.set(ep.organizationId, allows);
  }
  const payload = d.payload as { businessId?: string; branchId?: string | null } | null;
  const businessId = payload?.businessId;
  const notAllowed = !allows.ok
    ? "organization no longer allowed (status or contract)"
    : d.eventType.startsWith("booking.") && businessId && !bookingStillVisible(allows.bookingsFor, businessId, payload?.branchId)
    ? "booking access withdrawn"
    : null;
  if (notAllowed) {
    await db.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "DEAD", lastError: notAllowed, nextAttemptAt: null } });
    return { status: "DEAD", error: notAllowed };
  }
  const secrets = [openWith("webhook-secret", ep.secretSealed)];
  if (ep.previousSecretSealed && ep.previousSecretUntil && ep.previousSecretUntil > now) secrets.push(openWith("webhook-secret", ep.previousSecretSealed));
  const usable = secrets.filter((s): s is string => !!s);

  let code: number | undefined;
  let error: string | undefined;
  if (usable.length === 0) {
    error = "secret-unavailable";
  } else {
    const checked = await checkPublicUrl(ep.url);
    if (!checked.ok) {
      error = `blocked: ${checked.why}`;
    } else {
      const body = JSON.stringify({ id: d.eventId, type: d.eventType, createdAt: d.createdAt.toISOString(), data: d.payload });
      const ts = Math.floor(now.getTime() / 1000);
      try {
        // Pinned: the address is checked again as the socket connects, so
        // a rebinding DNS answer cannot turn this into a request to an
        // internal address. Redirects are never followed (final audit F-23).
        code = await postPinned(
          checked.url,
          {
            "Content-Type": "application/json",
            "User-Agent": "Maw3ed-Webhooks/1",
            "Maw3ed-Event-Id": d.eventId,
            "Maw3ed-Event-Type": d.eventType,
            "Maw3ed-Signature": signatureHeader(body, ts, usable),
          },
          body,
          SEND_TIMEOUT_MS,
        );
      } catch (e) {
        error = e instanceof Error
          ? e.name === "TimeoutError" ? "timeout" : (e as { code?: string }).code === "EPRIVATE" ? "blocked: private-address" : e.message.slice(0, 200)
          : "network-error";
      }
    }
  }

  const delivered = code !== undefined && code >= 200 && code < 300;
  if (delivered) {
    await db.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "SENT", deliveredAt: now, lastStatusCode: code, lastError: null, nextAttemptAt: null } });
    await db.webhookEndpoint.update({ where: { id: ep.id }, data: { consecutiveFailures: 0, lastSuccessAt: now } });
    return { status: "SENT", code };
  }
  const next = retryAt(attempts, now);
  await db.webhookDelivery.update({
    where: { id: deliveryId },
    data: { status: next ? "FAILED" : "DEAD", lastStatusCode: code ?? null, lastError: error ?? `http ${code}`, nextAttemptAt: next },
  });
  const updated = await db.webhookEndpoint.update({
    where: { id: ep.id },
    data: { consecutiveFailures: { increment: 1 }, lastFailureAt: now },
    select: { consecutiveFailures: true, status: true, url: true },
  });
  if (updated.status === "ACTIVE" && updated.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    const { count } = await db.webhookEndpoint.updateMany({
      where: { id: ep.id, status: "ACTIVE" },
      data: { status: "DISABLED", disabledReason: `${MAX_CONSECUTIVE_FAILURES} failed deliveries in a row` },
    });
    if (count === 1) await orgAudit(ep.organizationId, null, "org.webhook.auto_disable", `Webhook endpoint ${new URL(updated.url).host} switched off after ${MAX_CONSECUTIVE_FAILURES} failed deliveries in a row`, { endpointId: ep.id });
  }
  return { status: next ? "FAILED" : "DEAD", code, error };
}
