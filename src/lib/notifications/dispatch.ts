import { after } from "next/server";
import type {
  DeliveryStatus,
  NotificationChannel,
  Plan,
  SubscriptionStatus,
} from "@prisma/client";
import { PLAN_NAMES_AR, canUseFeature, getEffectivePlan } from "@/lib/plans";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { money } from "@/lib/fmt";
import { formatWhen } from "@/lib/account/when";
import { bookingPageUrl, siteUrl } from "@/lib/url";
import type { BespokeContext } from "./templates";
import { copyFor, type CopyContext } from "./copy";
import { allows, CHANNELS, type Channel } from "./channels";
import { MAX_ATTEMPTS, STALE_PENDING_MS, isPermanentFailure, nextAttemptAt, serializeEvent } from "./outbox";
import {
  EVENT_AUDIENCE,
  EVENT_KIND,
  dedupeKey,
  isSubscriptionEvent,
  type Audience,
  type NotificationEvent,
} from "./events";
import {
  businessRecipient,
  customerRecipient,
  hrefForBusiness,
  staffRecipients,
  type StaffUser,
  type BookingSubject,
  type BusinessSubject,
  type Recipient,
} from "./recipients";

/**
 * The one way anything in Maw3ed tells somebody something.
 *
 * A caller says what happened and passes an id. This loads the rest,
 * works out who should hear about it, asks each of them how they want
 * to be reached, and sends on every channel they allow — recording each
 * one so the same thing is never sent twice.
 *
 * It never throws. A notification is something that happens *about* a
 * booking, and a booking must not fail because a message could not go
 * out; every failure is written to the ledger and logged instead.
 */

export interface DispatchOutcome {
  audience: Audience;
  channel: NotificationChannel;
  status: DeliveryStatus | "DUPLICATE";
  reason?: string;
}

export async function notify(event: NotificationEvent): Promise<DispatchOutcome[]> {
  try {
    return await dispatch(event);
  } catch (e) {
    log.error("[notify] dispatch failed", e, { type: event.type });
    return [];
  }
}

/**
 * `notify`, after the response has gone out.
 *
 * A route must not make the customer wait on WhatsApp, and must not
 * fail their booking because an email did not go. It used to write
 * `void notify(...)` — and on a serverless platform the function is
 * frozen as soon as the response is sent, so a send that had not
 * finished was simply lost. `after()` keeps the function alive until
 * the work completes. Outside a request (a cron, a test, a script)
 * there is nothing to defer behind and it runs at once; either way the
 * outbox has the claim, so a lost send is retried rather than forgotten.
 */
export function notifyLater(event: NotificationEvent): void {
  try {
    after(() => notify(event));
  } catch {
    void notify(event);
  }
}

async function dispatch(event: NotificationEvent): Promise<DispatchOutcome[]> {
  const loaded = isSubscriptionEvent(event)
    ? await loadBusiness(event.businessId)
    : await loadBooking(event.bookingId);

  if (!loaded) {
    log.warn("[notify] subject not found or a test booking", { type: event.type });
    return [];
  }

  const { booking, business, context } = loaded;

  // The caller knows how many days are left better than a date
  // subtraction does — it is the reason the job decided to send.
  if (event.type === "subscription.renewalDue" && loaded.bespoke.subscription) {
    loaded.bespoke.subscription.daysLeft = event.daysLeft;
  }
  // What only the event knows: where a moved booking was, and how much
  // a payment was for.
  if (event.type === "booking.rescheduled" && event.movedFrom) {
    const [d, t] = event.movedFrom.split("T");
    if (d && t) {
      context.previousWhen = formatWhen(new Date(`${d}T00:00:00Z`), t);
      if (loaded.bespoke.email) loaded.bespoke.email.previous = { date: d, startTime: t };
    }
  }
  if (event.type === "payment.received") {
    // The amount that actually arrived — a balance is not the deposit.
    context.amount = money(event.amount, "ar", loaded.bespoke.email?.currency ?? "EGP");
    if (loaded.bespoke.email) loaded.bespoke.email.paidAmount = event.amount;
  }

  // Events a business has switched off entirely never leave here.
  if (!businessWantsEvent(business, event)) {
    return [{ audience: "customer", channel: "IN_APP", status: "SKIPPED", reason: "disabled-by-business" }];
  }

  const actorUserId = "actorUserId" in event ? (event.actorUserId ?? null) : null;
  const only = event.type === "booking.created" ? event.only : undefined;

  const recipients: Recipient[] = [];
  for (const audience of EVENT_AUDIENCE[event.type]) {
    if (only && audience !== only) continue;
    // A move the business made itself, when we do not know who there
    // made it: the customer copy is the only one with a reader. When we
    // do know, only that person is left out (below).
    if (audience === "business" && event.type === "booking.rescheduled" && event.by === "business" && !actorUserId) continue;
    if (audience === "customer") {
      if (!booking) continue; // A subscription has no customer.
      recipients.push(customerRecipient(booking, await customerPrefs(booking.customerUserId)));
    } else {
      const href = hrefForBusiness(event);
      recipients.push({ ...businessRecipient(business, event.type), href });
      if (booking) {
        // Managers, and the provider the booking is with.
        const staff = staffRecipients(business, event.type, booking.staffMemberId ?? null, await staffUsers(business.id));
        for (const r of staff) recipients.push({ ...r, href });
      }
    }
  }
  // Nobody at the business is told about what they did themselves.
  const told = actorUserId
    ? recipients.filter((r) => !(r.audience === "business" && r.userId === actorUserId))
    : recipients;

  const results: DispatchOutcome[] = [];
  for (const recipient of told) {
    const copy = copyFor(event, recipient.audience, context);
    for (const channel of CHANNELS) {
      results.push(
        await deliver(event, recipient, channel, copy, booking, business, loaded.bespoke),
      );
    }
  }
  return results;
}

