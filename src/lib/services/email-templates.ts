/**
 * Arabic HTML email templates for Maw3ed booking notifications.
 * One per event — received, confirmed, reminder, rescheduled, new
 * booking, customer moved it, payment received — in the same colloquial
 * register as the push and in-app copy.
 * Plain HTML — no React, no external renderer. Works in all email clients.
 */

import type { BookingEmailData } from "./email";
import { siteUrl } from "@/lib/url";
import { arCount, money } from "@/lib/fmt";
import { PLAN_FEATURES } from "@/lib/plans";
import { CUTOFF_HOURS } from "@/lib/bookings/self-service";

const AR_DAYS: string[] = [
  "الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت",
];
const AR_MONTHS: string[] = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function formatDateAr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return `${AR_DAYS[date.getDay()]}، ${d} ${AR_MONTHS[m - 1]} ${y}`;
}

// ── Shared layout wrapper ─────────────────────────────────────

function layout(body: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>موعد</title>
</head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo bar -->
        <tr><td style="background:#0D7A5A;border-radius:16px 16px 0 0;padding:20px 32px;">
          <p style="margin:0;color:white;font-size:22px;font-weight:900;letter-spacing:-0.5px;">موعد</p>
        </td></tr>

        <!-- Body card -->
        <tr><td style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 0 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            الرسالة دي اتبعتت تلقائيًا من <strong>موعد</strong> · متردّش على الإيميل ده
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Row helper ────────────────────────────────────────────────

function row(label: string, value: string, ltr = false): string {
  return `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;width:40%;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:600;color:#111827;text-align:${ltr ? "left" : "right"};direction:${ltr ? "ltr" : "rtl"};">${escapeHtml(value)}</td>
  </tr>`;
}

// ── Shared booking pieces ─────────────────────────────────────

function priceOf(d: BookingEmailData): string {
  return money(d.totalPrice, "ar", d.currency);
}

function timeOf(startTime: string, endTime?: string | null): string {
  return endTime ? `${startTime} – ${endTime}` : startTime;
}

/** The appointment laid out as a table, for the customer. */
function customerDetails(d: BookingEmailData): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${row("المكان",   d.businessName)}
      ${row("الخدمة",   d.serviceName)}
      ${row("التاريخ",  formatDateAr(d.date))}
      ${row("الوقت",    timeOf(d.startTime, d.endTime), true)}
      ${row("الإجمالي", priceOf(d))}
    </table>`;
}

/** The same, for the business: who is coming and how to reach them. */
function businessDetails(d: BookingEmailData): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${row("العميل",       d.customerName)}
      ${row("رقم الموبايل", d.customerPhone, true)}
      ${row("الخدمة",       d.serviceName)}
      ${row("التاريخ",      formatDateAr(d.date))}
      ${row("الوقت",        timeOf(d.startTime, d.endTime), true)}
      ${row("الإجمالي",     priceOf(d))}
    </table>`;
}

