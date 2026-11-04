import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { normalisePhone } from "@/lib/phone";
import { getEffectivePlan, getMonthlyBookingLimit, type Plan, type SubscriptionStatus } from "@/lib/plans";
import { notifyLater } from "@/lib/notifications";
import { sendAutoMessage } from "@/lib/automations/send";
import { createBooking } from "./create";
import { addDays, cairoDateString, dateToUTC } from "./instants";
import { loadAvailability } from "./schedule";
import { noShowStanding } from "./no-show";
import { timeToMinutes } from "./time";

/**
 * The slot waitlist (docs/architecture/ADVANCED_BOOKING_RULES.md).
 *
 * A customer who found a day full leaves a window ("between 16:00 and
 * 19:00 on Thursday"). When a time in that window frees up, the oldest
 * entry that fits is offered it, first come first served, for the
 * business's waitlistOfferMinutes. Accepting books through the engine
 * (lib/bookings/create.ts) like any booking, so an offer never holds a
 * slot and two people can never both get it: the second to accept is
 * told it went, and goes back to waiting. An entry is offered at most
 * MAX_OFFERS times; each step is a conditional update on the entry's
 * status, so a cron and a cancellation offering at once offer once.
 */

export const MAX_OFFERS = 3;
/** Live entries one business keeps per day — a bound, not a target. */
export const MAX_LIVE_PER_DAY = 50;
/** Entries offered per business-day per pass. */
const OFFER_BATCH = 20;

const LIVE: ("WAITING" | "OFFERED")[] = ["WAITING", "OFFERED"];

export interface JoinInput {
  businessId: string;
  serviceId: string;
  staffMemberId?: string | null;
  date: string;
  fromTime: string;
  toTime: string;
  partySize?: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
}

export type JoinResult =
  | { ok: true; id: string; manageToken: string }
  | { ok: false; why: "disabled" | "bad-window" | "bad-date" | "service-not-found" | "already-waiting" | "full" | "bad-phone" };

export async function joinWaitlist(input: JoinInput, now: Date = new Date()): Promise<JoinResult> {
  const phoneE164 = normalisePhone(input.customerPhone);
  if (!phoneE164) return { ok: false, why: "bad-phone" };
  if (!/^\d{2}:\d{2}$/.test(input.fromTime) || !/^\d{2}:\d{2}$/.test(input.toTime) || timeToMinutes(input.fromTime) >= timeToMinutes(input.toTime)) {
    return { ok: false, why: "bad-window" };
  }
  const business = await db.business.findUnique({
    where: { id: input.businessId },
    select: { waitlistEnabled: true, maxAdvanceDays: true },
  });
  if (!business?.waitlistEnabled) return { ok: false, why: "disabled" };
  const today = cairoDateString(now);
  if (input.date < today || input.date > addDays(today, business.maxAdvanceDays ?? 60)) return { ok: false, why: "bad-date" };
  const service = await db.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId, isAvailable: true }, select: { id: true } });
  if (!service) return { ok: false, why: "service-not-found" };
  const live = await db.slotWaitlistEntry.count({ where: { businessId: input.businessId, date: dateToUTC(input.date), status: { in: LIVE } } });
  if (live >= MAX_LIVE_PER_DAY) return { ok: false, why: "full" };

  const manageToken = randomBytes(24).toString("hex");
  try {
    const row = await db.slotWaitlistEntry.create({
      data: {
        businessId: input.businessId,
        serviceId: input.serviceId,
        staffMemberId: input.staffMemberId ?? null,
        date: dateToUTC(input.date),
        fromTime: input.fromTime,
        toTime: input.toTime,
        partySize: input.partySize ?? null,
        customerName: input.customerName.slice(0, 120),
        customerPhone: input.customerPhone.slice(0, 40),
        phoneE164,
        customerEmail: input.customerEmail || null,
        manageToken,
      },
      select: { id: true },
    });
    return { ok: true, id: row.id, manageToken };
  } catch (e) {
    // One live entry per number per business per day (SlotWaitlistEntry_live_key).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, why: "already-waiting" };
    throw e;
  }
}

