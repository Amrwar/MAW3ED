import type { BookingStatus, DeliveryStatus, NotificationChannel, PaymentStatus, ReviewStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { minutesToTime, timeToMinutes } from "./time";
import { CUTOFF_HOURS, customerMayCancel, customerMayChange } from "./self-service";
import { bookingMoney, toCents } from "@/lib/payments/money";
import { canEditReview, canReviewBooking } from "@/lib/review-policy";

/**
 * One booking as its holder may see it, for the app.
 *
 * The website renders /booking/[token] on the server; the app cannot, so
 * this is the same record over HTTP — read from the database every time,
 * because it is what the app's confirmation screen trusts. A confirmed
 * screen is only ever drawn from a status read here, never from what a
 * create request or a payment redirect claimed.
 *
 * The access token is the authorisation, exactly as for the page: the
 * customer has it, nobody else does. Nothing returned identifies anyone
 * but the customer themselves and the business.
 */

export interface PublicBooking {
  id: string;
  reference: string | null;
  status: BookingStatus;
  /** YYYY-MM-DD, Cairo. */
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  partySize: number | null;
  notes: string | null;
  customerName: string;
  totalPrice: number;
  depositAmount: number | null;
  discountAmount: number;
  currency: string;
  createdAt: string;
  business: {
    slug: string;
    nameAr: string;
    nameEn: string | null;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
    /** The owner's pin, for exact directions; null when none is set. */
    location: { lat: number; lng: number } | null;
    logoImage: string | null;
    cityNameAr: string;
    cityNameEn: string;
  };
  service: { id: string; nameAr: string; nameEn: string | null };
  staff: { id: string; nameAr: string; nameEn: string | null } | null;
  resource: { id: string; name: string; kind: string } | null;
  branch: { id: string; nameAr: string; nameEn: string | null; address: string | null; location: { lat: number; lng: number } | null } | null;
  /** The deposit, when one was asked for: where its money stands. */
  payment: {
    status: PaymentStatus;
    amount: number;
    /** What has actually been refunded, from the ledger. Never a promise. */
    refunded: number;
    currency: string;
    paidAt: string | null;
  } | null;
  /**
   * Every payment against the booking, deposit, balance and cash alike,
   * less refunds. `outstanding` is what is left to pay at the venue —
   * zero means paid in full.
   */
  money: { paid: number; refunded: number; outstanding: number };
  /** What has been sent to the customer about this booking, per channel. */
  notifications: { channel: NotificationChannel; status: DeliveryStatus }[];
  /** The customer may still cancel or move it themselves. */
  canChange: boolean;
  /** The customer may cancel — canChange, or a booking still awaiting its deposit. */
  canCancel: boolean;
  /** The server's own eligibility rule (lib/review-policy): completed, within the window, not yet reviewed. */
  canReview: boolean;
  /** Why not, when the app needs to say so. */
  reviewBlock: "not-completed" | "already-reviewed" | "too-late" | null;
  review: {
    rating: number;
    comment: string | null;
    response: string | null;
    createdAt: string;
    status: string;
    canEdit: boolean;
  } | null;
  changeCutoffHours: number;
}

export async function getPublicBooking(token: string, now: Date = new Date()): Promise<PublicBooking | null> {
  const b = await db.booking.findUnique({
    where: { accessToken: token },
    select: {
      id: true,
      reference: true,
      status: true,
      date: true,
      startTime: true,
      endTime: true,
      partySize: true,
      notes: true,
      customerName: true,
      totalPrice: true,
      depositAmount: true,
      discountCents: true,
      currency: true,
      createdAt: true,
      endsAt: true,
      review: { select: { id: true, rating: true, comment: true, response: true, createdAt: true, status: true } },
      business: {
        select: {
          slug: true,
          nameAr: true,
          nameEn: true,
          phone: true,
          whatsapp: true,
          address: true,
          latitude: true,
          longitude: true,
          logoImage: true,
          city: { select: { nameAr: true, nameEn: true } },
        },
      },
      service: { select: { id: true, nameAr: true, nameEn: true, duration: true } },
      staffMember: { select: { id: true, nameAr: true, nameEn: true } },
      resource: { select: { id: true, name: true, kind: true } },
      branch: { select: { id: true, nameAr: true, nameEn: true, address: true, latitude: true, longitude: true } },
      payments: {
        where: { kind: { not: "SUBSCRIPTION" } },
        orderBy: { createdAt: "desc" },
        select: { kind: true, status: true, amountCents: true, refundedCents: true, currency: true, paidAt: true },
      },
    },
  });
  if (!b) return null;

  const deliveries = await db.notificationDelivery.findMany({
    where: { bookingId: b.id, dedupeKey: { contains: ":customer:" } },
    select: { channel: true, status: true },
  });

  const endTime = b.endTime ?? minutesToTime(timeToMinutes(b.startTime) + b.service.duration);
  // `payment` stays the latest deposit, as the app has always read it.
  const payment = b.payments.find((p) => p.kind === "BOOKING_DEPOSIT") ?? null;
  const ledger = bookingMoney(toCents(b.totalPrice), b.payments);

  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    date: b.date.toISOString().slice(0, 10),
    startTime: b.startTime,
    endTime,
    durationMinutes: timeToMinutes(endTime) - timeToMinutes(b.startTime),
    partySize: b.partySize,
    notes: b.notes,
    customerName: b.customerName,
    totalPrice: Number(b.totalPrice),
    depositAmount: b.depositAmount === null ? null : Number(b.depositAmount),
    discountAmount: b.discountCents / 100,
    currency: b.currency,
    createdAt: b.createdAt.toISOString(),
    business: {
      slug: b.business.slug,
      nameAr: b.business.nameAr,
      nameEn: b.business.nameEn,
      phone: b.business.phone,
      whatsapp: b.business.whatsapp,
      address: b.business.address,
      location: pin(b.business.latitude, b.business.longitude),
      logoImage: b.business.logoImage,
      cityNameAr: b.business.city.nameAr,
      cityNameEn: b.business.city.nameEn,
    },
    service: { id: b.service.id, nameAr: b.service.nameAr, nameEn: b.service.nameEn },
    staff: b.staffMember,
    resource: b.resource,
    branch: b.branch
      ? { id: b.branch.id, nameAr: b.branch.nameAr, nameEn: b.branch.nameEn, address: b.branch.address, location: pin(b.branch.latitude, b.branch.longitude) }
      : null,
    payment: payment
      ? {
          status: payment.status,
          amount: payment.amountCents / 100,
          refunded: payment.refundedCents / 100,
          currency: payment.currency,
          paidAt: payment.paidAt?.toISOString() ?? null,
        }
      : null,
    money: {
      paid: ledger.netPaidCents / 100,
      refunded: ledger.refundedCents / 100,
      outstanding: ledger.outstandingCents / 100,
    },
    notifications: summariseDeliveries(deliveries),
    canChange: customerMayChange(b, now),
    canCancel: customerMayCancel(b, now),
    changeCutoffHours: CUTOFF_HOURS,
    ...reviewState(b, now),
  };
}

