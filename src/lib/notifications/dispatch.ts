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

async function dispatch(event: NotificationEvent): Promise<DispatchOutcome[]> {
  const loaded = isSubscriptionEvent(event)
    ? await loadBusiness(event.businessId)
    : await loadBooking(event.bookingId);

  if (!loaded) {
    log.warn("[notify] subject not found", { type: event.type });
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
  if (claim === "taken") return { ...base, status: "DUPLICATE" };

  const outcome = await channel.send({
    event,
    recipient,
    copy,
    bookingId: booking?.id ?? null,
    businessId: business.id,
    bespoke,
  });

  const status: DeliveryStatus = outcome.ok ? "SENT" : outcome.skipped ? "SKIPPED" : "FAILED";
  const reason = outcome.ok ? undefined : outcome.reason;

  await db.notificationDelivery
    .update({ where: { dedupeKey: key }, data: { status, error: reason ?? null } })
    .catch((e) => log.error("[notify] could not record outcome", e));

  return { ...base, status, reason };
}

/**
 * Takes the key, or reports that somebody else already has it.
 *
 * A row left as FAILED is not a duplicate — the message never arrived,
 * so a later attempt is allowed to try again. Only SENT and SKIPPED
 * mean "this has been dealt with".
 */
async function claimKey(
  dedupeKeyValue: string,
  event: NotificationEvent,
  channel: NotificationChannel,
  recipient: string,
  bookingId: string | null,
  businessId: string,
): Promise<"claimed" | "taken"> {
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
        status: "SENT", // corrected the moment the send returns
        recipient,
        bookingId,
        businessId,
      },
    ],
    skipDuplicates: true,
  });
  if (claim.count === 1) return "claimed";

  // Somebody already holds it. A row left as FAILED means the message
  // never arrived, so a later attempt may take it over and try again.
  const existing = await db.notificationDelivery.findUnique({
    where: { dedupeKey: dedupeKeyValue },
    select: { status: true },
  });
  if (existing?.status === "FAILED") {
    await db.notificationDelivery.update({
      where: { dedupeKey: dedupeKeyValue },
      data: { status: "SENT", error: null },
    });
    return "claimed";
  }
  return "taken";
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

async function loadBooking(bookingId: string): Promise<Loaded | null> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      accessToken: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerPhoneE164: true,
      staffMemberId: true,
      date: true,
      startTime: true,
      endTime: true,
      notes: true,
      totalPrice: true,
      depositAmount: true,
      currency: true,
      service: { select: { nameAr: true } },
      customer: { select: { email: true } },
      business: { select: BUSINESS_SELECT },
    },
  });
  if (!b) return null;

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
      customerEmail: b.customer?.email ?? null,
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