export async function leaveWaitlist(manageToken: string): Promise<boolean> {
  const { count } = await db.slotWaitlistEntry.updateMany({
    where: { manageToken, status: { in: LIVE } },
    data: { status: "CANCELLED", offerToken: null },
  });
  return count === 1;
}

/**
 * Offers freed times on one business-day to whoever waits for them,
 * oldest entry first. Safe to call from anywhere, any number of times:
 * an entry moves WAITING → OFFERED by a conditional update; a new offer
 * never overlaps a live one with the same member of staff; and the
 * database holds one live offer per start time per staff member
 * (SlotWaitlistEntry_offer_slot_key), so two passes racing cannot both
 * offer it — the loser moves on to the next time.
 */
export async function offerFreedTimes(businessId: string, date: string, now: Date = new Date()): Promise<number> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { waitlistEnabled: true, waitlistOfferMinutes: true, nameAr: true, isPublished: true },
  });
  if (!business?.waitlistEnabled || !business.isPublished) return 0;
  if (date < cairoDateString(now)) return 0;

  const day = dateToUTC(date);
  const [waiting, onOffer, durations] = await Promise.all([
    db.slotWaitlistEntry.findMany({
      where: { businessId, date: day, status: "WAITING", offers: { lt: MAX_OFFERS } },
      orderBy: { createdAt: "asc" },
      take: OFFER_BATCH,
    }),
    db.slotWaitlistEntry.findMany({
      where: { businessId, date: day, status: "OFFERED", offerExpiresAt: { gt: now } },
      select: { offeredTime: true, offeredStaffId: true, serviceId: true },
    }),
    db.service.findMany({ where: { businessId }, select: { id: true, duration: true } }),
  ]);
  const minutesOf = new Map(durations.map((s) => [s.id, s.duration]));
  // What is on offer now, as intervals with whom: a new offer must not
  // overlap one with the same member of staff (or with nobody named,
  // which could be anyone). An offer holds nothing, but offering one
  // freed hour as 10:00 to one person and 10:30 to another promises it
  // twice.
  const live: { start: number; end: number; staff: string | null }[] = onOffer
    .filter((o) => o.offeredTime)
    .map((o) => {
      const start = timeToMinutes(o.offeredTime!);
      return { start, end: start + (minutesOf.get(o.serviceId) ?? 30), staff: o.offeredStaffId };
    });
  const clashes = (start: number, end: number, staff: string | null) =>
    live.some((o) => o.start < end && start < o.end && (o.staff === null || staff === null || o.staff === staff));
  // One schedule load per (service, staff, party) in a pass.
  const cache = new Map<string, Awaited<ReturnType<typeof loadAvailability>>>();
  let offered = 0;
  for (const entry of waiting) {
    const key = `${entry.serviceId}|${entry.staffMemberId ?? ""}|${entry.partySize ?? ""}`;
    let availability = cache.get(key);
    if (!availability) {
      availability = await loadAvailability(
        { businessId, serviceId: entry.serviceId, date, staffMemberId: entry.staffMemberId, partySize: entry.partySize },
        now,
      );
      cache.set(key, availability);
    }
    const from = timeToMinutes(entry.fromTime);
    const to = timeToMinutes(entry.toTime);
    const length = availability.serviceDuration || (minutesOf.get(entry.serviceId) ?? 30);
    const staffFor = (s: string) => entry.staffMemberId ?? availability!.assignments[s] ?? null;
    const time = availability.slots.find((s) => {
      const m = timeToMinutes(s);
      return m >= from && m < to && !clashes(m, m + length, staffFor(s));
    });
    if (!time) continue;
    const offeredStaffId = staffFor(time);
    const offerToken = randomBytes(24).toString("hex");
    let count = 0;
    try {
      ({ count } = await db.slotWaitlistEntry.updateMany({
        where: { id: entry.id, status: "WAITING", offers: { lt: MAX_OFFERS } },
        data: {
          status: "OFFERED",
          offeredTime: time,
          offeredStaffId,
          offerToken,
          offerExpiresAt: new Date(now.getTime() + business.waitlistOfferMinutes * 60_000),
          offers: { increment: 1 },
        },
      }));
    } catch (e) {
      // Another pass offered this time a moment ago.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        live.push({ start: timeToMinutes(time), end: timeToMinutes(time) + length, staff: offeredStaffId });
        continue;
      }
      throw e;
    }
    if (count !== 1) continue;
    live.push({ start: timeToMinutes(time), end: timeToMinutes(time) + length, staff: offeredStaffId });
    offered++;
    await sendAutoMessage({
      key: `waitlist-offer:${entry.id}:${entry.offers + 1}`,
      businessId,
      phoneE164: entry.phoneE164,
      email: entry.customerEmail,
      title: `فيه ميعاد فضي في ${business.nameAr}`,
      body: `${date} الساعة ${time}. الميعاد محجوز لك ${business.waitlistOfferMinutes} دقيقة — أكّده من اللينك قبل ما يروح لحد تاني.`,
      href: `/booking-waitlist/${entry.manageToken}`,
      marketing: false,
    }, now);
  }
  return offered;
}

