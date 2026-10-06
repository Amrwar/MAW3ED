import type { NotificationKind } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { normaliseEgyptianMobile } from "@/lib/verification";

/**
 * Recording something a customer should know about.
 *
 * Only reaches an account that exists: a customer who has never signed
 * in has no User row, so there is nowhere to put the notification and
 * nothing is written. Their booking link still works and they still get
 * the WhatsApp message — this is the in-app history, not the delivery.
 *
 * Deliberately never throws. A booking must not fail because a
 * notification could not be filed next to it.
 */
export async function notifyCustomer(input: {
  /** The phone the booking was made under. */
  phone: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  bookingId?: string | null;
}): Promise<void> {
  try {
    // The caller passes a booking's phone, which is whatever the
    // customer typed. An account's phone is canonical, so it has to be
    // put into the same form before the two can be compared.
    const phone = normaliseEgyptianMobile(input.phone);
    if (!phone) return;

    const user = await db.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (!user) return;

    await db.notification.create({
      data: {
        userId: user.id,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        bookingId: input.bookingId ?? null,
      },
    });
  } catch (e) {
    log.error("[notifyCustomer]", e);
  }
}

/* ─── The wording, in one place ──────────────────────────── */

export const NOTIFY_COPY = {
  confirmed: (business: string, when: string) => ({
    kind: "BOOKING_CONFIRMED" as NotificationKind,
    title: `تم تأكيد حجزك في ${business}`,
    body: `موعدك ${when}.`,
  }),
  cancelled: (business: string) => ({
    kind: "BOOKING_CANCELLED" as NotificationKind,
    title: `تم إلغاء حجزك في ${business}`,
    body: "لو ده مكانش قصدك، تقدر تحجز تاني في أي وقت.",
  }),
  rescheduled: (business: string, when: string) => ({
    kind: "BOOKING_RESCHEDULED" as NotificationKind,
    title: `اتغيّر موعدك في ${business}`,
    body: `الموعد الجديد ${when}.`,
  }),
  completed: (business: string) => ({
    kind: "BOOKING_COMPLETED" as NotificationKind,
    title: `شكرًا لزيارتك ${business}`,
    body: "تقييمك بيساعد ناس تانية تختار صح.",
  }),
} as const;