/* ─── One recipient, one channel ─────────────────────────── */

async function deliver(
  event: NotificationEvent,
  recipient: Recipient,
  channel: Channel,
  copy: ReturnType<typeof copyFor>,
  booking: BookingSubject | null,
  business: BusinessSubject,
  bespoke: BespokeContext,
): Promise<DispatchOutcome> {
  const base = { audience: recipient.audience, channel: channel.name };

  if (!allows(recipient, channel.name, event)) {
    return { ...base, status: "SKIPPED", reason: "not-allowed" };
  }
  const address = channel.address(recipient);
  if (!address) return { ...base, status: "SKIPPED", reason: "no-address" };

  const key = dedupeKey(event, recipient.audience, channel.name, recipient.keyTag);

  // Claim the key before sending. Whoever wins the unique index sends;
  // everyone else stops here. This is what makes a retried webhook or a
  // cron that overlaps itself harmless.
  const claim = await claimKey(key, event, channel.name, address, booking?.id ?? null, business.id);
  if (claim.kind === "taken") return { ...base, status: "DUPLICATE" };

  const outcome = await channel.send({
    event,
    recipient,
    copy,
    bookingId: booking?.id ?? null,
    businessId: business.id,
    bespoke,
  });

  // `attempts` was counted when the row was claimed, not here: a send
  // that never returns (a provider that hangs, a function killed) must
  // still use up an attempt, or the stale-claim takeover would retry it
  // for ever.
  const attempts = claim.attempts;
  const now = new Date();
  let status: DeliveryStatus = outcome.ok ? "SENT" : outcome.skipped ? "SKIPPED" : "FAILED";
  const reason = outcome.ok ? undefined : outcome.reason;
  // A failure is retried later by the re-drive job (lib/notifications/
  // outbox.ts) unless it is the kind trying again cannot fix, or this
  // was the last attempt allowed.
  let retryAt: Date | null = null;
  if (status === "FAILED") {
    retryAt = isPermanentFailure(reason) ? null : nextAttemptAt(attempts, now);
    if (!retryAt) status = "DEAD";
  }

  await db.notificationDelivery
    .update({
      where: { dedupeKey: key },
      data: { status, error: reason ?? null, nextAttemptAt: retryAt },
    })
    .catch((e) => log.error("[notify] could not record outcome", e));

  if (status === "DEAD") {
    log.error("[notify] delivery given up", { key, channel: channel.name, attempts, reason });
  }

  return { ...base, status, reason };
}

/** `attempts` is the count including the send about to be made. */
type Claim = { kind: "claimed"; attempts: number } | { kind: "taken" };

/**
 * Takes the key, or reports that somebody else already has it.
 *
 * The row is claimed PENDING and carries the event, so that if this
 * process dies before the send returns, the re-drive job can see a
 * claim that never reported back and finish it. A row left FAILED with
 * its retry time reached, or PENDING for longer than a send takes, may
 * be taken over; SENT, SKIPPED and DEAD mean "dealt with". Each
 * take-over is a conditional update, so two re-drivers racing cannot
 * both win the same row. The attempt is counted on the claim itself,
 * so a send that never comes back still spends one, and a row that has
 * spent them all is closed rather than taken over again.
 */