export type AcceptResult =
  | { ok: true; bookingId: string; reference: string; accessToken: string }
  | { ok: false; why: "not-found" | "expired" | "taken" | "call-business" };

/** The customer takes the time they were offered. */
export async function acceptOffer(manageToken: string, offerToken: string, now: Date = new Date()): Promise<AcceptResult> {
  const entry = await db.slotWaitlistEntry.findUnique({ where: { manageToken } });
  if (!entry) return { ok: false, why: "not-found" };
  if (entry.status === "BOOKED" && entry.bookingId) {
    // A second tap on the same offer: the booking it already made.
    const b = await db.booking.findUnique({ where: { id: entry.bookingId }, select: { id: true, reference: true, accessToken: true } });
    if (b?.accessToken) return { ok: true, bookingId: b.id, reference: b.reference ?? "", accessToken: b.accessToken };
  }
  if (entry.status !== "OFFERED" || entry.offerToken !== offerToken || !entry.offerExpiresAt || entry.offerExpiresAt <= now || !entry.offeredTime) {
    return { ok: false, why: "expired" };
  }
  const [business, service] = await Promise.all([
    db.business.findUnique({
      where: { id: entry.businessId },
      select: {
        id: true, autoConfirm: true, depositEnabled: true, plan: true, subscriptionStatus: true, trialEndsAt: true,
        noShowLimit: true, noShowWindowDays: true, noShowAction: true,
      },
    }),
    db.service.findFirst({ where: { id: entry.serviceId, businessId: entry.businessId }, select: { id: true, price: true, currency: true } }),
  ]);
  if (!business || !service) return { ok: false, why: "not-found" };

  // A number the no-show policy restricts books by calling, not by link.
  const standing = await noShowStanding(business.id, entry.phoneE164, business, now);
  if (standing.applies) return { ok: false, why: "call-business" };

  const customer = await customerFor(business.id, entry.customerPhone, entry.customerName);
  const plan = getEffectivePlan(business.plan as Plan, business.subscriptionStatus as SubscriptionStatus, business.trialEndsAt);
  const date = entry.date.toISOString().slice(0, 10);
  const result = await createBooking({
    businessId: business.id,
    serviceId: service.id,
    customerId: customer.id,
    customerName: entry.customerName,
    customerPhone: entry.customerPhone,
    customerEmail: entry.customerEmail,
    date,
    startTime: entry.offeredTime,
    // The member of staff the time was offered with.
    staffMemberId: entry.staffMemberId ?? entry.offeredStaffId,
    partySize: entry.partySize,
    // No payment is taken through a waitlist link: where the business
    // takes deposits the booking waits for the owner instead.
    status: business.autoConfirm && !business.depositEnabled ? "CONFIRMED" : "PENDING",
    totalPrice: service.price,
    currency: service.currency,
    depositAmount: null,
    source: "MAW3ED",
    idempotencyKey: `waitlist:${entry.id}:${entry.offers}`,
    monthlyLimit: getMonthlyBookingLimit(plan),
    overLimit: "hold",
  }, now);

  if (!result.ok) {
    // Somebody booked it first. Back to waiting while offers remain.
    await db.slotWaitlistEntry.updateMany({
      where: { id: entry.id, status: "OFFERED", offerToken },
      data: entry.offers >= MAX_OFFERS
        ? { status: "EXPIRED", offerToken: null }
        : { status: "WAITING", offerToken: null, offeredTime: null, offerExpiresAt: null },
    });
    return { ok: false, why: "taken" };
  }
  // The booking exists: the entry is BOOKED whatever happened to the
  // offer meanwhile (the sweep may have lapsed it a moment ago, or even
  // offered it again) — never left waiting with a booking in hand.
  const { count } = await db.slotWaitlistEntry.updateMany({
    where: { id: entry.id, bookingId: null, status: { in: ["OFFERED", "WAITING"] } },
    data: { status: "BOOKED", bookingId: result.booking.id, offerToken: null },
  });
  if (count === 1 && !result.reused) notifyLater({ type: "booking.created", bookingId: result.booking.id });
  return { ok: true, bookingId: result.booking.id, reference: result.booking.reference ?? "", accessToken: result.booking.accessToken ?? "" };
}

