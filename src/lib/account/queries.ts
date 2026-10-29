import type { BookingStatus, Notification, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pendingEmailFor } from "@/lib/account/pending-email";
import { cairoDateString, cairoMinutes, cairoWallClock, dateToUTC } from "@/lib/bookings/instants";
import { minutesToTime, timeToMinutes } from "@/lib/bookings/time";
import { customerMayChange } from "@/lib/bookings/self-service";
import { canReviewBooking } from "@/lib/review-policy";

/**
 * Everything the customer account reads.
 *
 * A customer is a User with a verified phone. Their bookings are not
 * joined by a foreign key — they are found by that phone, which is the
 * key a booking was always made under. The OTP proved they control it,
 * so the match is the authorisation.
 *
 * The match is on Booking.customerPhoneE164, never on customerPhone.
 * A booking stores the number exactly as it was typed — "01107578212",
 * "+20 110 757 8212" — while an account's phone is canonical, so
 * comparing the two directly matches nothing and shows the customer an
 * empty account. customerPhoneE164 is a column the database generates
 * from customerPhone; see prisma/migrations/add_booking_phone_e164.sql.
 */

export interface AccountUser {
  id: string;
  name: string | null;
  email: string | null;
  /** A new address waiting on its confirmation link, if any. */
  pendingEmail: string | null;
  phone: string;
  notifyByWhatsApp: boolean;
  notifyByEmail: boolean;
}

/** Null when nobody is signed in, or when the account has no phone. */
export async function getAccountUser(): Promise<AccountUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      phoneVerifiedAt: true,
      notifyByWhatsApp: true,
      notifyByEmail: true,
    },
  });

  // An owner who signed in with email has no verified phone, so there
  // are no bookings to attribute to them here. They are sent to add one
  // rather than shown an empty account.
  if (!user?.phone || !user.phoneVerifiedAt) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    pendingEmail: await pendingEmailFor(user.id, user.email),
    phone: user.phone,
    notifyByWhatsApp: user.notifyByWhatsApp,
    notifyByEmail: user.notifyByEmail,
  };
}

export interface AccountBooking {
  id: string;
  reference: string | null;
  accessToken: string | null;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  /** Minutes from now until it starts. Negative once it has passed. */
  minutesUntil: number;
  serviceName: string;
  /** English names, where the business gave one; the app falls back to Arabic. */
  serviceNameEn: string | null;
  staffName: string | null;
  staffNameEn: string | null;
  resourceName: string | null;
  branchName: string | null;
  branchNameEn: string | null;
  partySize: number | null;
  totalPrice: number;
  depositAmount: number | null;
  currency: string;
  business: {
    slug: string;
    nameAr: string;
    nameEn: string | null;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
    logoImage: string | null;
    coverImage: string | null;
    categorySlug: string;
    cityName: string;
    cityNameEn: string;
    neighborhoodName: string | null;
  };
  /** True once reviewed, so the card offers it only when it can be done. */
  hasReview: boolean;
  canReview: boolean;
  /**
   * Whether the booking page will let them reschedule or cancel — the
   * same rule, so the card does not offer a button that leads to a page
   * without it (inside the two-hour window, or already in the chair).
   */
  canChange: boolean;
}