async function claimKey(
  dedupeKeyValue: string,
  event: NotificationEvent,
  channel: NotificationChannel,
  recipient: string,
  bookingId: string | null,
  businessId: string,
): Promise<Claim> {
  // createMany with skipDuplicates rather than create-and-catch: losing
  // the race is the normal, expected outcome here, and a create that
  // throws makes Prisma log a unique-constraint error every time a cron
  // passes over an appointment it has already reminded about. The
  // production log would fill with alarming errors describing the
  // system working correctly.
  const claim = await db.notificationDelivery.createMany({
    data: [
      {
        dedupeKey: dedupeKeyValue,
        kind: EVENT_KIND[event.type],
        channel,
        status: "PENDING",
        recipient,
        bookingId,
        businessId,
        event: serializeEvent(event),
        attempts: 1,
        lastAttemptAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });
  if (claim.count === 1) return { kind: "claimed", attempts: 1 };

  const existing = await db.notificationDelivery.findUnique({
    where: { dedupeKey: dedupeKeyValue },
    select: { status: true, attempts: true, nextAttemptAt: true, updatedAt: true },
  });
  if (!existing) return { kind: "taken" };

  const now = Date.now();
  const retryDue = existing.status === "FAILED" && existing.nextAttemptAt !== null && existing.nextAttemptAt.getTime() <= now;
  const abandoned = existing.status === "PENDING" && existing.updatedAt.getTime() < now - STALE_PENDING_MS;
  if (!retryDue && !abandoned) return { kind: "taken" };

  // A claim that never reported back has still spent its attempt. Out
  // of attempts, it is closed here rather than sent once more.
  if (existing.attempts >= MAX_ATTEMPTS) {
    await db.notificationDelivery.updateMany({
      where: { dedupeKey: dedupeKeyValue, status: existing.status, updatedAt: existing.updatedAt },
      data: { status: "DEAD", error: "no answer from the provider after every attempt", nextAttemptAt: null },
    });
    return { kind: "taken" };
  }

  const took = await db.notificationDelivery.updateMany({
    where: {
      dedupeKey: dedupeKeyValue,
      status: existing.status,
      // The same row, in the same state we read it in: another worker
      // that took it over since has moved updatedAt.
      updatedAt: existing.updatedAt,
    },
    data: {
      status: "PENDING",
      error: null,
      recipient,
      event: serializeEvent(event),
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });
  return took.count === 1 ? { kind: "claimed", attempts: existing.attempts + 1 } : { kind: "taken" };
}

/* ─── Preferences ────────────────────────────────────────── */

async function customerPrefs(userId: string | null) {
  if (!userId) return null;
  return db.user.findUnique({
    where: { id: userId },
    select: { notifyByEmail: true, notifyByWhatsApp: true, notifyBySms: true },
  });
}

/** Staff who can sign in to this business, with their own email switch. */
async function staffUsers(businessId: string): Promise<StaffUser[]> {
  const rows = await db.staffMember.findMany({
    where: { businessId, isActive: true, access: { not: null }, userId: { not: null } },
    select: {
      id: true,
      access: true,
      userId: true,
      user: { select: { email: true, notifyByEmail: true } },
    },
  });
  return rows.flatMap((r) =>
    r.access && r.userId
      ? [{
          staffMemberId: r.id,
          access: r.access,
          userId: r.userId,
          email: r.user?.email ?? null,
          notifyByEmail: r.user?.notifyByEmail ?? false,
        }]
      : [],
  );
}

/** The switches that turn an event off at source rather than per channel. */
function businessWantsEvent(b: BusinessSubject & Partial<ReminderPrefs>, event: NotificationEvent) {
  if (event.type === "booking.reminder") return b.reminderEnabled !== false;
  if (event.type === "booking.startingSoon") return b.startingSoonEnabled !== false;
  if (event.type === "review.requested") return b.reviewRequestEnabled !== false;
  return true;
}

interface ReminderPrefs {
  reminderEnabled: boolean;
  startingSoonEnabled: boolean;
  reviewRequestEnabled: boolean;
}

/* ─── Loading the subject ────────────────────────────────── */

const BUSINESS_SELECT = {
  id: true,
  slug: true,
  nameAr: true,
  phone: true,
  whatsapp: true,
  notificationEmail: true,
  notificationPhone: true,
  ownerId: true,
  notifyByEmail: true,
  notifyByWhatsApp: true,
  notifyNewBooking: true,
  notifyCancellation: true,
  notifyPayment: true,
  reminderEnabled: true,
  startingSoonEnabled: true,
  reviewRequestEnabled: true,
  cancellationCutoffHours: true,
  plan: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  currentPeriodEnd: true,
  owner: { select: { email: true } },
} as const;

interface Loaded {
  booking: BookingSubject | null;
  business: BusinessSubject & ReminderPrefs;
  context: CopyContext;
  /** What the hand-written templates need; see templates.ts. */
  bespoke: BespokeContext;
}

/** Exported for its test: which address a booking's emails go to. */
export async function loadBooking(bookingId: string): Promise<Loaded | null> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      isTest: true,
      accessToken: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerPhoneE164: true,
      customerEmail: true,
      staffMemberId: true,
      date: true,
      startTime: true,
      endTime: true,
      notes: true,
      totalPrice: true,
      depositAmount: true,
      currency: true,
      service: { select: { nameAr: true } },
      business: { select: BUSINESS_SELECT },
    },
  });
  if (!b) return null;
  // An owner's test booking on their unpublished page reaches nobody,
  // whatever happens to it afterwards — confirmed, cancelled, moved.
  // Its phone was never proved, so a message to it would be a message
  // to a stranger about a page that is not public.
  if (b.isTest) return null;

  // The account this phone belongs to, if it has one. Matched on the
  // canonical column, because the booking stores the number as typed.
  const account = b.customerPhoneE164
    ? await db.user.findUnique({ where: { phone: b.customerPhoneE164 }, select: { id: true } })
    : null;

  const business = shapeBusiness(b.business);

  return {
    booking: {
      id: b.id,
      accessToken: b.accessToken,
      customerPhone: b.customerPhone,
      customerPhoneE164: b.customerPhoneE164,
      // The booking's own address, never the Customer record's: see
      // Booking.customerEmail.
      customerEmail: b.customerEmail,
      customerUserId: account?.id ?? null,
      staffMemberId: b.staffMemberId,
      business,
    },
    business,
    context: {
      businessName: b.business.nameAr,
      serviceName: b.service.nameAr,
      when: formatWhen(b.date, b.startTime),
      customerName: b.customerName,
      amount: money(Number(b.depositAmount ?? b.totalPrice), "ar", b.currency),
      status: b.status,
    },
    bespoke: {
      // Exactly what the existing templates have always been given.
      whatsapp: {
        businessName: b.business.nameAr,
        serviceName: b.service.nameAr,
        date: b.date.toISOString().slice(0, 10),
        startTime: b.startTime,
        endTime: b.endTime ?? "",
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        totalPrice: Number(b.totalPrice),
        currency: b.currency,
      },
      email: {
        businessName: b.business.nameAr,
        serviceName: b.service.nameAr,
        date: b.date.toISOString().slice(0, 10),
        startTime: b.startTime,
        endTime: b.endTime ?? "",
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        totalPrice: Number(b.totalPrice),
        currency: b.currency,
        notes: b.notes,
        bookingUrl: b.accessToken ? bookingPageUrl(b.accessToken) : null,
        status: b.status,
        cutoffHours: b.business.cancellationCutoffHours,
      },
      subscription: null,
    },
  };
}