async function customerFor(businessId: string, phone: string, name: string) {
  const where = { businessId_phone: { businessId, phone } };
  try {
    return await db.customer.upsert({ where, create: { businessId, name, phone }, update: {}, select: { id: true } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return db.customer.findUniqueOrThrow({ where, select: { id: true } });
    }
    throw e;
  }
}

/**
 * The cron's part: offers that ran out pass on (the entry waits again,
 * or ends after MAX_OFFERS), days that passed close their entries, and
 * every business-day touched is offered again. Bounded per run.
 */
export async function sweepWaitlist(now: Date = new Date(), limit = 200): Promise<{ lapsed: number; closed: number; offered: number }> {
  const lapsedRows = await db.slotWaitlistEntry.findMany({
    where: { status: "OFFERED", offerExpiresAt: { lte: now } },
    select: { id: true, businessId: true, date: true, offers: true, offerToken: true },
    take: limit,
  });
  const days = new Map<string, { businessId: string; date: string }>();
  let lapsed = 0;
  for (const e of lapsedRows) {
    const { count } = await db.slotWaitlistEntry.updateMany({
      where: { id: e.id, status: "OFFERED", offerToken: e.offerToken },
      data: e.offers >= MAX_OFFERS
        ? { status: "EXPIRED", offerToken: null }
        : { status: "WAITING", offerToken: null, offeredTime: null, offerExpiresAt: null },
    });
    lapsed += count;
    const date = e.date.toISOString().slice(0, 10);
    days.set(`${e.businessId}|${date}`, { businessId: e.businessId, date });
  }
  const { count: closed } = await db.slotWaitlistEntry.updateMany({
    where: { status: { in: LIVE }, date: { lt: dateToUTC(cairoDateString(now)) } },
    data: { status: "EXPIRED", offerToken: null },
  });
  // Days with people waiting where something may have freed without a
  // cancellation passing through here (a reschedule, an owner's edit).
  const waitingDays = await db.slotWaitlistEntry.findMany({
    where: { status: "WAITING", date: { gte: dateToUTC(cairoDateString(now)) } },
    select: { businessId: true, date: true },
    distinct: ["businessId", "date"],
    take: limit,
  });
  for (const w of waitingDays) {
    const date = w.date.toISOString().slice(0, 10);
    days.set(`${w.businessId}|${date}`, { businessId: w.businessId, date });
  }
  let offered = 0;
  for (const d of days.values()) {
    try {
      offered += await offerFreedTimes(d.businessId, d.date, now);
    } catch (e) {
      log.error("[waitlist] offering failed for a day", e, d);
    }
  }
  return { lapsed, closed, offered };
}
