import type { BookingStatus, DeliveryStatus, NotificationChannel, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { minutesToTime, timeToMinutes } from "./time";
import { CUTOFF_HOURS, customerMayChange } from "./self-service";

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
    logoImage: string | null;
    cityNameAr: string;
    cityNameEn: string;
  };
  service: { id: string; nameAr: string; nameEn: string | null };
  staff: { id: string; nameAr: string; nameEn: string | null } | null;
  resource: { id: string; name: string; kind: string } | null;
  branch: { id: string; nameAr: string; nameEn: string | null; address: string | null } | null;
  /** The deposit, when one was asked for: where its money stands. */
  payment: { status: PaymentStatus; amount: number; currency: string; paidAt: string | null } | null;
  /** What has been sent to the customer about this booking, per channel. */
  notifications: { channel: NotificationChannel; status: DeliveryStatus }[];
  /** The customer may still cancel or move it themselves (website link). */
  canChange: boolean;
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
      business: {
        select: {
          slug: true,
          nameAr: true,
          nameEn: true,
          phone: true,
          whatsapp: true,
          address: true,
          logoImage: true,
          city: { select: { nameAr: true, nameEn: true } },
        },
      },
      service: { select: { id: true, nameAr: true, nameEn: true, duration: true } },
      staffMember: { select: { id: true, nameAr: true, nameEn: true } },
      resource: { select: { id: true, name: true, kind: true } },
      branch: { select: { id: true, nameAr: true, nameEn: true, address: true } },
      payments: {
        where: { kind: "BOOKING_DEPOSIT" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, amountCents: true, currency: true, paidAt: true },
      },
    },
  });
  if (!b) return null;

  const deliveries = await db.notificationDelivery.findMany({
    where: { bookingId: b.id, dedupeKey: { contains: ":customer:" } },
    select: { channel: true, status: true },
  });

  const endTime = b.endTime ?? minutesToTime(timeToMinutes(b.startTime) + b.service.duration);
  const payment = b.payments[0] ?? null;

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
      logoImage: b.business.logoImage,
      cityNameAr: b.business.city.nameAr,
      cityNameEn: b.business.city.nameEn,
    },
    service: { id: b.service.id, nameAr: b.service.nameAr, nameEn: b.service.nameEn },
    staff: b.staffMember,
    resource: b.resource,
    branch: b.branch,
    payment: payment
      ? {
          status: payment.status,
          amount: payment.amountCents / 100,
          currency: payment.currency,
          paidAt: payment.paidAt?.toISOString() ?? null,
        }
      : null,
    notifications: summariseDeliveries(deliveries),
    canChange: customerMayChange(b, now),
    changeCutoffHours: CUTOFF_HOURS,
  };
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