/** Old and new time of a moved booking, when the old one is known. */
function movedRows(d: BookingEmailData): string {
  if (!d.previous) return "";
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      ${row("الميعاد القديم", `${formatDateAr(d.previous.date)} — ${d.previous.startTime}`)}
      ${row("الميعاد الجديد", `${formatDateAr(d.date)} — ${timeOf(d.startTime, d.endTime)}`)}
    </table>`;
}

/** `title` and `intro` are trusted markup: callers escape what they interpolate. */
function heading(title: string, intro: string): string {
  return `
    <p style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">${title}</p>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">${intro}</p>`;
}

function pill(text: string, tone: "ok" | "wait"): string {
  const [bg, fg] = tone === "ok" ? ["#dcfce7", "#15803d"] : ["#fef3c7", "#d97706"];
  return `
    <div style="display:inline-block;background:${bg};color:${fg};padding:6px 16px;border-radius:999px;font-size:13px;font-weight:700;margin-bottom:24px;">
      ${text}
    </div>`;
}

function note(text: string): string {
  return `
    <div style="background:#eff6ff;border-right:3px solid #3b82f6;border-radius:0 10px 10px 0;padding:12px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#1d4ed8;font-weight:600;">${text}</p>
    </div>`;
}

function notesBlock(d: BookingEmailData, label: string): string {
  return d.notes
    ? `
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;">${label}</p>
      <p style="margin:0;font-size:14px;color:#374151;">${escapeHtml(d.notes)}</p>
    </div>`
    : "";
}

function button(href: string, label: string): string {
  return `
    <div style="margin-bottom:24px;">
      <a href="${escapeHtml(href)}"
         style="display:inline-block;background:#0D7A5A;color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;">
        ${label}
      </a>
    </div>`;
}

const CUTOFF_TEXT = arCount(CUTOFF_HOURS, { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" });

/** The booking link, and what it lets the customer do (self-service.ts). */
function manageLink(d: BookingEmailData): string {
  return d.bookingUrl
    ? `${button(d.bookingUrl, "شوف الحجز ←")}
    <p style="margin:0 0 20px;font-size:12px;color:#9ca3af;">
      من الرابط ده تقدر تشوف حجزك، وتغيّر ميعاده أو تلغيه بنفسك لحد ${CUTOFF_TEXT} قبل الميعاد.
    </p>`
    : "";
}

const THANKS = `
    <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />
    <p style="margin:0;font-size:13px;color:#9ca3af;">شكرًا إنك استخدمت <strong style="color:#0D7A5A;">موعد</strong> 🙏</p>`;

const OWNER_FOOTER = `
    <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      تقدر تتحكم في التنبيهات اللي بتوصلك من إعدادات الإشعارات في لوحة التحكم.
    </p>`;

function dashboardButton(): string {
  return button(siteUrl("/dashboard/bookings"), "افتح الحجوزات ←");
}

// ── Customer: booking received / confirmed ────────────────────

/**
 * The customer's copy of a new or confirmed booking. A booking still
 * waiting for the business says so; anything else (confirmed by the
 * business, or made at a business that confirms automatically) says it
 * is confirmed — a confirmed booking must never read as pending.
 */
export function customerConfirmationHtml(d: BookingEmailData): string {
  const name = `<strong>${escapeHtml(d.customerName)}</strong>`;
  const biz = `<strong>${escapeHtml(d.businessName)}</strong>`;
  const body =
    d.status === "PENDING"
      ? `${heading("وصل طلب حجزك 📩", `أهلًا ${name}، طلب حجزك في ${biz} وصل. ${biz} هيراجعه ويأكده، وهيوصلك إشعار أول ما يتأكد.`)}
    ${customerDetails(d)}
    ${notesBlock(d, "ملاحظاتك")}
    ${pill("⏳ مستني تأكيد", "wait")}
    ${manageLink(d)}
    ${THANKS}`
      : `${heading("حجزك اتأكد ✅", `أهلًا ${name}، حجزك في ${biz} مؤكَّد.`)}
    ${customerDetails(d)}
    ${notesBlock(d, "ملاحظاتك")}
    ${pill("✅ مؤكَّد", "ok")}
    ${manageLink(d)}
    ${THANKS}`;
  return layout(body);
}

// ── Customer: reminder ────────────────────────────────────────

/**
 * Sent `reminderLeadHours` before the appointment — which a business
 * sets anywhere from hours to days — so it names the date and never
 * says "tomorrow". Only confirmed bookings are reminded.
 */
export function customerReminderHtml(d: BookingEmailData): string {
  const body = `
    ${heading("تذكير بميعادك ⏰", `أهلًا <strong>${escapeHtml(d.customerName)}</strong>، ده تذكير بميعادك في <strong>${escapeHtml(d.businessName)}</strong>.`)}
    ${customerDetails(d)}
    ${note(`📅 ميعادك مؤكَّد — ${escapeHtml(formatDateAr(d.date))}، الساعة <span dir="ltr">${escapeHtml(d.startTime)}</span>.`)}
    ${d.bookingUrl ? button(d.bookingUrl, "شوف الحجز أو الغيه ←") : ""}
    ${THANKS}`;
  return layout(body);
}

// ── Customer: rescheduled ─────────────────────────────────────

/**
 * The booking moved. Shows the old and the new time. When the customer
 * moved it, the booking goes back to the business to confirm (the
 * reschedule route resets it to PENDING), and the email says so.
 */
export function customerRescheduleHtml(d: BookingEmailData): string {
  const biz = `<strong>${escapeHtml(d.businessName)}</strong>`;
  const status =
    d.status === "PENDING"
      ? `${pill("⏳ الميعاد الجديد مستني تأكيد", "wait")}
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${biz} هيراجع الميعاد الجديد ويأكده، وهيوصلك إشعار.</p>`
      : pill("✅ مؤكَّد", "ok");
  const body = `
    ${heading("اتغيّر ميعادك 📅", `أهلًا <strong>${escapeHtml(d.customerName)}</strong>، ميعاد حجزك في ${biz} اتغيّر.`)}
    ${movedRows(d)}
    ${customerDetails(d)}
    ${status}
    ${manageLink(d)}
    ${THANKS}`;
  return layout(body);
}

// ── Business: new booking ─────────────────────────────────────

export function businessAlertHtml(d: BookingEmailData): string {
  const who = `<strong>${escapeHtml(d.customerName)}</strong>`;
  const body = `
    ${heading("حجز جديد 🗓️", d.status === "PENDING"
      ? `${who} حجز عندك، والحجز مستني تأكيدك من لوحة التحكم.`
      : `${who} حجز عندك، والحجز مؤكَّد.`)}
    ${businessDetails(d)}
    ${notesBlock(d, "ملاحظات العميل")}
    ${dashboardButton()}
    ${OWNER_FOOTER}`;
  return layout(body);
}

// ── Business: the customer moved their booking ───────────────

export function businessRescheduleHtml(d: BookingEmailData): string {
  const who = `<strong>${escapeHtml(d.customerName)}</strong>`;
  const body = `
    ${heading("عميل غيّر ميعاده 🔄", d.status === "PENDING"
      ? `${who} غيّر ميعاد حجزه، والميعاد الجديد مستني تأكيدك.`
      : `${who} غيّر ميعاد حجزه.`)}
    ${movedRows(d)}
    ${businessDetails(d)}
    ${dashboardButton()}
    ${OWNER_FOOTER}`;
  return layout(body);
}

// ── Business: a payment arrived ───────────────────────────────

/**
 * A deposit or a balance landed. For a booking that needed a deposit
 * this is also the business's first word of it — that booking is only
 * announced once it is paid — so the appointment is laid out too.
 */
export function businessPaymentHtml(d: BookingEmailData): string {
  const who = `<strong>${escapeHtml(d.customerName)}</strong>`;
  const paid = d.paidAmount != null ? money(d.paidAmount, "ar", d.currency) : null;
  const body = `
    ${heading("وصلتك دفعة 💰", paid
      ? `${who} دفع <strong>${escapeHtml(paid)}</strong> أونلاين.`
      : `${who} دفع أونلاين.`)}
    ${businessDetails(d)}
    ${d.status === "CONFIRMED" ? pill("✅ الحجز مؤكَّد", "ok") : ""}
    ${dashboardButton()}
    ${OWNER_FOOTER}`;
  return layout(body);
}

// ── Subscription renewal reminder template ────────────────────

export function subscriptionRenewalReminderHtml(params: {
  businessName: string;
  planName:     string;
  expiryDate:   string;
  renewUrl:     string;
  daysLeft:     number;
}): string {
  const { businessName, planName, expiryDate, renewUrl, daysLeft } = params;
  const days = arCount(daysLeft, { one: "يوم واحد", two: "يومين", few: "أيام", many: "يوم" });
  const body = `
    <p style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">جدّد اشتراكك ⏰</p>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">
      أهلًا، اشتراك <strong>${escapeHtml(businessName)}</strong> في <strong>موعد</strong>
      هينتهي خلال <strong>${escapeHtml(days)}</strong>.
    </p>

    <div style="background:#fef3c7;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#92400e;">
        📅 باقة <strong>${escapeHtml(planName)}</strong> بتنتهي يوم <strong dir="ltr">${escapeHtml(expiryDate)}</strong>
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#b45309;">
        لو ماجدّدتش، نشاطك هيرجع للباقة المجانية تلقائيًا ومميزات باقتك الحالية هتقف.
      </p>
    </div>

    ${button(renewUrl, "جدّد الاشتراك ←")}
    ${THANKS}
  `;
  return layout(body);
}

// ── Subscription expired template ─────────────────────────────

/**
 * A lapsed subscription falls back to FREE (plans.ts getEffectivePlan);
 * the page stays published. The list is what every paid plan has and
 * FREE does not, so it is true whichever plan lapsed.
 */
export function subscriptionExpiredHtml(params: {
  businessName: string;
  planName:     string;
  renewUrl:     string;
}): string {
  const { businessName, planName, renewUrl } = params;
  const body = `
    <p style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">انتهى اشتراكك</p>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">
      اشتراك <strong>${escapeHtml(businessName)}</strong> في باقة <strong>${escapeHtml(planName)}</strong> انتهى،
      ونشاطك رجع للباقة المجانية. صفحتك لسه ظاهرة وبتستقبل حجوزات.
    </p>

    <div style="background:#fee2e2;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#991b1b;">
        ⚠️ اللي وقف لحد ما تجدّد:
      </p>
      <ul style="margin:8px 0 0;padding-right:20px;font-size:13px;color:#b91c1c;">
        <li>الحجوزات غير المحدودة (المجانية: ${PLAN_FEATURES.FREE.monthlyBookings} حجز في الشهر)</li>
        <li>إشعارات واتساب</li>
        <li>لوحة الإحصائيات</li>
        <li>استلام العربون والمدفوعات أونلاين</li>
        <li>إدارة الفريق</li>
      </ul>
    </div>

    ${button(renewUrl, "جدّد الاشتراك ←")}
    ${THANKS}
  `;
  return layout(body);
}

// ── Password reset template ───────────────────────────────────

export function passwordResetHtml(resetUrl: string): string {
  const body = `
    <p style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">تغيير كلمة المرور 🔐</p>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">
      وصلنا طلب لتغيير كلمة المرور بتاعة حسابك على <strong>موعد</strong>.
      اضغط على الزرار اللي تحت واختار كلمة مرور جديدة.
    </p>

    ${button(resetUrl, "اختار كلمة مرور جديدة ←")}

    <div style="background:#fef3c7;border-radius:10px;padding:12px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        ⏳ الرابط شغال لمدة <strong>ساعة واحدة</strong> بس.
      </p>
    </div>

    <p style="margin:0 0 16px;font-size:13px;color:#9ca3af;">
      لو مش إنت اللي طلبت ده، تجاهل الإيميل — كلمة المرور بتاعتك مش هتتغيّر.
    </p>
    ${THANKS}
  `;
  return layout(body);
}

/**
 * Sent once at signup to prove the person controls the address. Until
 * the link is followed the account exists but its business stays
 * unpublished, so this email is the gate on the public marketplace.
 */
export function emailVerificationHtml(verifyUrl: string, name?: string | null): string {
  const greeting = name ? `أهلًا ${escapeHtml(name)}،` : "أهلًا بيك،";
  const body = `
    <p style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">${greeting}</p>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">
      أكّد إيميلك عشان نقدر ننشر صفحة نشاطك على
      <strong>موعد</strong> وتبدأ تستقبل حجوزات.
    </p>

    <div style="margin-bottom:24px;">
      <a href="${escapeHtml(verifyUrl)}"
         style="display:inline-block;background:#0D7A5A;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
        أكّد إيميلي ←
      </a>
    </div>

    <div style="background:#E9F2EE;border-radius:10px;padding:12px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#0A5F47;">
        الرابط شغال لمدة <strong>24 ساعة</strong>.
      </p>
    </div>

    <p style="margin:0 0 16px;font-size:13px;color:#9ca3af;">
      لو مش إنت اللي عملت الحساب، تجاهل الإيميل ده — مفيش حاجة هتحصل.
    </p>

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />

    <p style="margin:0;font-size:13px;color:#9ca3af;">شكرًا إنك اخترت <strong style="color:#0D7A5A;">موعد</strong></p>
  `;
  return layout(body);
}

// ── The general-purpose notification email ────────────────────

/**
 * One email for every event that has no bespoke template of its own.
 *
 * The booking flows keep their hand-written templates — a confirmation
 * with the full appointment table reads better than anything generic.
 * This is for the rest, so that adding an event does not mean designing
 * an email before it can be sent at all.
 *
 * The text is escaped: a business name or a customer name arrives here
 * from a form, and a name with an angle bracket in it must not be able
 * to rewrite the message around it.
 */
export function notificationHtml(
  title: string,
  body: string | null,
  href: string | null,
): string {
  const link = href ? (/^https?:\/\//i.test(href) ? href : siteUrl(href)) : null;
  return layout(`
  <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#111827;line-height:1.5;">${escapeHtml(title)}</h1>
  ${
    body
      ? `<p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.8;">${escapeHtml(body)}</p>`
      : ""
  }
  ${
    link
      ? `<table cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#0D7A5A;">
           <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">عرض التفاصيل</a>
         </td></tr></table>`
      : ""
  }`);
}

/**
 * Every interpolated value goes through this, not just the ones that
 * look user-supplied today. Customer, business and account names all
 * arrive from public forms, and one unescaped `${name}` was enough to
 * let an anonymous booker put a link of their choosing, styled as ours,
 * into a business owner's inbox. Escaping the trusted values too costs
 * nothing and means nobody has to decide, per field, which ones are safe.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