/** Still holding a slot — these are the ones that appear as upcoming. */
const LIVE: BookingStatus[] = ["PENDING_PAYMENT", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS"];

const BOOKING_SELECT = {
  id: true,
  reference: true,
  accessToken: true,
  status: true,
  date: true,
  startTime: true,
  endTime: true,
  partySize: true,
  totalPrice: true,
  depositAmount: true,
  currency: true,
  endsAt: true,
  service: { select: { nameAr: true, nameEn: true, duration: true } },
  staffMember: { select: { nameAr: true, nameEn: true } },
  resource: { select: { name: true } },
  branch: { select: { nameAr: true, nameEn: true, address: true } },
  review: { select: { id: true } },
  business: {
    select: {
      slug: true,
      nameAr: true,
      nameEn: true,
      phone: true,
      whatsapp: true,
      address: true,
      logoImage: true,
      coverImage: true,
      category: { select: { slug: true } },
      city: { select: { nameAr: true, nameEn: true } },
      neighborhood: { select: { nameAr: true } },
    },
  },
} as const;

type Row = Awaited<ReturnType<typeof db.booking.findMany<{ select: typeof BOOKING_SELECT }>>>[number];

function shape(b: Row, todayDate: string, nowMin: number): AccountBooking {
  const startMin = timeToMinutes(b.startTime);
  const endMin = b.endTime ? timeToMinutes(b.endTime) : startMin + b.service.duration;
  const date = b.date.toISOString().slice(0, 10);

  // Whole days between today and the appointment, times a day of
  // minutes, plus the difference within the day.
  const dayDiff = Math.round(
    (Date.parse(date + "T00:00:00Z") - Date.parse(todayDate + "T00:00:00Z")) / 86_400_000,
  );

  return {
    id: b.id,
    reference: b.reference,
    accessToken: b.accessToken,
    status: b.status,
    date,
    startTime: b.startTime,
    endTime: b.endTime ?? minutesToTime(endMin),
    durationMinutes: endMin - startMin,
    minutesUntil: dayDiff * 24 * 60 + (startMin - nowMin),
    serviceName: b.service.nameAr,
    serviceNameEn: b.service.nameEn,
    staffName: b.staffMember?.nameAr ?? null,
    staffNameEn: b.staffMember?.nameEn ?? null,
    resourceName: b.resource?.name ?? null,
    branchName: b.branch?.nameAr ?? null,
    branchNameEn: b.branch?.nameEn ?? null,
    partySize: b.partySize,
    totalPrice: Number(b.totalPrice),
    depositAmount: b.depositAmount === null ? null : Number(b.depositAmount),
    currency: b.currency,
    business: {
      slug: b.business.slug,
      nameAr: b.business.nameAr,
      nameEn: b.business.nameEn,
      phone: b.business.phone,
      whatsapp: b.business.whatsapp,
      address: b.branch?.address ?? b.business.address,
      logoImage: b.business.logoImage,
      coverImage: b.business.coverImage,
      categorySlug: b.business.category.slug,
      cityName: b.business.city.nameAr,
      cityNameEn: b.business.city.nameEn,
      neighborhoodName: b.business.neighborhood?.nameAr ?? null,
    },
    hasReview: b.review !== null,
    // The review route's own rule, window included, so the list never
    // offers a review the server would refuse.
    canReview: canReviewBooking(b).allowed,
    canChange: customerMayChange(b),
  };
}

/**
 * When a booking is over, as where clauses — the one rule both tabs use,
 * so every booking is in exactly one of them.
 *
 * The effective end is:
 *   1. endsAt, when the row has it (Cairo wall clock written as UTC, see
 *      lib/bookings/instants — compared with cairoWallClock);
 *   2. for a row written before endsAt existed, its date + endTime;
 *   3. with no endTime either, its date + startTime. A booking does not
 *      store its own duration, and the service's current duration is not
 *      what was booked, so the start is the last fact the row holds.
 *
 * Times are "HH:MM", zero-padded, so they compare as strings; "now" is
 * taken to the minute on both sides. ended and notEnded are written out
 * as exact complements (not NOT(...), which SQL's NULLs would break).
 */
function endRule(now: Date) {
  const wall = cairoWallClock(now);
  const today = dateToUTC(cairoDateString(now));
  const hhmm = minutesToTime(cairoMinutes(now));
  const ended: Prisma.BookingWhereInput[] = [
    { endsAt: { lte: wall } },
    { endsAt: null, endTime: { not: null }, date: { lt: today } },
    { endsAt: null, endTime: { not: null, lte: hhmm }, date: today },
    { endsAt: null, endTime: null, date: { lt: today } },
    { endsAt: null, endTime: null, startTime: { lte: hhmm }, date: today },
  ];
  const notEnded: Prisma.BookingWhereInput[] = [
    { endsAt: { gt: wall } },
    { endsAt: null, endTime: { not: null }, date: { gt: today } },
    { endsAt: null, endTime: { not: null, gt: hhmm }, date: today },
    { endsAt: null, endTime: null, date: { gt: today } },
    { endsAt: null, endTime: null, startTime: { gt: hhmm }, date: today },
  ];
  return { ended, notEnded };
}

/** Still holding a slot and not yet over: the upcoming tab. */
export function upcomingWhere(phone: string, now: Date = new Date()): Prisma.BookingWhereInput {
  return { customerPhoneE164: phone, status: { in: LIVE }, OR: endRule(now).notEnded };
}

/**
 * Everything else: no longer holding a slot, or over. The exact
 * complement of upcomingWhere.
 */
export function historyWhere(phone: string, now: Date = new Date()): Prisma.BookingWhereInput {
  return { customerPhoneE164: phone, OR: [{ status: { notIn: LIVE } }, ...endRule(now).ended] };
}

/**
 * Appointments that have not happened yet.
 *
 * "Upcoming" is by instant, not by date: an appointment at 09:00 today
 * is history by lunchtime, and showing it as upcoming all day is how a
 * customer ends up at a closed door.
 */
export async function getUpcoming(phone: string): Promise<AccountBooking[]> {
  const now = new Date();
  const rows = await db.booking.findMany({
    where: upcomingWhere(phone, now),
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
    select: BOOKING_SELECT,
  });
  return rows.map((r) => shape(r, cairoDateString(now), cairoMinutes(now)));
}

/* History is ordered date desc, startTime desc, id desc; a cursor is the
   last row's three keys, so the next page starts strictly after it
   whatever moved into history in the meantime. Opaque to clients. */

export function encodeHistoryCursor(b: { date: string; startTime: string; id: string }): string {
  return Buffer.from(`${b.date}|${b.startTime}|${b.id}`, "utf8").toString("base64url");
}

export function decodeHistoryCursor(cursor: string): { date: Date; startTime: string; id: string } | null {
  try {
    const [date, startTime, id, extra] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (extra !== undefined || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !/^\d{2}:\d{2}$/.test(startTime ?? "") || !id) {
      return null;
    }
    const d = new Date(`${date}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : { date: d, startTime, id };
  } catch {
    return null;
  }
}

/**
 * Everything else: finished, cancelled, missed, or simply past.
 *
 * Paged either by offset (skip/take, kept for existing clients) or by
 * `cursor` — the nextCursor of the previous page — which does not shift
 * when a booking moves into history while somebody is paging. `total`
 * is the whole history either way; nextCursor is null on the last page.
 */
export async function getHistory(
  phone: string,
  opts: { take?: number; skip?: number; cursor?: string | null } = {},
): Promise<{ bookings: AccountBooking[]; total: number; nextCursor: string | null }> {
  const now = new Date();
  const today = cairoDateString(now);
  const nowMin = cairoMinutes(now);
  const take = opts.take ?? 20;
  const where = historyWhere(phone, now);

  const after = opts.cursor ? decodeHistoryCursor(opts.cursor) : null;
  const pageWhere: Prisma.BookingWhereInput = after
    ? {
        AND: [
          where,
          {
            OR: [
              { date: { lt: after.date } },
              { date: after.date, startTime: { lt: after.startTime } },
              { date: after.date, startTime: after.startTime, id: { lt: after.id } },
            ],
          },
        ],
      }
    : where;

  // The filter is in the query and the count is over the same set, so a
  // page holds exactly the rows a client is shown. id breaks ties, so
  // two bookings at the same minute keep their order across pages.
  const [rows, total] = await Promise.all([
    db.booking.findMany({
      where: pageWhere,
      orderBy: [{ date: "desc" }, { startTime: "desc" }, { id: "desc" }],
      take: take + 1,
      skip: after ? 0 : (opts.skip ?? 0),
      select: BOOKING_SELECT,
    }),
    db.booking.count({ where }),
  ]);

  const bookings = rows.slice(0, take).map((r) => shape(r, today, nowMin));
  const last = bookings[bookings.length - 1];
  const nextCursor = rows.length > take && last ? encodeHistoryCursor(last) : null;
  return { bookings, total, nextCursor };
}

export async function getFavorites(userId: string) {
  return db.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      business: {
        select: {
          id: true,
          slug: true,
          nameAr: true,
          nameEn: true,
          logoImage: true,
          coverImage: true,
          isVerified: true,
          ratingAvg: true,
          ratingCount: true,
          category: { select: { slug: true, nameAr: true, nameEn: true } },
          city: { select: { nameAr: true, nameEn: true } },
        },
      },
    },
  });
}

/** Reviews this customer has left, newest first. */
export async function getMyReviews(phone: string) {
  return db.review.findMany({
    where: { booking: { customerPhoneE164: phone } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      response: true,
      respondedAt: true,
      createdAt: true,
      business: { select: { slug: true, nameAr: true, logoImage: true } },
      booking: { select: { date: true, service: { select: { nameAr: true } } } },
    },
  });
}

/**
 * A page of notifications, newest first, and how many are unread.
 *
 * Cursor-paged: `cursor` is the id of the last item of the previous page
 * and `nextCursor` is null on the last page. A cursor rather than an
 * offset because new notifications arrive at the top while somebody is
 * reading, which would shift every offset by one. A cursor that is not
 * this user's (or no longer exists) is treated as the start.
 */
export async function getNotifications(
  userId: string,
  take = 50,
  cursor?: string | null,
): Promise<{ items: Notification[]; unread: number; nextCursor: string | null }> {
  const from = cursor
    ? await db.notification.findFirst({ where: { id: cursor, userId }, select: { id: true } })
    : null;

  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(from ? { cursor: { id: from.id }, skip: 1 } : {}),
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  const items = rows.slice(0, take);
  const nextCursor = rows.length > take ? items[items.length - 1].id : null;
  return { items, unread, nextCursor };
}

/**
 * The four numbers the account overview leads with.
 *
 * Four, not five: the tiles are a 2x2 on a phone and a single row on a
 * wide screen, and a fifth would sit alone on its own line. A review
 * count is not queried here because nothing shows it — the reviews
 * section is reached from the nav.
 */
export async function getAccountSummary(userId: string, phone: string) {
  const [upcoming, total, favorites, unread] = await Promise.all([
    getUpcoming(phone).then((b) => b.length),
    db.booking.count({ where: { customerPhoneE164: phone } }),
    db.favorite.count({ where: { userId } }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { upcoming, total, favorites, unread };
}

/**
 * Every payment this customer has made, newest first.
 *
 * Matched the same way bookings are — on the generated
 * customerPhoneE164 column, never on whatever they typed — so a number
 * written 01107578212 one day and +20 110 757 8212 the next still finds
 * the same history.
 *
 * Failed and abandoned attempts are left out. A customer looking for a
 * receipt does not need to be reminded of a card that was declined
 * three weeks ago; the owner and the admin can both still see them.
 */
export async function getPaymentHistory(phone: string) {
  const rows = await db.payment.findMany({
    where: {
      booking: { customerPhoneE164: phone },
      status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] },
    },
    orderBy: { paidAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      status: true,
      method: true,
      provider: true,
      amountCents: true,
      refundedCents: true,
      currency: true,
      receiptNumber: true,
      paidAt: true,
      booking: {
        select: {
          id: true,
          reference: true,
          date: true,
          startTime: true,
          service: { select: { nameAr: true, nameEn: true } },
          business: { select: { nameAr: true, nameEn: true, slug: true } },
        },
      },
    },
  });

  return rows.map((p) => ({
    id: p.id,
    kind: p.kind,
    status: p.status,
    method: p.method,
    amountCents: p.amountCents,
    refundedCents: p.refundedCents,
    currency: p.currency,
    receiptNumber: p.receiptNumber,
    paidAt: p.paidAt?.toISOString() ?? null,
    bookingRef: p.booking?.reference ?? null,
    bookingDate: p.booking?.date.toISOString() ?? null,
    startTime: p.booking?.startTime ?? null,
    serviceAr: p.booking?.service.nameAr ?? null,
    serviceEn: p.booking?.service.nameEn ?? null,
    businessAr: p.booking?.business.nameAr ?? null,
    businessEn: p.booking?.business.nameEn ?? null,
    businessSlug: p.booking?.business.slug ?? null,
  }));
}

export type AccountPayment = Awaited<ReturnType<typeof getPaymentHistory>>[number];
