import { arCount, dateFull } from "@/lib/fmt";
import { PLAN_FEATURES } from "@/lib/plans";
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
  /** The booking's status when the message is written, e.g. "PENDING". */
  status?: string;
  /** The old time of a rescheduled booking, formatted like `when`. */
  previousWhen?: string;
}

export function copyFor(
  event: NotificationEvent,
  audience: Audience,
  c: CopyContext,
): Copy {
  const forCustomer = audience === "customer";
  const pending = c.status === "PENDING";
  const was = c.previousWhen ? ` (كان ${c.previousWhen})` : "";

  switch (event.type) {
    case "booking.created":
      return forCustomer
        ? pending
          ? {
              title: `وصل طلب حجزك في ${c.businessName}`,
              body: `${c.serviceName} — ${c.when}. ${c.businessName} هيراجع الحجز ويأكده، وهيوصلك إشعار.`,
            }
          : {
              title: `تم تأكيد حجزك في ${c.businessName}`,
              body: `${c.serviceName} — ${c.when}.`,
            }
        : {
            title: `حجز جديد من ${c.customerName}`,
            body: pending
              ? `${c.serviceName} — ${c.when}. مستني تأكيدك.`
              : `${c.serviceName} — ${c.when}.`,
          };

    case "booking.confirmed":
      return {
        title: `تم تأكيد حجزك في ${c.businessName}`,
        body: `${c.serviceName} — ${c.when}.`,
      };

    case "booking.rejected":
      return {
        title: `معلش، ${c.businessName} مش هيقدر ياخد الحجز ده`,
        body: "تقدر تجرّب ميعاد تاني، والمكان لسه متاح للحجز.",
      };

    case "booking.cancelled":
      return forCustomer
        ? {
            title: `تم إلغاء حجزك في ${c.businessName}`,
            body:
              event.by === "business"
                ? "المكان ألغى الميعاد. تقدر تحجز تاني في أي وقت."
                : "لو ده مكانش قصدك، تقدر تحجز تاني في أي وقت.",
          }
        : {
            title: `${c.customerName} ألغى حجزه`,
            body: `${c.serviceName} — ${c.when}. الميعاد بقى فاضي تاني.`,
          };

    case "booking.rescheduled":
      return forCustomer
        ? {
            title:
              event.by === "business"
                ? `${c.businessName} غيّر ميعادك`
                : `اتغيّر ميعادك في ${c.businessName}`,
            body: pending
              ? `الميعاد الجديد ${c.when}${was}. ${c.businessName} هيأكده، وهيوصلك إشعار.`
              : `الميعاد الجديد ${c.when}${was}.`,
          }
        : {
            title: `${c.customerName} غيّر ميعاده`,
            body: pending
              ? `${c.serviceName} — الميعاد الجديد ${c.when}${was}. مستني تأكيدك.`
              : `${c.serviceName} — الميعاد الجديد ${c.when}${was}.`,
          };

    case "booking.reminder":
      return {
        title: `فاكر ميعادك في ${c.businessName}؟`,
        body: `${c.serviceName} — ${c.when}.`,
      };

    case "booking.startingSoon":
      return {
        title: `ميعادك في ${c.businessName} قرّب`,
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
        ? c.status === "FAILED_PAYMENT"
          ? {
              title: "الدفع ماتمّش",
              body: `حجزك في ${c.businessName} ماتأكدش والميعاد مابقاش محجوز لك. تقدر تحجز تاني من صفحة المكان.`,
            }
          : {
              title: "الدفع ماتمّش",
              body: `ميعادك في ${c.businessName} لسه محجوز لك.`,
            }
        : {
            title: `دفعة ${c.customerName} ماتمّتش`,
            body: `${c.serviceName} — ${c.when}.`,
          };

    case "subscription.renewalDue":
      return {
        title: `اشتراكك هينتهي خلال ${daysAr(event.daysLeft)}`,
        body: "جدّد عشان تفضل معاك مميزات باقتك ومترجعش للباقة المجانية.",
      };

    case "subscription.expired":
      return {
        title: "انتهى اشتراكك في موعد",
        body: `رجعت للباقة المجانية: صفحتك لسه ظاهرة، بس بحد ${PLAN_FEATURES.FREE.monthlyBookings} حجز في الشهر ومن غير واتساب ولا إحصائيات ولا عربون. جدّد عشان ترجع مميزات باقتك.`,
      };

    case "subscription.renewed":
      return {
        title: "تم تجديد اشتراكك",
        body: `اشتراكك ساري لحد ${dateFull(event.until, "ar")}.`,
      };
  }
}

/** "يوم واحد" · "يومين" · "5 أيام" · "14 يوم" */
export function daysAr(n: number): string {
  return arCount(n, { one: "يوم واحد", two: "يومين", few: "أيام", many: "يوم" });
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