function reviewState(
  b: {
    status: string;
    endsAt: Date | null;
    date: Date;
    startTime: string;
    review: { id: string; rating: number; comment: string | null; response: string | null; createdAt: Date; status: ReviewStatus } | null;
  },
  now: Date,
): Pick<PublicBooking, "canReview" | "reviewBlock" | "review"> {
  const check = canReviewBooking(b, now);
  return {
    canReview: check.allowed,
    // "too-early" (marked completed before the appointment started) is
    // reported as "not-completed": to the customer the visit has not
    // happened yet, and the app's reviewBlock union stays unchanged.
    reviewBlock: check.allowed || check.reason === "ok" ? null : check.reason === "too-early" ? "not-completed" : check.reason,
    review: b.review
      ? {
          rating: b.review.rating,
          comment: b.review.comment,
          response: b.review.response,
          createdAt: b.review.createdAt.toISOString(),
          status: b.review.status,
          canEdit: canEditReview(b.review, now).allowed,
        }
      : null,
  };
}

function pin(lat: number | null, lng: number | null): { lat: number; lng: number } | null {
  return lat !== null && lng !== null ? { lat, lng } : null;
}

/**
 * One line per channel. A channel that delivered anything counts as
 * sent; otherwise a failure is worth saying; a skip is said only when
 * that is all there is.
 */
export function summariseDeliveries(
  rows: { channel: NotificationChannel; status: DeliveryStatus }[],
): { channel: NotificationChannel; status: DeliveryStatus }[] {
  const rank: Record<DeliveryStatus, number> = { SENT: 3, FAILED: 2, SKIPPED: 1 };
  const best = new Map<NotificationChannel, DeliveryStatus>();
  for (const r of rows) {
    const held = best.get(r.channel);
    if (!held || rank[r.status] > rank[held]) best.set(r.channel, r.status);
  }
  return [...best].map(([channel, status]) => ({ channel, status }));
}
