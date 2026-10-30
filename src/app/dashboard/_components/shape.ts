import type { Prisma } from "@prisma/client";
import { BOOKING_LIST_SELECT } from "@/lib/dashboard/queries";
import type { ListedBooking } from "./BookingList";

type Row = Prisma.BookingGetPayload<{ select: typeof BOOKING_LIST_SELECT }>;

/**
 * A booking row as the list renders it.
 *
 * Here rather than in each page because Decimal and Date must not cross
 * into a client component — the one that did cost a hydration failure
 * on the live site once already.
 */
export function shapeBooking(b: Row): ListedBooking {
  return {
    id: b.id,
    reference: b.reference,
    isTest: b.isTest,
    status: b.status,
    at: b.startsAt ? b.startsAt.toISOString() : null,
    date: b.date.toISOString().slice(0, 10),
    startTime: b.startTime,
    endTime: b.endTime,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    customerId: b.customer?.id ?? null,
    serviceName: b.service.nameAr,
    staffName: b.staffMember?.nameAr ?? null,
    resourceName: b.resource?.name ?? null,
    branchName: b.branch?.nameAr ?? null,
    partySize: b.partySize,
    price: Number(b.totalPrice),
    currency: b.currency,
    notes: b.notes,
  };
}