async function loadBusiness(businessId: string): Promise<Loaded | null> {
  const biz = await db.business.findUnique({
    where: { id: businessId },
    select: BUSINESS_SELECT,
  });
  if (!biz) return null;

  const business = shapeBusiness(biz);
  return {
    booking: null,
    business,
    context: {
      businessName: biz.nameAr,
      serviceName: "",
      when: "",
      customerName: "",
    },
    bespoke: {
      email: null,
      whatsapp: null,
      subscription: {
        businessName: biz.nameAr,
        // The Arabic plan name, which is what the email has always
        // said — not the raw enum.
        planName: PLAN_NAMES_AR[biz.plan],
        expiryDate: biz.currentPeriodEnd
          ? biz.currentPeriodEnd.toISOString().slice(0, 10)
          : "—",
        daysLeft: daysUntil(biz.currentPeriodEnd),
        renewUrl: siteUrl("/dashboard/settings"),
      },
    },
  };
}

/** Whole days from now until a date, never negative. */
function daysUntil(d: Date | null): number {
  if (!d) return 0;
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000));
}

type RawBusiness = {
  owner: { email: string | null } | null;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
} & Omit<BusinessSubject, "ownerEmail" | "whatsappAllowed"> &
  ReminderPrefs;

function shapeBusiness(raw: RawBusiness): BusinessSubject & ReminderPrefs {
  const { owner, plan, subscriptionStatus, trialEndsAt, ...rest } = raw;
  return {
    ...rest,
    ownerEmail: owner?.email ?? null,
    // The same calculation the booking route has always made, in the
    // one place every send now passes through.
    whatsappAllowed: canUseFeature(
      getEffectivePlan(plan, subscriptionStatus, trialEndsAt),
      "whatsapp",
    ),
  };
}
