import type { Audience, NotificationEvent } from "./events";

/**
 * What each notification says.
 *
 * One place, so the in-app card, the email subject and the SMS all tell
 * the same story, and so a wording change is one edit rather than a
 * hunt through five routes.
 *
 * The text is written to still read correctly months later: a stored
 * notification says "الأربعاء، 7 أكتوبر" and never "tomorrow", because
 * the customer may well open it in December.
 */

export interface Copy {
  title: string;
  body?: string;
}

export interface CopyContext {
  businessName: string;
  serviceName: string;
  /** Already formatted, e.g. "الأربعاء، 7 أكتوبر — 14:00". */
  when: string;
  customerName: string;
  amount?: string;
}

export function copyFor(
  event: NotificationEvent,
  audience: Audience,
  c: CopyContext,
): Copy {
  const forCustomer = audience === "customer";

  switch (event.type) {
    case "booking.created":
      return forCustomer
        ? {
            title: `وصل طلب حجزك في ${c.businessName}`,
            body: `${c.serviceName} — ${c.when}. هنأكدلك قريب.`,
          }
        : {
            title: `حجز جديد من ${c.customerName}`,
            body: `${c.serviceName} — ${c.when}.`,
          };

    case "booking.confirmed":
      return {
        title: `تم تأكيد حجزك في ${c.businessName}`,
        body: `${c.serviceName} — ${c.when}.`,
      };

    case "booking.rejected":
      return {
        title: `معلش، ${c.businessName} مش هيقدر ياخد الحجز ده`,
        body: "تقدر تجرب معاد تاني، والمكان لسه متاح للحجز.",
      };

    case "booking.cancelled":
      return forCustomer
        ? {
            title: `تم إلغاء حجزك في ${c.businessName}`,
            body:
              event.by === "business"
                ? "المكان ألغى الموعد. تقدر تحجز تاني في أي وقت."
                : "لو ده مكانش قصدك، تقدر تحجز تاني في أي وقت.",
          }
        : {
            title: `${c.customerName} ألغى حجزه`,
            body: `${c.serviceName} — ${c.when}. الميعاد بقى فاضي تاني.`,
          };

    case "booking.rescheduled":
      return forCustomer
        ? {
            title: `اتغيّر موعدك في ${c.businessName}`,
            body: `الموعد الجديد ${c.when}.`,
          }
        : {
            title: `${c.customerName} غيّر موعده`,
            body: `${c.serviceName} — الموعد الجديد ${c.when}.`,
          };

    case "booking.reminder":
      return {
        title: `فاكر موعدك في ${c.businessName}؟`,
        body: `${c.serviceName} — ${c.when}.`,
      };

    case "booking.startingSoon":
      return {
        title: `موعدك في ${c.businessName} قرّب`,
        body: `${c.serviceName} — ${c.when}.`,
      };

    case "booking.completed":
      return {
        title: `شكرًا لزيارتك ${c.businessName}`,
        body: "تقييمك بيساعد ناس تانية تختار صح.",
      };

    case "review.requested":
      return {
        title: `قيّم زيارتك لـ ${c.businessName}`,
        body: "دقيقة واحدة بتفرق مع ناس كتير بتدوّر على مكان كويس.",
      };

    case "payment.received":
      return forCustomer
        ? {
            title: `وصلنا دفعة ${c.amount} لحجزك في ${c.businessName}`,
            body: `${c.serviceName} — ${c.when}.`,
          }
        : {
            title: `دفعة ${c.amount} من ${c.customerName}`,
            body: `${c.serviceName} — ${c.when}.`,
          };

    case "payment.failed":
      return forCustomer
        ? {
            title: "الدفع ما تمّش",
            body: `حجزك في ${c.businessName} لسه محجوز. جرّب تدفع تاني من صفحة الحجز.`,
          }
        : {
            title: `دفعة ${c.customerName} ما تمّتش`,
            body: `${c.serviceName} — ${c.when}.`,
          };

    case "subscription.renewalDue":
      return {
        title: `اشتراكك هينتهي خلال ${event.daysLeft} يوم`,
        body: "جدّد عشان صفحتك تفضل ظاهرة والحجوزات تفضل شغالة.",
      };

    case "subscription.expired":
      return {
        title: "انتهى اشتراكك في موعد",
        body: "صفحتك مش ظاهرة للعملاء دلوقتي. جدّد عشان ترجع تستقبل حجوزات.",
      };

    case "subscription.renewed":
      return {
        title: "تم تجديد اشتراكك",
        body: `اشتراكك ساري لحد ${event.until.toISOString().slice(0, 10)}.`,
      };
  }
}

/** The subject line, when the channel needs one of its own. */
export function emailSubject(copy: Copy): string {
  return copy.title;
}

/**
 * One SMS, short enough not to split into two billed messages.
 * 160 characters is the GSM-7 limit; Arabic is UCS-2 and splits at 70,
 * so this trims to something that reads as one thought either way.
 */
export function smsText(copy: Copy, max = 140): string {
  const full = copy.body ? `${copy.title} — ${copy.body}` : copy.title;
  return full.length <= max ? full : `${full.slice(0, max - 1).trimEnd()}…`;
}
